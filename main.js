const { BrowserWindow, app, globalShortcut } = require('electron');
const fs = require('fs');
const estado = require('./src/estado');
const { initPaths } = require('./src/rutas');
const { cleanOldLogs, logInfo, logWarn, logError } = require('./src/logger');
const { initDatabase } = require('./src/db');
const { hayGanadorEnCurso, savePendingToDisk } = require('./src/cola-ganadores');
const { createWindow } = require('./src/ventana');

// ============================================================
// FLAGS Electron - autoplay + optimizaciones de CPU/GPU
// ============================================================
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies,AutoplayIgnoreWebAudio');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// --- Forzar uso de GPU dedicada NVIDIA (no integrada/software) ---
// IMPORTANTE: en Windows con NVIDIA, sin estos flags Electron suele
// caer a render por software y los videos se trabarian.
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

// ============================================================
// UNA SOLA INSTANCIA
// Si la app ya esta abierta (arranque automatico + doble clic, por
// ejemplo), la segunda copia se cierra sin tocar nada: no tomaria el
// puerto HTTP y quedarian dos pantallas compitiendo por la DB.
// En su lugar se trae al frente la ventana que ya esta abierta.
// ============================================================
const esPrimeraInstancia = app.requestSingleInstanceLock();
if (!esPrimeraInstancia) {
  app.quit();
} else {
  app.on('second-instance', () => {
    logInfo('Se intento abrir otra copia de la app: se muestra la que ya esta abierta');
    const win = estado.mainWindow;
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

// ============================================================
// LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
  // la segunda copia ya pidio cerrarse: no inicia DB, servidor ni ventana
  if (!esPrimeraInstancia) return;

  // CRITICAL: inicializar rutas userData ANTES de cualquier cosa
  initPaths();

  // Limpiar logs viejos al iniciar
  cleanOldLogs();

  // Iniciar DB (espera a que termine antes de continuar)
  await initDatabase();

  logInfo('============================================================');
  logInfo('Casino Dashboard iniciado');
  logInfo('============================================================');

  createWindow();

  globalShortcut.register('Ctrl+Shift+Q', () => {
    logInfo('App cerrada por usuario');
    app.quit();
  });

  globalShortcut.register('Ctrl+Shift+R', () => {
    if (estado.mainWindow && !hayGanadorEnCurso()) {
      logInfo('Reload manual por usuario');
      estado.dashboardReady = false;
      savePendingToDisk();
      estado.mainWindow.reload();
    } else {
      logWarn('Reload manual OMITIDO (ganador en curso, intente de nuevo al terminar)');
    }
  });

  // Ctrl+Shift+K: alternar entre kiosko y ventana en caliente
  // (no reinicia la app, solo cambia la ventana)
  globalShortcut.register('Ctrl+Shift+K', () => {
    if (!estado.mainWindow || estado.mainWindow.isDestroyed()) return;

    const ahoraEsKiosko = estado.mainWindow.isKiosk();

    if (ahoraEsKiosko) {
      // pasar a modo ventana
      estado.mainWindow.setKiosk(false);
      estado.mainWindow.setFullScreen(false);
      logInfo('Modo cambiado a VENTANA (con barra de titulo)');
    } else {
      // pasar a modo kiosko
      estado.mainWindow.setKiosk(true);
      estado.mainWindow.setFullScreen(true);
      logInfo('Modo cambiado a KIOSKO (pantalla completa)');
    }
  });
});

app.on('window-all-closed', () => {
  // Forzar guardar DB antes de cerrar
  if (estado.db && estado.dbReady) {
    try {
      if (estado.dbSaveTimeout) clearTimeout(estado.dbSaveTimeout);
      const data = estado.db.export();
      fs.writeFileSync(estado.DB_PATH, Buffer.from(data));
      estado.db.close();
      logInfo('DB cerrada y guardada antes de salir');
    } catch (e) {
      logError('Error cerrando DB: ' + e.message);
    }
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (err) => {
  logError('UNCAUGHT: ' + err.message + '\n' + err.stack);
});

process.on('unhandledRejection', (reason) => {
  logError('REJECTION: ' + reason);
});
