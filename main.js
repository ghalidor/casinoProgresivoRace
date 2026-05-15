const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

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
// CONFIG
// ============================================================
function loadConfig() {
  // En empaquetado, config.json viene como extraResource fuera del asar
  const configPath = app.isPackaged
    ? path.join(process.resourcesPath, 'config.json')
    : path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('[CONFIG] Error:', e.message);
    }
  }
  return {
    promoIntervalSec: 30, promoDurationSec: 8, homeViewDurationSec: 60,
    sheetDurationsSec: { mini: 8, minor: 8, major: 8, grand: 8 },
    kpiSpeed: 1.0, useTestData: true, winnerDelaySec: 5, winnerModalDurationSec: 12,
    modalVideoVolume: 0.7, httpPort: 3000, cleanupIntervalMin: 60,
    memoryReloadMB: 300, reloadCheckIntervalSec: 60
  };
}

let mainWindow;
let isWinnerActive = false;
let isPromoActive = false;
let pendingUpdates = [];
let dashboardReady = false;

// ============================================================
// RUTAS: separar lectura (empaquetadas) de escritura (userData)
// __dirname dentro de app.asar es de SOLO LECTURA, por eso
// los archivos que la app escribe (logs, db, pending) van a userData.
// IMPORTANTE: las rutas se inicializan en app.whenReady() porque
// app.getPath('userData') puede fallar antes de eso.
// ============================================================
let USER_DATA_DIR = null;
let PENDING_FILE = null;
let LOGS_DIR = null;
let DB_PATH = null;

