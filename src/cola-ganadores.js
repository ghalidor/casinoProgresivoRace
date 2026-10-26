// ============================================================
// Cola de updates/ganadores hacia el dashboard y acreditacion
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { textoPendiente, resolverAcreditado, acreditarDirecto, programarFlushGanador, hayGanadorEnCurso, savePendingToDisk, loadPendingFromDisk, sendUpdateToDashboard, flushPendingUpdates };

const fs = require('fs');
const estado = require('./estado');
const { logError, logInfo, logWarn } = require('./logger');
const { guardarEvento, guardarAcreditadoEnDB, marcarPeticionEncolada, marcarPeticionProcesada } = require('./db');
const { enviarAcreditadoAIas } = require('./ias');
const { safeExecJs } = require('./ventana');

// Resuelve la acreditacion del ganador pendiente: persiste y envia al IAS.
// estadoAcreditado: 1=confirmado ok, 0=confirmado error, 2=no confirmaron (timeout).
// " (maquina X, peticion N)" del ganador que espera confirmacion, para el log.
function textoPendiente() {
  if (!estado.ganadorPendiente) return '';
  return ' (maquina ' + estado.ganadorPendiente.codMaquina + ', peticion ' + estado.ganadorPendiente.peticionId + ')';
}

function resolverAcreditado(estadoAcreditado, detalle) {
  const g = estado.ganadorPendiente;
  if (!g) return false;
  estado.ganadorPendiente = null;  // resuelto (evita doble envio)
  if (estadoAcreditado === 2) {
    // Sin confirmacion. Queda en eventos igual que los demas casos,
    // para poder auditar todo desde una sola tabla.
    guardarEvento('confirmSubida-noLlego', JSON.stringify({
      maquina: g.codMaquina,
      peticionId: g.peticionId,
      detalle: detalle
    }));
  }
  acreditarDirecto(g, estadoAcreditado, detalle);
  return true;
}

// Acredita un ganador concreto SIN pasar por ganadorPendiente.
// Se usa para el sprite (grand/major automatico), que nunca espera
// confirmSubida y por lo tanto no debe ocupar lugar en la cola.
// g: { peticionId, idRace, codSala, codMaquina }
function acreditarDirecto(g, estadoAcreditado, detalle) {
  if (!g || !g.peticionId) return false;
  guardarAcreditadoEnDB(g.peticionId, estadoAcreditado, detalle);
  setImmediate(() => {
    enviarAcreditadoAIas(g.peticionId, {
      idRace: g.idRace,
      codSala: g.codSala,
      codMaquina: g.codMaquina,
      estadoAcreditado: estadoAcreditado,
      detalle: detalle
    });
  });
  return true;
}

// Libera la cola despues de que cierra un modal ganador, esperando
// gapEntreGanadoresMs para que no salga uno pegado al otro.
// El flag evita que /winner-closed y el watchdog lo hagan dos veces.
function programarFlushGanador() {
  if (estado.flushProgramado) return;
  estado.flushProgramado = true;
  estado.winnerDespachado = false;
  estado.isWinnerActive = false;
  setTimeout(() => {
    estado.flushProgramado = false;
    flushPendingUpdates();
  }, estado.gapEntreGanadoresMs);
}

// Hay algun ganador sin terminar: en pantalla, en el delay antes de abrir,
// en la pausa entre ganadores o esperando en la cola.
// Mientras sea true NO se recarga el dashboard (se perderia el ganador).
function hayGanadorEnCurso() {
  if (estado.isWinnerActive || estado.winnerDespachado || estado.flushProgramado) return true;
  return estado.pendingUpdates.some(item => {
    const d = item.data ? item.data : item;
    return d && d.ganador === true;
  });
}

// ============================================================
// PERSISTIR cola de pending al disco (sobrevive reload)
// ============================================================
function savePendingToDisk() {
  try {
    fs.writeFileSync(estado.PENDING_FILE, JSON.stringify(estado.pendingUpdates), 'utf-8');
  } catch (e) {
    logError('Error guardando pending al disco: ' + e.message);
  }
}

function loadPendingFromDisk() {
  try {
    if (fs.existsSync(estado.PENDING_FILE)) {
      const raw = fs.readFileSync(estado.PENDING_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        logInfo('Recuperando ' + arr.length + ' pending updates del disco');
        estado.pendingUpdates = arr;
      }
      // Borrar archivo despues de cargar
      fs.unlinkSync(estado.PENDING_FILE);
    }
  } catch (e) {
    logError('Error cargando pending del disco: ' + e.message);
  }
}

