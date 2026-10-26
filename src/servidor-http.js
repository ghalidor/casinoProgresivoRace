// ============================================================
// Servidor HTTP (Express) con todos los endpoints
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { rechazar, startHttpServer };

const express = require('express');
const estado = require('./estado');
const { bodyParaLog, fechaLocalISO } = require('./utilidades');
const { logWarn, logInfo } = require('./logger');
const { guardarPeticion, getSpriteConfig, guardarEvento, setSpriteConfig, queryRows, contarPendientesIAS } = require('./db');
const { reintentarPendientesIAS, reintentarAcreditadosIAS, enviarGanadorAIas } = require('./ias');
const { acreditarDirecto, sendUpdateToDashboard, resolverAcreditado, textoPendiente, programarFlushGanador, flushPendingUpdates, hayGanadorEnCurso, savePendingToDisk } = require('./cola-ganadores');
const { esPedidoLocal, leerLogGanadores } = require('./panel-admin');
const { cargarTema, guardarTema, leerConfigLocal, guardarConfigLocal } = require('./tema');
const { loadConfig, loadConfigBase } = require('./config');
const { guardarPremio, quitarPremio, rutaImagenPremio, infoPremios } = require('./premios');
const { safeExecJs } = require('./ventana');

// Responde 400 igual que antes y ademas lo deja en el log.
function rechazar(res, endpoint, error, body) {
  logWarn(endpoint + ' RECHAZADO (400): ' + error + ' | body: ' + bodyParaLog(body));
  return res.status(400).json({ error: error });
}

