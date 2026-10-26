// ============================================================
// Envio de ganadores y acreditaciones al servidor IAS (con reintentos)
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { enviarAcreditadoAIas, reintentarAcreditadosIAS, enviarGanadorAIas, reintentarPendientesIAS };

const estado = require('./estado');
const { mapearPozo, formatearFechaGanador } = require('./utilidades');
const { logInfo, logWarn, logError } = require('./logger');
const { marcarAcreditadoEnviadoIAS, marcarGanadorEnviadoIAS } = require('./db');

// esReintento: true cuando lo llama el timer de reintentos (no repite el body en el log).
async function enviarAcreditadoAIas(peticionId, info, esReintento) {
  const marca = esReintento ? ' (reintento)' : '';
  if (!estado.iasConfig || !estado.iasConfig.iasEnabled || !estado.iasConfig.iasBaseUrl) {
    return false;
  }
  const url = estado.iasConfig.iasBaseUrl.replace(/\/+$/, '') + '/PraGanadores/ActualizarEstadoAcreditado';
  // Body tal cual lo espera el IAS externo (camelCase). codSala va como texto.
  const body = {
    idRace: info.idRace,
    codSala: info.codSala,
    codMaquina: info.codMaquina,
    estadoAcreditado: info.estadoAcreditado,
    detalle: info.detalle || ''
  };

  if (!esReintento) {
    logInfo('IAS acreditado ENVIA id=' + peticionId + ' -> POST ' + url +
      ' | body: ' + JSON.stringify(body));
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const respText = await resp.text().catch(() => '');
      marcarAcreditadoEnviadoIAS(peticionId);
      logInfo('IAS acreditado OK' + marca + ' ' + resp.status + ' id=' + peticionId +
        ' estado=' + info.estadoAcreditado +
        ' | respuesta: ' + (respText.substring(0, 500) || '(vacio)'));
      return true;
    } else {
      const txt = await resp.text().catch(() => '');
      logWarn('IAS acreditado FAIL' + marca + ' ' + resp.status + ' id=' + peticionId + ': ' + txt.substring(0, 500));
      return false;
    }
  } catch (e) {
    logWarn('IAS acreditado ERROR' + marca + ' id=' + peticionId + ': ' + e.message);
    return false;
  }
}

function reintentarAcreditadosIAS() {
  if (!estado.db || !estado.dbReady) return;
  if (!estado.iasConfig || !estado.iasConfig.iasEnabled) return;
  try {
    const stmt = estado.db.prepare(`
      SELECT id, id_race AS idRace, cod_sala AS codSala, maquina AS codMaquina,
             acreditado_estado AS estadoAcreditado, acreditado_detalle AS detalle
      FROM peticiones
      WHERE ganador = 1 AND acreditado_estado IS NOT NULL AND acreditado_enviado = 0
      ORDER BY id
      LIMIT 50
    `);
    const filas = [];
    while (stmt.step()) { filas.push(stmt.getAsObject()); }
    stmt.free();
    if (filas.length === 0) return;
    logInfo('IAS retry acreditados: ' + filas.length + ' pendientes');
    filas.forEach(fila => {
      enviarAcreditadoAIas(fila.id, {
        idRace: fila.idRace,
        codSala: fila.codSala,
        codMaquina: fila.codMaquina,
        estadoAcreditado: fila.estadoAcreditado,
        detalle: fila.detalle
      }, true);
    });
  } catch (e) {
    logError('Error en reintentarAcreditadosIAS: ' + e.message);
  }
}

// esReintento: true cuando lo llama el timer de reintentos (no repite el body en el log).
async function enviarGanadorAIas(peticionId, data, fechaRegistro, esReintento) {
  const marca = esReintento ? ' (reintento)' : '';
  // Verificar config
  if (!estado.iasConfig || !estado.iasConfig.iasEnabled || !estado.iasConfig.iasBaseUrl) {
    return false;
  }

  const url = estado.iasConfig.iasBaseUrl.replace(/\/+$/, '') + '/PraGanadores/CrearGanador';
  const body = {
    IdRace: data.idRace,
    CodSala: data.codSala,       // string como nosotros lo tenemos
    CodMaquina: data.maquina,    // string como nosotros lo tenemos
    Posicion: (typeof data.posicion === 'number') ? data.posicion : 0,
    Monto: data.amount || 0,
    Pozo: mapearPozo(data.sheet),
    FechaGanador: formatearFechaGanador(fechaRegistro)
  };

  estado.iasStats.ultimoIntento = new Date().toISOString();

  if (!esReintento) {
    logInfo('IAS ganador ENVIA id=' + peticionId + ' -> POST ' + url +
      ' | body: ' + JSON.stringify(body));
  }

  try {
    // fetch nativo de Node 18+ (Electron 28+ ya lo tiene)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const respText = await resp.text().catch(() => '');
      marcarGanadorEnviadoIAS(peticionId);
      estado.iasStats.ultimoExito = new Date().toISOString();
      estado.iasStats.totalEnviados++;
      logInfo('IAS OK' + marca + ' ' + resp.status + ': ganador id=' + peticionId +
        ' sheet=' + data.sheet +
        ' | respuesta: ' + (respText.substring(0, 500) || '(vacio)'));
      return true;
    } else {
      const txt = await resp.text().catch(() => '');
      estado.iasStats.ultimoError = 'HTTP ' + resp.status + ' - ' + txt.substring(0, 200);
      estado.iasStats.totalErrores++;
      logWarn('IAS FAIL' + marca + ' ' + resp.status + ' id=' + peticionId + ': ' + txt.substring(0, 500));
      return false;
    }
  } catch (e) {
    estado.iasStats.ultimoError = e.message;
    estado.iasStats.totalErrores++;
    logWarn('IAS ERROR' + marca + ' id=' + peticionId + ': ' + e.message);
    return false;
  }
}

function reintentarPendientesIAS() {
  if (!estado.db || !estado.dbReady) return;
  if (!estado.iasConfig || !estado.iasConfig.iasEnabled) return;

  try {
    const stmt = estado.db.prepare(`
      SELECT id, sheet, amount, maquina, posicion, cod_sala AS codSala, id_race AS idRace, fecha_registro
      FROM peticiones
      WHERE ganador = 1 AND enviado_externo = 0
      ORDER BY id
      LIMIT 50
    `);
    const filas = [];
    while (stmt.step()) {
      filas.push(stmt.getAsObject());
    }
    stmt.free();

    if (filas.length === 0) return;

    logInfo('IAS retry: ' + filas.length + ' ganadores pendientes');

    // Enviar uno por uno (secuencial para no saturar)
    filas.forEach(fila => {
      enviarGanadorAIas(fila.id, {
        sheet: fila.sheet,
        amount: fila.amount,
        maquina: fila.maquina,
        posicion: fila.posicion,
        codSala: fila.codSala,
        idRace: fila.idRace
      }, fila.fecha_registro, true);
    });
  } catch (e) {
    logError('Error en reintentarPendientesIAS: ' + e.message);
  }
}
