// ============================================================
// Logger a archivo con rotacion diaria
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { getLogFilePath, logToFile, logInfo, logWarn, logError, cleanOldLogs };

const path = require('path');
const fs = require('fs');
const estado = require('./estado');
const { fechaLocalISO } = require('./utilidades');

// ============================================================
// LOGGER: escribe a archivo en disco con rotacion diaria
// Solo loggea errores y eventos importantes, NO debug normal
// ============================================================

function getLogFilePath(fecha) {
  const d = fecha || new Date();
  const filename = 'dashboard-' + d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + '.log';
  return path.join(estado.LOGS_DIR, filename);
}

function logToFile(level, message) {
  const timestamp = fechaLocalISO();
  const line = `[${timestamp}] [${level}] ${message}\n`;

  try {
    fs.appendFileSync(getLogFilePath(), line);
  } catch (e) {
    // Si falla escribir, al menos consola
    console.error('[LOGGER] Error escribiendo log:', e.message);
  }

  // Tambien mostrar errores en consola
  if (level === 'ERROR' || level === 'WARN') {
    console.error(line.trim());
  }
}

function logInfo(msg) { logToFile('INFO', msg); }
function logWarn(msg) { logToFile('WARN', msg); }
function logError(msg) { logToFile('ERROR', msg); }

// Limpiar logs viejos (mantener ultimos 7 dias)
function cleanOldLogs() {
  try {
    const files = fs.readdirSync(estado.LOGS_DIR);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7 dias

    files.forEach(f => {
      if (f.startsWith('dashboard-') && f.endsWith('.log')) {
        const fpath = path.join(estado.LOGS_DIR, f);
        const stats = fs.statSync(fpath);
        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(fpath);
          logInfo('Log viejo eliminado: ' + f);
        }
      }
    });
  } catch (e) {
    logError('Error limpiando logs: ' + e.message);
  }
}