function initPaths() {
  USER_DATA_DIR = app.getPath('userData');
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  
  PENDING_FILE = path.join(USER_DATA_DIR, 'pending-updates.json');
  LOGS_DIR = path.join(USER_DATA_DIR, 'logs');
  DB_PATH = path.join(USER_DATA_DIR, 'dashboard.db');
  
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// ============================================================
// LOGGER: escribe a archivo en disco con rotacion diaria
// Solo loggea errores y eventos importantes, NO debug normal
// ============================================================

function getLogFilePath() {
  const d = new Date();
  const filename = 'dashboard-' + d.getFullYear() + '-' + 
    String(d.getMonth()+1).padStart(2,'0') + '-' + 
    String(d.getDate()).padStart(2,'0') + '.log';
  return path.join(LOGS_DIR, filename);
}

function logToFile(level, message) {
  const timestamp = new Date().toISOString();
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
    const files = fs.readdirSync(LOGS_DIR);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000;  // 7 dias
    
    files.forEach(f => {
      if (f.startsWith('dashboard-') && f.endsWith('.log')) {
        const fpath = path.join(LOGS_DIR, f);
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

// ============================================================
// SQLITE: guardar todas las peticiones que entran
// ============================================================
let db = null;
let dbReady = false;
let dbSaveTimeout = null;
let nextPeticionId = 1;
let nextEventoId = 1;

// Guardar DB a disco con debounce (no cada vez que escribimos, sino cada 2s)
function scheduleDbSave() {
  if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
  dbSaveTimeout = setTimeout(() => {
    if (db) {
      try {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      } catch (e) {
        logError('Error guardando DB a disco: ' + e.message);
      }
    }
  }, 2000);
}

async function initDatabase() {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    
    // Cargar DB existente o crear nueva
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      logInfo('DB SQLite cargada desde: ' + DB_PATH);
    } else {
      db = new SQL.Database();
      logInfo('DB SQLite nueva creada');
    }
    
    // Crear tablas si no existen
    db.run(`
      CREATE TABLE IF NOT EXISTS peticiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sheet TEXT NOT NULL,
        amount REAL,
        ganador INTEGER DEFAULT 0,
        maquina TEXT,
        ip_origen TEXT,
        fecha_registro TEXT NOT NULL,
        procesado INTEGER DEFAULT 0,
        encolado INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        descripcion TEXT,
        memoria_mb INTEGER,
        fecha_registro TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_peticiones_fecha ON peticiones(fecha_registro);
      CREATE INDEX IF NOT EXISTS idx_peticiones_sheet ON peticiones(sheet);
      CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha_registro);
    `);
    
    // Obtener el proximo ID de peticiones
    const res = db.exec('SELECT MAX(id) as maxId FROM peticiones');
    if (res.length > 0 && res[0].values[0][0]) {
      nextPeticionId = res[0].values[0][0] + 1;
    }
    
    dbReady = true;
    scheduleDbSave();
    return true;
  } catch (e) {
    logError('Error iniciando DB: ' + e.message);
    console.error('[DB] Error - asegurate de tener sql.js instalado: npm install sql.js');
    return false;
  }
}

function guardarPeticion(data, ipOrigen, encolado = false) {
  if (!db || !dbReady) return null;
  try {
    const id = nextPeticionId++;
    const stmt = db.prepare(`
      INSERT INTO peticiones (id, sheet, amount, ganador, maquina, ip_origen, fecha_registro, encolado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      data.sheet,
      data.amount || null,
      data.ganador ? 1 : 0,
      data.maquina || null,
      ipOrigen || 'unknown',
      new Date().toISOString(),
      encolado ? 1 : 0
    ]);
    stmt.free();
    scheduleDbSave();
    return id;
  } catch (e) {
    logError('Error guardando peticion: ' + e.message);
    return null;
  }
}

function marcarPeticionProcesada(id) {
  if (!db || !dbReady || !id) return;
  try {
    const stmt = db.prepare('UPDATE peticiones SET procesado = 1 WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando procesada: ' + e.message);
  }
}

function marcarPeticionEncolada(id) {
  if (!db || !dbReady || !id) return;
  try {
    const stmt = db.prepare('UPDATE peticiones SET encolado = 1 WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando encolada: ' + e.message);
  }
}

function guardarEvento(tipo, descripcion, memoriaMB = null) {
  if (!db || !dbReady) return;
  try {
    const stmt = db.prepare(`
      INSERT INTO eventos (tipo, descripcion, memoria_mb, fecha_registro)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([tipo, descripcion, memoriaMB, new Date().toISOString()]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error guardando evento: ' + e.message);
  }
}

// Helper para queries que retornan rows
function queryRows(sql, params = []) {
  if (!db || !dbReady) return [];
  try {
    const stmt = db.prepare(sql);
    const rows = [];
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  } catch (e) {
    logError('Error en query: ' + e.message);
    return [];
  }
}

// ============================================================
// PERSISTIR cola de pending al disco (sobrevive reload)
// ============================================================
function savePendingToDisk() {
  try {
    fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingUpdates), 'utf-8');
  } catch (e) {
    logError('Error guardando pending al disco: ' + e.message);
  }
}

function loadPendingFromDisk() {
  try {
    if (fs.existsSync(PENDING_FILE)) {
      const raw = fs.readFileSync(PENDING_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        logInfo('Recuperando ' + arr.length + ' pending updates del disco');
        pendingUpdates = arr;
      }
      // Borrar archivo despues de cargar
      fs.unlinkSync(PENDING_FILE);
    }
  } catch (e) {
    logError('Error cargando pending del disco: ' + e.message);
  }
}

// ============================================================
// EJECUTAR JS SEGURO (evita IPC clone errors)
// ============================================================
async function safeExecJs(jsCode) {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
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
    const result = await mainWindow.webContents.executeJavaScript(wrappedCode);
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
// SERVIDOR HTTP
// ============================================================
function startHttpServer(config) {
  const httpApp = express();
  httpApp.use(express.json());
  
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
    
    if (!data || !data.sheet) {
      return res.status(400).json({ error: 'sheet es requerido' });
    }
    if (!['mini','minor','major','grand'].includes(data.sheet)) {
      return res.status(400).json({ error: 'sheet debe ser: mini, minor, major o grand' });
    }
    
    // Guardar en SQLite ANTES de procesar (siempre se registra)
    const peticionId = guardarPeticion(data, ipOrigen, false);
    
    sendUpdateToDashboard(data, peticionId);
    
    res.json({ 
      ok: true, 
      peticionId: peticionId,
      dashboardReady: dashboardReady, 
      queueSize: pendingUpdates.length 
    });
  });
  
  httpApp.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      isWinnerActive: isWinnerActive,
      isPromoActive: isPromoActive,
      dashboardReady: dashboardReady,
      pendingUpdates: pendingUpdates.length,
      dbReady: dbReady
    });
  });
  
  httpApp.get('/status', (req, res) => {
    res.json({ 
      config: config,
      isWinnerActive: isWinnerActive,
      isPromoActive: isPromoActive,
      dashboardReady: dashboardReady,
      pendingUpdates: pendingUpdates 
    });
  });
  
  // Endpoint para ver el historial reciente
  httpApp.get('/history', (req, res) => {
    if (!db || !dbReady) return res.json({ error: 'DB no disponible' });
    try {
      const limit = parseInt(req.query.limit) || 50;
      const rows = queryRows('SELECT * FROM peticiones ORDER BY id DESC LIMIT ?', [limit]);
      res.json({ count: rows.length, peticiones: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  
  // Estadisticas por hoja
  httpApp.get('/stats', (req, res) => {
    if (!db || !dbReady) return res.json({ error: 'DB no disponible' });
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
  
  httpApp.listen(config.httpPort, '0.0.0.0', () => {
    logInfo('Servidor HTTP en puerto ' + config.httpPort);
    console.log('[HTTP] POST http://localhost:' + config.httpPort + '/update');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/health');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/status');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/history?limit=50');
    console.log('[HTTP] GET  http://localhost:' + config.httpPort + '/stats');
  });
}

// ============================================================
// Enviar update al dashboard (con cola)
// ============================================================
async function sendUpdateToDashboard(data, peticionId) {
  if (!mainWindow || mainWindow.isDestroyed() || !dashboardReady) {
    pendingUpdates.push({ data, peticionId });
    savePendingToDisk();
    marcarPeticionEncolada(peticionId);
    return;
  }
  
  if (isWinnerActive && data.ganador !== true) {
    pendingUpdates.push({ data, peticionId });
    savePendingToDisk();
    marcarPeticionEncolada(peticionId);
    return;
  }
  
  // Si hay PROMO activo Y este update ES de ganador, encolar
  // (asi el modal de ganador no interrumpe el video promo)
  if (isPromoActive && data.ganador === true) {
    logInfo('Ganador encolado (promo activo): ' + data.sheet);
    pendingUpdates.push({ data, peticionId });
    savePendingToDisk();
    marcarPeticionEncolada(peticionId);
    return;
  }
  
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
}

// ============================================================
// Procesar cola
// ============================================================
function flushPendingUpdates() {
  if (pendingUpdates.length === 0) return;
  logInfo('Procesando ' + pendingUpdates.length + ' updates encolados');
  
  const updates = pendingUpdates.slice();
  pendingUpdates = [];
  savePendingToDisk();  // limpiar archivo tambien
  
  updates.forEach(item => {
    if (item.data) {
      sendUpdateToDashboard(item.data, item.peticionId);
    } else {
      // formato antiguo sin peticionId
      sendUpdateToDashboard(item, null);
    }
  });
}

// ============================================================
// Crear ventana
// ============================================================
function createWindow() {
  const config = loadConfig();
  
  mainWindow = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    frame: false,
    kiosk: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false
    },
    backgroundColor: '#0a0004'
  });

  mainWindow.webContents.on('did-finish-load', async () => {
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
      
      fs.writeFileSync(path.join(USER_DATA_DIR, 'gpu-info.txt'), report);
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
        fs.writeFileSync(path.join(USER_DATA_DIR, 'fps-info.txt'), fpsReport);
        logInfo('Medicion FPS escrita en fps-info.txt');
        console.log('[FPS] Medicion escrita en fps-info.txt');
      } catch (e) {
        logError('Error escribiendo FPS: ' + e.message);
      }
    }, 3000);
    
    const configJson = JSON.stringify(config);
    
    // Escanear carpeta promos/ y obtener lista de webm
    // En empaquetado promos/ viene como extraResource fuera del asar
    const promosDir = app.isPackaged
      ? path.join(process.resourcesPath, 'promos')
      : path.join(__dirname, 'promos');
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
      logWarn('Carpeta promos/ no existe - crear y poner .webm dentro');
    }
    
    const promosJson = JSON.stringify(promoFiles);
    
    await safeExecJs(`
      window.CASINO_CONFIG = ${configJson};
      window.PROMO_FILES = ${promosJson};
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
        if (container) {
          window.PROMO_FILES.forEach(filename => {
            const video = document.createElement('video');
            video.className = 'promo-video';
            video.dataset.name = filename.replace(/\\.(webm|mp4)$/i, '');
            video.muted = true;
            video.loop = false;
            video.playsInline = true;
            video.preload = 'metadata';
            const source = document.createElement('source');
            source.src = 'promos/' + filename;
            source.type = filename.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
            video.appendChild(source);
            container.appendChild(video);
          });
          console.warn('[PROMO] Cargados', window.PROMO_FILES.length, 'videos desde carpeta promos/');
        }
      }
      return 'config-applied';
    `);
    
    dashboardReady = true;
    logInfo('Dashboard listo');
    setTimeout(flushPendingUpdates, 500);
    
    if (!global.serversStarted) {
      global.serversStarted = true;
      loadPendingFromDisk();   // recuperar pending del reload anterior
      startHttpServer(config);
      startWatchdog(config);
    }
  });

  mainWindow.loadFile('dashboard.html');
}