// ============================================================
// Enviar update al dashboard (con cola)
// ============================================================
async function sendUpdateToDashboard(data, peticionId) {
  const isReinicio = (data._endpoint === 'reinicio');

  if (!estado.mainWindow || estado.mainWindow.isDestroyed() || !estado.dashboardReady) {
    estado.pendingUpdates.push({ data, peticionId });
    savePendingToDisk();
    marcarPeticionEncolada(peticionId);
    return;
  }

  // REGLA REINICIO: si el modal ganador esta activo Y el reinicio es del
  // MISMO sheet del ganador, encolar. Si es de OTRO sheet, procesar
  // inmediatamente (actualiza el otro odometro mientras el modal sigue).
  // Lamentablemente, main.js no sabe que sheet esta en el modal: solo
  // sabe que hay ganador. Por eso le pasamos la info y el dashboard
  // decide. Aqui solo encolamos si NO esta listo. La decision fina
  // (mismo sheet o no) la hace el dashboard.
  if (isReinicio) {
    // El dashboard tiene la logica para decidir si aplicar inmediatamente
    // o postergar. Pasamos siempre directo si esta listo.
    // El unico bloqueo aqui: si dashboard no esta listo, encolar (ya cubierto arriba).
    const dataJson = JSON.stringify(data).replace(/</g, '\\u003c');
    const code = `
      if (window.casinoUpdate) {
        window.casinoUpdate(${dataJson});
      }
      return 'sent';
    `;
    const result = await safeExecJs(code);
    if (result === 'sent' && peticionId) {
      marcarPeticionProcesada(peticionId);
    }
    return;
  }

  // FLUJO ORIGINAL (update normal)
  // Con un modal de ganador en pantalla se encola TODO, incluidos los
  // ganadores nuevos: cada ganador debe completar su tiempo en pantalla
  // antes de que se muestre el siguiente. La cola se procesa al cerrar
  // el modal ('Ganador termino, procesando cola').
  if (estado.isWinnerActive || estado.winnerDespachado || estado.flushProgramado) {
    if (data.ganador === true) {
      logInfo('Ganador encolado (otro ganador en pantalla): ' + data.sheet +
              ' maquina ' + data.maquina + ' (peticion ' + peticionId + ')');
    }
    estado.pendingUpdates.push({ data, peticionId });
    savePendingToDisk();
    marcarPeticionEncolada(peticionId);
    return;
  }

  // Un video promo NO detiene al ganador: el dashboard cierra el video
  // apenas llega el ganador (js/ganador.js) y el modal sale en su turno.

  // Desde aca el ganador ocupa la pantalla, aunque el modal todavia no abrio.
  if (data.ganador === true) {
    estado.winnerDespachado = true;
    estado.winnerDespachadoAt = Date.now();

    // Recien ahora queda esperando confirmSubida: este es el que se va a ver.
    // Si quedo alguno sin resolver del turno anterior, se cierra como timeout.
    if (estado.ganadorPendiente) {
      logWarn('Ganador anterior sin resolver al despachar el siguiente' + textoPendiente() + ' -> estado=2');
      resolverAcreditado(2, estado.iasDetalleTimeout);
    }
    if (data._refGanador) {
      estado.ganadorPendiente = data._refGanador;
      logInfo('Ganador en pantalla esperando confirmSubida: maquina ' +
              estado.ganadorPendiente.codMaquina + ' (peticion ' + estado.ganadorPendiente.peticionId + ')');
    }
  }

  // _refGanador es interno del servidor, no viaja al dashboard.
  const dataParaDashboard = Object.assign({}, data);
  delete dataParaDashboard._refGanador;

  const dataJson = JSON.stringify(dataParaDashboard).replace(/</g, '\\u003c');
  const code = `
    if (window.casinoUpdate) {
      window.casinoUpdate(${dataJson});
    }
    return 'sent';
  `;

  const result = await safeExecJs(code);
  if (result === 'sent' && peticionId) {
    marcarPeticionProcesada(peticionId);
  }
}

// ============================================================
// Procesar cola
// ============================================================
function flushPendingUpdates() {
  if (estado.pendingUpdates.length === 0) return;
  logInfo('Procesando ' + estado.pendingUpdates.length + ' updates encolados');

  const updates = estado.pendingUpdates.slice();
  estado.pendingUpdates = [];
  savePendingToDisk();  // limpiar archivo tambien

  // Se libera UN SOLO ganador por vez: si en la cola hay mas de uno, el resto
  // vuelve a la cola y sale cuando cierre este modal. Asi cada ganador
  // completa su tiempo en pantalla.
  let ganadorLiberado = false;
  const restantes = [];

  updates.forEach(item => {
    const d = item.data ? item.data : item;
    const pid = item.data ? item.peticionId : null;

    if (ganadorLiberado) {
      restantes.push(item);
      return;
    }

    sendUpdateToDashboard(d, pid);
    if (d && d.ganador === true) ganadorLiberado = true;
  });

  // pendingUpdates puede tener items que sendUpdateToDashboard volvio a
  // encolar dentro del loop (dashboard no listo). Esos son ANTERIORES a
  // 'restantes', asi que van primero para no invertir el orden.
  if (restantes.length > 0) {
    logInfo('Quedan ' + restantes.length + ' updates en cola (hay un ganador en pantalla)');
    estado.pendingUpdates = estado.pendingUpdates.concat(restantes);
    savePendingToDisk();
  }
}