// ============================================================
// SERVIDOR HTTP
// ============================================================
function startHttpServer(config) {
  // Guardar la config del IAS en una variable accesible desde otras funciones
  estado.iasConfig = {
    iasEnabled: !!config.iasEnabled,
    iasBaseUrl: config.iasBaseUrl || '',
    iasRetryIntervalSec: config.iasRetryIntervalSec || 30
  };
  if (config.detalleAcreditadoTimeout) estado.iasDetalleTimeout = config.detalleAcreditadoTimeout;
  if (config.detalleAcreditadoAuto) estado.iasDetalleAuto = config.detalleAcreditadoAuto;

  // Pausa entre que cierra un modal ganador y abre el siguiente.
  if (typeof config.gapEntreGanadoresSec === 'number') {
    estado.gapEntreGanadoresMs = config.gapEntreGanadoresSec * 1000;
  }

  // Tope de seguridad: cuanto puede durar como maximo un ganador en pantalla.
  estado.winnerDespachoMaxMs = ((config.winnerDelaySec || 5) +
                         (config.winnerModalDurationSec || 12) +
                         (config.confirmMinDisplaySec || 8) + 20) * 1000;

  // Arrancar timer de reintento de envios pendientes al IAS.
  // Esto cubre: ganadores que estaban en la DB de un crash anterior,
  // y ganadores cuyo POST inicial fallo (servidor externo caido).
  if (estado.iasConfig.iasEnabled && estado.iasConfig.iasBaseUrl) {
    logInfo('IAS habilitado: ' + estado.iasConfig.iasBaseUrl + ' (retry cada ' + estado.iasConfig.iasRetryIntervalSec + 's)');
    // Primer reintento al arrancar (despues de 5s para dejar que la DB cargue)
    setTimeout(() => { reintentarPendientesIAS(); reintentarAcreditadosIAS(); }, 5000);
    // Despues cada N segundos
    estado.iasRetryTimer = setInterval(() => { reintentarPendientesIAS(); reintentarAcreditadosIAS(); }, estado.iasConfig.iasRetryIntervalSec * 1000);
  } else {
    logInfo('IAS deshabilitado (iasEnabled=false o iasBaseUrl vacio)');
  }

  const httpApp = express();
  // /admin/premio recibe una imagen (base64, hasta 8 MB): solo esa ruta acepta cuerpos grandes
  const jsonNormal = express.json();
  const jsonPremio = express.json({ limit: '12mb' });
  httpApp.use((req, res, next) => (req.path === '/admin/premio' ? jsonPremio : jsonNormal)(req, res, next));

  httpApp.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  httpApp.post('/update', (req, res) => {
    const data = req.body;
    const ipOrigen = req.ip || req.connection.remoteAddress || 'unknown';

    // Validacion de campos obligatorios
    if (!data || !data.sheet) {
      return rechazar(res, '/update', 'sheet es requerido', data);
    }
    if (!['mini', 'minor', 'major', 'grand'].includes(data.sheet)) {
      return rechazar(res, '/update', 'sheet debe ser: mini, minor, major o grand', data);
    }
    // El dashboard aceptaba true, 1, "true" y "1". El servidor solo true.
    // Se normaliza a booleano aca para que los dos vean lo mismo: si no,
    // un ganador enviado como 1 abria el modal sin pasar por la cola.
    data.ganador = (data.ganador === true || data.ganador === 1 ||
                    data.ganador === 'true' || data.ganador === '1');
    if (!data.codSala || typeof data.codSala !== 'string') {
      return rechazar(res, '/update', 'codSala es requerido (string)', data);
    }
    if (data.idRace === undefined || data.idRace === null || !Number.isInteger(data.idRace)) {
      return rechazar(res, '/update', 'idRace es requerido (entero)', data);
    }
    // posicion es opcional pero si viene debe ser numero entero
    if (data.posicion !== undefined && data.posicion !== null && !Number.isInteger(data.posicion)) {
      return rechazar(res, '/update', 'posicion debe ser entero (si se envia)', data);
    }

    // Guardar en SQLite ANTES de procesar (siempre se registra)
    const peticionId = guardarPeticion(data, ipOrigen, false, 'update');

    // Solo los ganadores (los montos normales llegan seguido y serian ruido).
    if (data.ganador === true) {
      logInfo('GANADOR recibido: sheet=' + data.sheet + ' maquina=' + data.maquina +
              ' monto=' + data.amount + ' peticion=' + peticionId + ' ip=' + ipOrigen +
              ' | body: ' + bodyParaLog(data));
    }

    // Si es ganador, disparar envio al servidor IAS en paralelo (no bloquea).
    // Si falla, queda con enviado_externo=0 y el retry timer lo intentara despues.
    if (data.ganador === true && peticionId) {
      const fechaGanador = fechaLocalISO();  // hora local de Peru

      // grand/major con el sprite (moto/auto) visible: el premio es fisico,
      // nadie va a mandar /confirmSubida. Se acredita solo con estado 1.
      // Si esta en modo cash (montos) se espera la confirmacion normal.
      const spriteCfg = getSpriteConfig();
      const autoAcreditar = (data.sheet === 'grand' || data.sheet === 'major') &&
                            spriteCfg[data.sheet] === true;

      // Datos que identifican a este ganador para la acreditacion.
      const refGanador = {
        peticionId: peticionId,
        idRace: data.idRace,
        codSala: data.codSala,
        codMaquina: data.maquina
      };

      setImmediate(async () => {
        // Esperar a CrearGanador antes de acreditar, si no el IAS
        // puede recibir la acreditacion antes de que exista el ganador.
        await enviarGanadorAIas(peticionId, data, fechaGanador);
        if (autoAcreditar) {
          logInfo('Sprite activo en ' + data.sheet + ' -> acreditacion automatica estado=1 (peticion ' + peticionId + ')');
          // Directo, con SU propia referencia: si mientras tanto llego otro
          // ganador, este no puede acreditarse sobre la maquina equivocada.
          acreditarDirecto(refGanador, 1, estado.iasDetalleAuto);
        }
      });

      // El ganador NO entra a la cola de acreditacion aca. Entra recien
      // cuando se despacha al dashboard (sendUpdateToDashboard), que es
      // cuando de verdad va a estar en pantalla. Si llegan dos ganadores
      // casi juntos, el segundo espera su turno y no pisa al primero.
      if (!autoAcreditar) {
        data._refGanador = refGanador;
      }
    }

    sendUpdateToDashboard(data, peticionId);

    res.json({
      ok: true,
      peticionId: peticionId,
      dashboardReady: estado.dashboardReady,
      queueSize: estado.pendingUpdates.length
    });
  });

  // ============================================================
  // ENDPOINT /confirmSubida  (endpoint NUESTRO)
  // Body: {"estado": true|false, "mensaje": "texto"}
  // Es la confirmacion de subida del ganador que esta en el modal.
  //  - Muestra en el dashboard el mensaje verde (true) o rojo (false).
  //  - Llama al IAS ActualizarEstadoAcreditado: estado true->1, false->0,
  //    detalle = el mensaje recibido.
  // Si no hay ganador activo, se ignora.
  // ============================================================
  httpApp.post('/confirmSubida', (req, res) => {
    const data = req.body;
    logInfo('confirmSubida recibido | body: ' + bodyParaLog(data));
    if (!data || typeof data.estado !== 'boolean') {
      return rechazar(res, '/confirmSubida', 'estado es requerido (boolean)', data);
    }
    const mensaje = (typeof data.mensaje === 'string') ? data.mensaje : '';

    // Maquina que envia el sistema externo. Sirve para saber de QUE ganador
    // es esta confirmacion cuando hubo dos ganadores casi seguidos.
    const maquinaConfirm = (data.maquina !== undefined && data.maquina !== null)
      ? String(data.maquina).trim()
      : null;

    if (!estado.ganadorPendiente) {
      // Llego fuera del tiempo del modal (tardio). NO se reenvia al IAS:
      // si el modal ya cerro, ya se reporto estado 2 y ese es definitivo.
      // Solo se registra en auditoria para saber que llego fuera de rango.
      logWarn('confirmSubida recibido sin ganador activo (tardio), solo auditoria. maquina=' + (maquinaConfirm || 'no enviada'));
      guardarEvento('confirmSubida-tardio', JSON.stringify({ estado: data.estado, mensaje: mensaje, maquina: maquinaConfirm }));
      return res.json({ ok: false, motivo: 'no hay ganador activo (llego fuera de tiempo)' });
    }

    // Si mandan la maquina, tiene que ser la del ganador que esta en pantalla.
    // Si no coincide es una confirmacion que llego tarde (el modal de esa
    // maquina ya cerro) y ahora hay otro ganador distinto: se descarta para
    // no acreditar a la maquina equivocada.
    const maquinaEnPantalla = String(estado.ganadorPendiente.codMaquina || '').trim();
    if (maquinaConfirm && maquinaConfirm !== maquinaEnPantalla) {
      logWarn('confirmSubida de maquina ' + maquinaConfirm +
              ' pero en pantalla esta la ' + maquinaEnPantalla + ' -> descartado (tardio)');
      guardarEvento('confirmSubida-otraMaquina', JSON.stringify({
        estado: data.estado,
        mensaje: mensaje,
        maquinaRecibida: maquinaConfirm,
        maquinaEnPantalla: maquinaEnPantalla
      }));
      return res.json({ ok: false, motivo: 'la maquina no corresponde al ganador en pantalla (llego fuera de tiempo)' });
    }

    if (!maquinaConfirm) {
      // Compatibilidad: sistemas que todavia no mandan la maquina.
      // Se aplica al ganador en pantalla, pero queda avisado en el log.
      logWarn('confirmSubida sin campo maquina - se aplica al ganador en pantalla (' + maquinaEnPantalla + ')');
    }

    // Mostrar el mensaje en el dashboard (verde/rojo) y extender el modal.
    const code = `if (window.casinoConfirmSubida) { window.casinoConfirmSubida(${JSON.stringify({ estado: data.estado })}); } return 'sent';`;
    safeExecJs(code);

    // Enviar al IAS: true->1, false->0. detalle = mensaje recibido.
    const estadoIas = data.estado ? 1 : 0;
    logInfo('confirmSubida OK maquina ' + maquinaEnPantalla +
            ' (peticion ' + estado.ganadorPendiente.peticionId + ')' +
            ' -> ActualizarEstadoAcreditado estado=' + estadoIas +
            (mensaje ? ' | ' + mensaje : ''));
    resolverAcreditado(estadoIas, mensaje);

    guardarEvento('confirmSubida', JSON.stringify({ estado: data.estado, mensaje: mensaje, maquina: maquinaEnPantalla }));
    res.json({ ok: true });
  });

  // ============================================================
  // ENDPOINT /winner-closed  (USO INTERNO - lo llama el dashboard)
  // El dashboard lo invoca en el momento exacto en que cierra el modal
  // ganador. Si en ese momento todavia hay un ganador esperando la
  // confirmacion, significa que nunca llego -> se reporta estado 2.
  // Si ya se resolvio (estado 1 o 0), ganadorPendiente es null y no
  // hace nada. No lo llama ningun sistema externo.
  // ============================================================
  httpApp.post('/winner-closed', (req, res) => {
    if (estado.ganadorPendiente) {
      logInfo('Modal cerrado sin confirmSubida' + textoPendiente() + ' -> ActualizarEstadoAcreditado estado=2');
      resolverAcreditado(2, estado.iasDetalleTimeout);
    }
    // El dashboard avisa apenas cierra, asi que la cola se libera aca y no
    // hay que esperar al watchdog (que corre cada 5s). Pausa configurable
    // entre un ganador y el siguiente.
    programarFlushGanador();
    res.json({ ok: true });
  });

  // ============================================================
  // ENDPOINT /promo-state
  // El dashboard avisa cuando abre ({activa:true}) y cierra
  // ({activa:false}) un video promo. Asi la cola de ganadores
  // encolados por promo se libera apenas termina, sin esperar al
  // watchdog de 5s (que sigue corriendo como respaldo).
  // ============================================================
  httpApp.post('/promo-state', (req, res) => {
    const activa = !!(req.body && req.body.activa === true);
    const terminoPromo = estado.isPromoActive && !activa;
    estado.isPromoActive = activa;
    if (!activa) {
      if (terminoPromo && estado.pendingUpdates.length > 0) logInfo('Promo termino (aviso dashboard), procesando cola');
      // Si hay un ganador en pantalla o en la pausa entre ganadores,
      // sendUpdateToDashboard lo vuelve a encolar (igual que el watchdog).
      flushPendingUpdates();
    }
    res.json({ ok: true });
  });

  // ============================================================
  // ENDPOINT /reinicio
  // Reinicia el odometro de mini o minor al amount enviado, sin
  // animacion (snap directo). No es ganador, no dispara modal.
  // Si hay modal ganador del mismo sheet activo, se encola hasta
  // que cierre. Si es de otro sheet, se procesa inmediatamente.
  // ============================================================
  httpApp.post('/reinicio', (req, res) => {
    const data = req.body;
    const ipOrigen = req.ip || req.connection.remoteAddress || 'unknown';

    if (!data || !data.sheet) {
      return res.status(400).json({ error: 'sheet es requerido' });
    }
    if (!['mini', 'minor', 'grand', 'major'].includes(data.sheet)) {
      return res.status(400).json({ error: 'sheet debe ser: mini, minor, grand o major' });
    }
    if (data.amount === undefined || data.amount === null || typeof data.amount !== 'number') {
      return res.status(400).json({ error: 'amount es requerido (numero decimal)' });
    }
    if (!data.codSala || typeof data.codSala !== 'string') {
      return res.status(400).json({ error: 'codSala es requerido (string)' });
    }
    if (data.idRace === undefined || data.idRace === null || !Number.isInteger(data.idRace)) {
      return res.status(400).json({ error: 'idRace es requerido (entero)' });
    }

    // Marcar internamente que es reinicio para que el dashboard lo trate distinto.
    // Esto NO va a la DB (la DB usa la columna endpoint).
    const dataExt = Object.assign({}, data, { _endpoint: 'reinicio' });

    const peticionId = guardarPeticion(data, ipOrigen, false, 'reinicio');

    sendUpdateToDashboard(dataExt, peticionId);

    res.json({
      ok: true,
      peticionId: peticionId,
      dashboardReady: estado.dashboardReady,
      queueSize: estado.pendingUpdates.length
    });
  });

  // ============================================================
  // PANEL ADMIN
  // /admin/pin: solo desde esta misma maquina.
  //   PIN en config.json -> "adminPin". Si no esta, se usa 1234.
  // /admin/log-ganadores: desde cualquier lado (solo lectura,
  //   igual que /history). Sirve para Postman u otro sistema.
  // ============================================================
  const adminPin = (config.adminPin !== undefined && config.adminPin !== null && String(config.adminPin) !== '')
    ? String(config.adminPin) : '1234';
  if (adminPin === '1234' && String(config.adminPin) !== '1234') {
    logWarn('adminPin no configurado en config.json - el panel usa el PIN 1234');
  }

  httpApp.post('/admin/pin', (req, res) => {
    if (!esPedidoLocal(req)) return res.status(403).json({ error: 'solo desde esta maquina' });
    const ok = !!(req.body && String(req.body.pin) === adminPin);
    if (!ok) logWarn('Panel admin: PIN incorrecto');
    res.json({ ok: ok });
  });

  // ============================================================
  // TEMA y CONFIG editables desde el dashboard (solo desde esta maquina, con PIN)
  // ============================================================
  const conPin = (req, res) => {
    if (!esPedidoLocal(req)) { res.status(403).json({ error: 'solo desde esta maquina' }); return false; }
    if (!req.body || String(req.body.pin) !== adminPin) { res.status(401).json({ error: 'PIN incorrecto' }); return false; }
    return true;
  };

  // Textos que se ven en pantalla (los lee el dashboard al cargar)
  httpApp.get('/tema', (req, res) => {
    if (!esPedidoLocal(req)) return res.status(403).json({ error: 'solo desde esta maquina' });
    res.json(cargarTema());
  });

  // ---------- imagen del premio de GRAND / MAJOR (Ctrl+Shift+T) ----------
  // Lo que tiene cada pozo (la pantalla lo lee al cargar)
  httpApp.get('/premios', (req, res) => {
    if (!esPedidoLocal(req)) return res.status(403).json({ error: 'solo desde esta maquina' });
    res.json(infoPremios());
  });
  // El archivo subido (la pantalla lo pide con ?v=version para no quedarse con uno viejo)
  httpApp.get('/premio-img/:pozo', (req, res) => {
    if (!esPedidoLocal(req)) return res.status(403).end();
    const ruta = rutaImagenPremio(req.params.pozo);
    if (!ruta) return res.status(404).end();
    res.sendFile(ruta);
  });
  // Body: { pin, pozo: grand|major, tipo: sprite|imagen, nombre, datos: base64 }
  httpApp.post('/admin/premio', (req, res) => {
    if (!conPin(req, res)) return;
    try {
      const reg = guardarPremio(req.body.pozo, req.body.tipo, req.body.datos, req.body.nombre);
      guardarEvento('premio-imagen', JSON.stringify({ pozo: req.body.pozo, tipo: reg.tipo, nombre: reg.nombre }));
      logInfo('Imagen del premio ' + req.body.pozo + ' actualizada: ' + reg.tipo + ' ' + reg.nombre);
      res.json({ ok: true, premios: infoPremios() });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  // Body: { pin, pozo } -> vuelve a la imagen original
  httpApp.post('/admin/premio/quitar', (req, res) => {
    if (!conPin(req, res)) return;
    try {
      quitarPremio(req.body.pozo);
      guardarEvento('premio-imagen', JSON.stringify({ pozo: req.body.pozo, tipo: 'original' }));
      logInfo('Imagen del premio ' + req.body.pozo + ' vuelve a la original');
      res.json({ ok: true, premios: infoPremios() });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  httpApp.post('/admin/tema', (req, res) => {
    if (!conPin(req, res)) return;
    try {
      const tema = guardarTema(req.body.tema);
      logInfo('Tema actualizado desde el dashboard: ' + JSON.stringify(tema));
      res.json({ ok: true, tema: tema });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Config: valores actuales, los de config.json y cuales se cambiaron desde el dashboard
  httpApp.post('/admin/config/leer', (req, res) => {
    if (!conPin(req, res)) return;
    // el PIN no se muestra ni se edita desde el panel (solo en config.json)
    const sinPin = (c) => { const o = Object.assign({}, c); delete o.adminPin; return o; };
    res.json({ config: sinPin(loadConfig()), base: sinPin(loadConfigBase()), local: sinPin(leerConfigLocal()) });
  });

  // Guarda los cambios y recarga la pantalla para aplicarlos (si no hay ganador en curso)
  httpApp.post('/admin/config', (req, res) => {
    if (!conPin(req, res)) return;
    try {
      const r = guardarConfigLocal(req.body.cambios, loadConfigBase());
      logInfo('Config actualizada desde el dashboard: ' + JSON.stringify(req.body.cambios) +
              (r.rechazados.length ? ' (ignorados: ' + r.rechazados.join(', ') + ')' : ''));
      const c = loadConfig();
      estado.iasConfig = {
        iasEnabled: !!c.iasEnabled,
        iasBaseUrl: c.iasBaseUrl || '',
        iasRetryIntervalSec: c.iasRetryIntervalSec || 30
      };
      const puedeRecargar = !!estado.mainWindow && !hayGanadorEnCurso();
      res.json({ ok: true, rechazados: r.rechazados, recargado: puedeRecargar });
      if (puedeRecargar) {
        setTimeout(() => {
          estado.dashboardReady = false;
          savePendingToDisk();
          estado.mainWindow.reload();
        }, 800);
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  httpApp.get('/admin/log-ganadores', (req, res) => {
    res.json({ lineas: leerLogGanadores() });
  });

  httpApp.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      isWinnerActive: estado.isWinnerActive,
      isPromoActive: estado.isPromoActive,
      dashboardReady: estado.dashboardReady,
      pendingUpdates: estado.pendingUpdates.length,
      dbReady: estado.dbReady
    });
  });

  // ============================================================
  // ENDPOINT /sprite-config
  // Activa/desactiva el sprite (auto/moto) de grand y major.
  // Cuando show=false: la hoja se renderiza estilo mini/minor
  // (odometro, sin sprite ni KPIs, subtitulo "GANATE EFECTIVO").
  // El valor se persiste en BD y se mantiene tras reinicios.
  // ============================================================
  httpApp.post('/sprite-config', (req, res) => {
    const data = req.body;
    if (!data || !['grand', 'major'].includes(data.sheet)) {
      return res.status(400).json({ error: 'sheet debe ser: grand o major' });
    }
    if (typeof data.show !== 'boolean') {
      return res.status(400).json({ error: 'show es requerido (boolean)' });
    }
    const ok = setSpriteConfig(data.sheet, data.show);
    if (!ok) return res.status(500).json({ error: 'No se pudo guardar' });

    // Auditoria: registrar el cambio en la tabla eventos
    guardarEvento('sprite-config',
      JSON.stringify({ sheet: data.sheet, show: data.show }));

    // Avisar al dashboard para que ajuste el layout en vivo
    sendUpdateToDashboard({
      _endpoint: 'sprite-config',
      sheet: data.sheet,
      show: data.show
    }, null);

    res.json({ ok: true, sheet: data.sheet, show: data.show });
  });

  // GET /sprite-config -> estado actual. Ademas de grand/major (true = imagen, false = monto)
  // informa que imagen tiene cada pozo: tipo "original", "sprite" o "imagen" y el nombre del archivo.
  httpApp.get('/sprite-config', (req, res) => {
    const premios = infoPremios();
    const info = {};
    Object.keys(premios).forEach((p) => (info[p] = { tipo: premios[p].tipo, nombre: premios[p].nombre }));
    res.json(Object.assign({}, getSpriteConfig(), { premios: info }));
  });

  // ============================================================
  // ENDPOINT /sprite-config-bulk
  // Actualiza AMBOS flags (grand y major) en UN solo request.
  // Body: {"grand": true|false, "major": true|false} (ambos obligatorios)
  // El dashboard recibe UN solo mensaje con los dos cambios.
  // ============================================================
  httpApp.post('/sprite-config-bulk', (req, res) => {
    const data = req.body;
    if (!data || typeof data.grand !== 'boolean' || typeof data.major !== 'boolean') {
      return res.status(400).json({
        error: 'Se requieren ambos campos boolean: grand y major'
      });
    }

    const okG = setSpriteConfig('grand', data.grand);
    const okM = setSpriteConfig('major', data.major);
    if (!okG || !okM) {
      return res.status(500).json({ error: 'No se pudo guardar en BD' });
    }

    // Auditoria: registrar el evento con el detalle del cambio
    guardarEvento('sprite-config-bulk',
      JSON.stringify({ grand: data.grand, major: data.major }));

    // Notificar al dashboard con un solo mensaje que trae ambos cambios.
    // Pasa por sendUpdateToDashboard -> respeta encolar si hay modal activo.
    sendUpdateToDashboard({
      _endpoint: 'sprite-config-bulk',
      grand: data.grand,
      major: data.major
    }, null);

    res.json({ ok: true, grand: data.grand, major: data.major });
  });

  // ============================================================
  // ENDPOINT /update-bulk
  // Actualiza el monto de los 4 pozos en UN solo request.
  // Body: {"mini":{...}, "minor":{...}, "major":{...}, "grand":{...}}
  // Cada pozo requiere: amount, codSala, idRace (igual que /update).
  // NO acepta ganador=true (para ganador usar /update).
  // Internamente procesa cada pozo como un update normal: guarda en
  // peticiones (endpoint='update-bulk'), envia al dashboard. Si hay
  // modal activo, sendUpdateToDashboard ya encola correctamente.
  // ============================================================
  httpApp.post('/update-bulk', (req, res) => {
    const body = req.body;
    const ipOrigen = req.ip || req.connection.remoteAddress || 'unknown';

    if (!body) {
      return res.status(400).json({ error: 'body es requerido' });
    }

    const SHEETS = ['mini', 'minor', 'major', 'grand'];

    // Validar que esten los 4 pozos
    for (const s of SHEETS) {
      if (!body[s] || typeof body[s] !== 'object') {
        return res.status(400).json({ error: 'falta el pozo: ' + s });
      }
    }

    // Validar cada pozo individualmente (mismas reglas que /update)
    for (const s of SHEETS) {
      const p = body[s];
      if (p.ganador === true) {
        return res.status(400).json({
          error: 'update-bulk NO acepta ganador=true. Usar /update para ganadores.'
        });
      }
      if (p.amount === undefined || p.amount === null || typeof p.amount !== 'number') {
        return res.status(400).json({ error: s + '.amount es requerido (numero decimal)' });
      }
      if (!p.codSala || typeof p.codSala !== 'string') {
        return res.status(400).json({ error: s + '.codSala es requerido (string)' });
      }
      if (p.idRace === undefined || p.idRace === null || !Number.isInteger(p.idRace)) {
        return res.status(400).json({ error: s + '.idRace es requerido (entero)' });
      }
    }

    // Procesar cada pozo: guardar en peticiones + enviar al dashboard
    const peticionIds = {};
    for (const s of SHEETS) {
      const data = Object.assign({}, body[s], { sheet: s, ganador: false });
      const peticionId = guardarPeticion(data, ipOrigen, false, 'update-bulk');
      peticionIds[s] = peticionId;
      sendUpdateToDashboard(data, peticionId);
    }

    res.json({
      ok: true,
      peticionIds: peticionIds,
      dashboardReady: estado.dashboardReady,
      queueSize: estado.pendingUpdates.length
    });
  });

  httpApp.get('/status', (req, res) => {
    res.json({
      config: config,
      spriteConfig: getSpriteConfig(),
      isWinnerActive: estado.isWinnerActive,
      isPromoActive: estado.isPromoActive,
      dashboardReady: estado.dashboardReady,
      pendingUpdates: estado.pendingUpdates
    });
  });

  // Endpoint para ver el historial reciente
  httpApp.get('/history', (req, res) => {
    if (!estado.db || !estado.dbReady) return res.json({ error: 'DB no disponible' });
    try {
      const limit = parseInt(req.query.limit) || 50;
      const rows = queryRows('SELECT * FROM peticiones ORDER BY id DESC LIMIT ?', [limit]);
      res.json({ count: rows.length, peticiones: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================
  // ENDPOINT /audit
  // Lee la tabla 'eventos' (auditoria de cambios de configuracion:
  // sprite-config, sprite-config-bulk, etc).
  // Query params:
  //   ?limit=50           cantidad de registros (default 50)
  //   ?tipo=sprite-config filtrar por tipo de evento
  // ============================================================
  httpApp.get('/audit', (req, res) => {
    if (!estado.db || !estado.dbReady) return res.json({ error: 'DB no disponible' });
    try {
      const limit = parseInt(req.query.limit) || 50;
      const tipoFiltro = req.query.tipo;
      let rows;
      if (tipoFiltro) {
        rows = queryRows(
          'SELECT * FROM eventos WHERE tipo = ? ORDER BY id DESC LIMIT ?',
          [tipoFiltro, limit]
        );
      } else {
        rows = queryRows('SELECT * FROM eventos ORDER BY id DESC LIMIT ?', [limit]);
      }
      res.json({ count: rows.length, eventos: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================
  // GET /ultimo-monto
  // Devuelve el ultimo monto registrado para grand (car) y major (moto)
  // tomados de la tabla peticiones (cualquier endpoint: update, update-bulk, ganador)
  // ============================================================
  httpApp.get('/ultimo-monto', (req, res) => {
    if (!estado.db || !estado.dbReady) return res.json({ error: 'DB no disponible' });
    try {
      // Mapeo sheet -> nombre en la respuesta
      const mapping = { grand: 'Car', major: 'Moto', mini: 'Mini', minor: 'Minor' };
      const out = {};
      for (const sheet in mapping) {
        const rows = queryRows(
          'SELECT amount, fecha_registro FROM peticiones WHERE sheet = ? AND amount IS NOT NULL ORDER BY id DESC LIMIT 1',
          [sheet]
        );
        out[mapping[sheet]] = {
          Monto: rows[0] ? rows[0].amount : 0,
          Fecha: rows[0] ? rows[0].fecha_registro : null
        };
      }
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Estadisticas por hoja
  httpApp.get('/stats', (req, res) => {
    if (!estado.db || !estado.dbReady) return res.json({ error: 'DB no disponible' });
    try {
      const stats = queryRows(`
        SELECT 
          sheet,
          COUNT(*) as total,
          SUM(ganador) as ganadores,
          MAX(amount) as max_amount,
          MIN(fecha_registro) as primera,
          MAX(fecha_registro) as ultima
        FROM peticiones
        GROUP BY sheet
      `);
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Estado de envios al servidor IAS externo
  httpApp.get('/ias-status', (req, res) => {
    res.json({
      iasEnabled: estado.iasConfig ? estado.iasConfig.iasEnabled : false,
      iasBaseUrl: estado.iasConfig ? estado.iasConfig.iasBaseUrl : '',
      iasRetryIntervalSec: estado.iasConfig ? estado.iasConfig.iasRetryIntervalSec : 0,
      pendientes: contarPendientesIAS(),
      ultimoIntento: estado.iasStats.ultimoIntento,
      ultimoExito: estado.iasStats.ultimoExito,
      ultimoError: estado.iasStats.ultimoError,
      totalEnviados: estado.iasStats.totalEnviados,
      totalErrores: estado.iasStats.totalErrores
    });
  });

  httpApp.listen(config.httpPort, '0.0.0.0', () => {
    logInfo('Servidor HTTP en puerto ' + config.httpPort);
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/update');
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/update-bulk  body: {"mini":{amount,codSala,idRace},"minor":{...},"major":{...},"grand":{...}}');
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/reinicio');
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/sprite-config  body: {"sheet":"grand|major","show":true|false}');
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/sprite-config-bulk  body: {"grand":true|false,"major":true|false}');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/sprite-config');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/health');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/status');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/history?limit=50');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/audit?limit=50&tipo=sprite-config');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/ultimo-monto');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/stats');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/ias-status');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/admin/log-ganadores');
  });
}