// ============================================================
// WATCHDOG con auto-reload por memoria
// ============================================================
function startWatchdog(config) {
  const reloadCheckMs = (config.reloadCheckIntervalSec || 60) * 1000;
  const memoryThresholdMB = config.memoryReloadMB || 300;
  
  // Watchdog principal cada 60s: revisar estado y memoria
  setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const statusStr = await safeExecJs(`
      return JSON.stringify({
        winner: !!document.querySelector('.winner-modal.showing'),
        promo: !!document.querySelector('.promo-video.showing'),
        memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0
      });
    `);
    
    if (!statusStr) return;
    
    let status;
    try { status = JSON.parse(statusStr); } catch(e) { return; }
    
    isWinnerActive = status.winner;
    isPromoActive = status.promo;
    
    // Guardar memoria a la DB cada hora
    if (Math.random() < 0.02) {  // ~1% probabilidad por check = ~1 vez por hora si check es cada 60s
      guardarEvento('memoria', 'Check de memoria', status.memMB);
    }
    
    // Si memoria pasa el umbral Y no hay ganador NI promo activo, hacer reload
    if (status.memMB > memoryThresholdMB && !status.winner && !status.promo && pendingUpdates.length === 0) {
      logWarn('Memoria > ' + memoryThresholdMB + 'MB (actual: ' + status.memMB + 'MB) - RELOAD automatico');
      guardarEvento('reload_auto', 'Memoria excedida: ' + status.memMB + 'MB', status.memMB);
      
      // Persistir pending updates al disco antes de reload
      savePendingToDisk();
      
      dashboardReady = false;
      mainWindow.reload();
    } else if (status.memMB > memoryThresholdMB) {
      logInfo('Memoria alta (' + status.memMB + 'MB) pero hay actividad - reload pospuesto');
    }
  }, reloadCheckMs);
  
  // Watchdog rapido (cada 5s) para sincronizar estado ganador + promo
  setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const statusStr = await safeExecJs(`
      return JSON.stringify({
        winner: !!document.querySelector('.winner-modal.showing'),
        promo: !!document.querySelector('.promo-video.showing')
      });
    `);
    
    if (statusStr === null) return;
    
    let status;
    try { status = JSON.parse(statusStr); } catch(e) { return; }
    
    const winnerActive = status.winner;
    const promoActive = status.promo;
    
    // Si termino ganador o promo, procesar cola
    if ((isWinnerActive && !winnerActive) || (isPromoActive && !promoActive)) {
      if (isWinnerActive && !winnerActive) logInfo('Ganador termino, procesando cola');
      if (isPromoActive && !promoActive) logInfo('Promo termino, procesando cola');
      isWinnerActive = winnerActive;
      isPromoActive = promoActive;
      flushPendingUpdates();
    } else {
      isWinnerActive = winnerActive;
      isPromoActive = promoActive;
    }
  }, 5 * 1000);  // mas rapido (era 30s) para detectar fin promo a tiempo
  
  // Limpieza de logs viejos cada 6 horas
  setInterval(cleanOldLogs, 6 * 60 * 60 * 1000);
  
  logInfo('Watchdog iniciado - reload si memoria > ' + memoryThresholdMB + 'MB');
}

// ============================================================
// LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
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
    if (mainWindow && !isWinnerActive) {
      logInfo('Reload manual por usuario');
      dashboardReady = false;
      savePendingToDisk();
      mainWindow.reload();
    } else {
      logWarn('Reload manual OMITIDO (ganador activo)');
    }
  });
});

app.on('window-all-closed', () => {
  // Forzar guardar DB antes de cerrar
  if (db && dbReady) {
    try {
      if (dbSaveTimeout) clearTimeout(dbSaveTimeout);
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      db.close();
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
