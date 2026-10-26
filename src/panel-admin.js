// ============================================================
// Helpers del panel admin (PIN local y log de ganadores)
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { esPedidoLocal, leerLogGanadores };

const fs = require('fs');
const { getLogFilePath, logError } = require('./logger');

// ============================================================
// PANEL ADMIN (se abre con Ctrl+Shift+C en la pantalla)
// ============================================================

// true si el pedido viene de esta misma maquina.
function esPedidoLocal(req) {
  const ip = (req.socket && req.socket.remoteAddress) || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Lineas del log que interesan en el panel: solo ganadores y confirmaciones.
const FILTRO_LOG_GANADORES = [
  'GANADOR recibido', 'Ganador encolado', 'Ganador en pantalla esperando',
  'Ganador anterior sin resolver', 'Ganador despachado pero', 'Sprite activo en',
  'IAS ganador ENVIA', 'IAS OK', 'IAS FAIL', 'IAS ERROR', 'IAS retry',
  'IAS acreditado', 'confirmSubida', 'Modal cerrado sin confirmSubida',
  '/update RECHAZADO'
];

// Lee el log de hoy y de ayer, filtra y devuelve lo mas nuevo primero.
function leerLogGanadores() {
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  let lineas = [];
  [ayer, hoy].forEach(fecha => {
    const ruta = getLogFilePath(fecha);
    if (!fs.existsSync(ruta)) return;
    try {
      fs.readFileSync(ruta, 'utf8').split(/\r?\n/).forEach(l => {
        if (l && FILTRO_LOG_GANADORES.some(f => l.includes(f))) lineas.push(l);
      });
    } catch (e) {
      logError('Panel admin: no se pudo leer ' + ruta + ': ' + e.message);
    }
  });
  return lineas.reverse().slice(0, 500);
}
