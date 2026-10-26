// ============================================================
// Ventana principal de Electron y ejecucion de JS en el dashboard
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { safeExecJs, createWindow };

const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const estado = require('./estado');
const { loadConfig } = require('./config');
const { logError, logWarn, logInfo } = require('./logger');
const { loadPendingFromDisk, flushPendingUpdates } = require('./cola-ganadores');
const { startHttpServer } = require('./servidor-http');
const { startWatchdog } = require('./watchdog');

// ============================================================
// EJECUTAR JS SEGURO (evita IPC clone errors)
// ============================================================
async function safeExecJs(jsCode) {
  if (!estado.mainWindow || estado.mainWindow.isDestroyed()) return null;
  try {
    const wrappedCode = `
      (function() {
        try {
          ${jsCode}
        } catch(e) {
          return 'ERROR: ' + e.message;
        }
      })();
    `;
    const result = await estado.mainWindow.webContents.executeJavaScript(wrappedCode);
    if (result === undefined || result === null) return null;
    if (typeof result === 'string') return result;
    if (typeof result === 'number' || typeof result === 'boolean') return String(result);
    return JSON.stringify(result);
  } catch (err) {
    logError('safeExecJs: ' + err.message);
    return null;
  }
}

// ============================================================
// Crear ventana
// ============================================================
function createWindow() {
  const config = loadConfig();

  // ============================================================
  // MODO DE VENTANA: 'kiosk' (pantalla completa sin bordes)
  //                  'window' (con barra de titulo, movible)
  // Por defecto es 'window' para poder mover entre pantallas.
  // Se puede cambiar editando config.json o con Ctrl+Shift+K en caliente.
  // ============================================================
  const isKiosk = (config.windowMode === 'kiosk');

  // URL base del servidor HTTP interno. Sale del config:
  // apiBaseUrl si esta definido, si no http://127.0.0.1:<httpPort>.
  // Va por query string en loadFile (para los fetch que corren al cargar
  // el HTML) y tambien como window.CASINO_API en did-finish-load.
  const apiBaseUrl = config.apiBaseUrl || ('http://127.0.0.1:' + (config.httpPort || 3000));

  estado.mainWindow = new BrowserWindow({
    fullscreen: isKiosk,
    autoHideMenuBar: true,
    frame: !isKiosk,           // sin frame en kiosko, con frame en ventana
    kiosk: isKiosk,
    width: 1600,                // tamaño inicial cuando es ventana
    height: 900,
    minWidth: 900,              // mínimo para que entre en 14"
    minHeight: 550,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    },
    backgroundColor: '#0a0004'
  });

  // Al redimensionar NO se recarga: el dashboard se reajusta solo
  // (listener 'resize' en js/principal.js reconstruye el escudo,
  // invalida los caches y reposiciona los pozos).

  estado.mainWindow.webContents.on('did-finish-load', async () => {
    // ============================================================
    // DIAGNOSTICO GPU: escribe gpu-info.txt al iniciar
    // (esto se ejecuta una sola vez al cargar el dashboard)
    // ============================================================
    try {
      const gpuFeatures = app.getGPUFeatureStatus();
      const gpuInfo = await app.getGPUInfo('complete');

      // Tambien obtener info desde el renderer (lo que ve el HTML)
      const rendererInfoStr = await safeExecJs(`
        try {
          const c = document.createElement('canvas');
          const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
          if (!gl) {
            return JSON.stringify({ error: 'WebGL no disponible' });
          }
          const ext = gl.getExtension('WEBGL_debug_renderer_info');
          return JSON.stringify({
            renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'extension no disponible',
            vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'extension no disponible',
            version: gl.getParameter(gl.VERSION),
            shadingVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE)
          });
        } catch(e) { return JSON.stringify({ error: e.message }); }
      `);

      const report = [
        '============================================================',
        'DIAGNOSTICO GPU DE ELECTRON',
        'Fecha: ' + new Date().toISOString(),
        '============================================================',
        '',
        '--- Graphics Feature Status (lo mas importante) ---',
        JSON.stringify(gpuFeatures, null, 2),
        '',
        '--- GPU Info desde el RENDERER (lo que ve el HTML) ---',
        rendererInfoStr || '(no se pudo obtener)',
        '',
        '--- GPU Info COMPLETA (auxgpus, vendor ids, etc) ---',
        JSON.stringify(gpuInfo, null, 2),
        ''
      ].join('\n');

      fs.writeFileSync(path.join(estado.USER_DATA_DIR, 'gpu-info.txt'), report);
      logInfo('Diagnostico GPU escrito en gpu-info.txt');
      console.log('[GPU] Diagnostico escrito en gpu-info.txt');
    } catch (e) {
      logError('Error escribiendo diagnostico GPU: ' + e.message);
    }

    // ============================================================
    // MEDIDOR FPS automatico: mide 30s, escribe fps-info.txt
    // ============================================================
    setTimeout(async () => {
      logInfo('Iniciando medicion de FPS por 30 segundos...');
      const fpsResultStr = await safeExecJs(`
        return new Promise(resolve => {
          let fpsList = [];
          let lastTime = performance.now();
          let frames = 0;
          let collecting = true;
          
          function measureFPS() {
            if (!collecting) return;
            frames++;
            const now = performance.now();
            if (now - lastTime >= 1000) {
              fpsList.push(Math.round(frames * 1000 / (now - lastTime)));
              frames = 0;
              lastTime = now;
            }
            requestAnimationFrame(measureFPS);
          }
          measureFPS();
          
          setTimeout(() => {
            collecting = false;
            const sum = fpsList.reduce((a,b) => a+b, 0);
            resolve(JSON.stringify({
              fpsBySecond: fpsList,
              promedio: Math.round(sum / fpsList.length),
              minimo: Math.min.apply(null, fpsList),
              maximo: Math.max.apply(null, fpsList),
              segundos: fpsList.length
            }));
          }, 30000);
        });
      `);

      try {
        const fpsReport = [
          '============================================================',
          'MEDICION DE FPS DEL DASHBOARD',
          'Fecha: ' + new Date().toISOString(),
          'Duracion: 30 segundos',
          '============================================================',
          '',
          fpsResultStr || '(no se pudo medir)',
          ''
        ].join('\n');
        fs.writeFileSync(path.join(estado.USER_DATA_DIR, 'fps-info.txt'), fpsReport);
        logInfo('Medicion FPS escrita en fps-info.txt');
        console.log('[FPS] Medicion escrita en fps-info.txt');
      } catch (e) {
        logError('Error escribiendo FPS: ' + e.message);
      }
    }, 3000);

    // se relee en cada carga: asi un reload toma la config editada desde el dashboard
    const configJson = JSON.stringify(loadConfig());

    // Escanear carpeta promos/ y obtener lista de webm
    // En empaquetado promos/ viene como extraResource fuera del asar
    const promosDir = app.isPackaged
      ? path.join(process.resourcesPath, 'promos')
      : path.join(__dirname, '..', 'promos');  // raiz del proyecto (este archivo esta en src/)
    let promoFiles = [];
    if (fs.existsSync(promosDir)) {
      try {
        promoFiles = fs.readdirSync(promosDir)
          .filter(f => f.toLowerCase().endsWith('.webm') || f.toLowerCase().endsWith('.mp4'))
          .sort();
        logInfo('Videos promo encontrados: ' + promoFiles.length + ' - ' + promoFiles.join(', '));
      } catch (e) {
        logError('Error leyendo carpeta promos: ' + e.message);
      }
    } else {
      logWarn('Carpeta promos/ no existe - crear y poner videos .mp4 dentro');
    }

    const promosJson = JSON.stringify(promoFiles);
    // Ruta absoluta de promos para construir URLs file:// correctas
    // (cuando esta empaquetado, promos esta en resources/, no en el asar)
    const promosBaseUrl = 'file:///' + promosDir.replace(/\\/g, '/') + '/';

    await safeExecJs(`
      window.CASINO_CONFIG = ${configJson};
      window.CASINO_API = ${JSON.stringify(apiBaseUrl)};
      window.PROMO_FILES = ${promosJson};
      window.PROMO_BASE_URL = ${JSON.stringify(promosBaseUrl)};
      // Desactivar console.log en produccion para no acumular memoria
      if (!window.CASINO_CONFIG.useTestData) {
        const origLog = console.log;
        const origInfo = console.info;
        console.log = function() {};
        console.info = function() {};
        // Mantener console.error y console.warn para debug
        window.__origLog = origLog;
      }
      if (window.CASINO_CONFIG && !window.CASINO_CONFIG.useTestData) {
        if (document.body) document.body.classList.add('production-mode');
      }
      // Construir videos promo dinamicamente desde PROMO_FILES
      if (window.PROMO_FILES && window.PROMO_FILES.length > 0) {
        const container = document.getElementById('promoVideosContainer');
        // si una recarga cae mientras corre este bloque de la carga anterior, se ejecuta dos
        // veces sobre la misma pagina: no duplicar los videos
        if (container && !container.querySelector('.promo-video')) {
          window.PROMO_FILES.forEach(filename => {
            const video = document.createElement('video');
            video.className = 'promo-video';
            video.dataset.name = filename.replace(/\\.(webm|mp4)$/i, '');
            video.muted = true;
            video.loop = false;
            video.playsInline = true;
            video.preload = 'metadata';
            const source = document.createElement('source');
            source.src = (window.PROMO_BASE_URL || 'promos/') + filename;
            source.type = filename.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
            video.appendChild(source);
            container.appendChild(video);
          });
          console.warn('[PROMO] Cargados', window.PROMO_FILES.length, 'videos desde carpeta promos/');
        }
      }
      return 'config-applied';
    `);

    estado.dashboardReady = true;
    logInfo('Dashboard listo');

    if (!global.serversStarted) {
      global.serversStarted = true;
      startWatchdog(config);
    }

    // Procesar la cola AL TOQUE (sin esperar), y despues de cargar lo del
    // disco. Si se espera, un ganador nuevo que llega en ese lapso sale
    // antes que los que ya estaban en la cola (se invierte el orden).
    // Todo esto corre seguido, sin que pueda entrar un request en el medio.
    flushPendingUpdates();
  });

  // El servidor HTTP arranca ANTES de cargar la pantalla: el dashboard pide
  // /status y /sprite-config apenas carga. Lo que llegue antes de que la
  // pantalla este lista se encola (dashboardReady=false) y sale en el flush
  // de did-finish-load. La cola del disco se carga antes de aceptar requests
  // para no invertir el orden de los ganadores.
  if (!global.httpStarted) {
    global.httpStarted = true;
    loadPendingFromDisk();   // recuperar pending del reload anterior
    startHttpServer(config);
  }

  estado.mainWindow.loadFile('dashboard.html', { query: { api: apiBaseUrl } });
}
