// ============================================================
// Lectura de config.json
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { loadConfig, loadConfigBase };

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================================
// CONFIG
// ============================================================
// config.json (base) + config-local.json (lo editado desde el dashboard con Ctrl+Shift+P)
function loadConfig() {
  const base = loadConfigBase();
  const { leerConfigLocal } = require('./tema');
  return Object.assign({}, base, leerConfigLocal());
}

// Solo config.json (o los valores por defecto si no existe)
function loadConfigBase() {
  // En empaquetado, config.json viene como extraResource fuera del asar
  const configPath = app.isPackaged
    ? path.join(process.resourcesPath, 'config.json')
    : path.join(__dirname, '..', 'config.json');  // raiz del proyecto (este archivo esta en src/)
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('[CONFIG] Error:', e.message);
    }
  }
  return {
    windowMode: 'window',
    promoIntervalSec: 30, promoDurationSec: 8, homeViewDurationSec: 60,
    sheetDurationsSec: { mini: 8, minor: 8, major: 8, grand: 8 },
    kpiSpeed: 1.0, useTestData: true, winnerDelaySec: 5, winnerModalDurationSec: 12,
    modalVideoVolume: 0.7, httpPort: 3000, cleanupIntervalMin: 60,
    memoryReloadMB: 300, reloadCheckIntervalSec: 60,
    iasEnabled: false, iasBaseUrl: '', iasRetryIntervalSec: 30,
    confirmMinDisplaySec: 8,
    msgAcreditadoOk: 'Maquina acreditada correctamente',
    msgAcreditadoError: 'error al acreditar, verifique con el administrador',
    detalleAcreditadoTimeout: 'no se envio acreditacion(no confirmaron)',
    msgSinConfirmacion: 'No se ha recibido confirmacion para la acreditacion'
  };
}
