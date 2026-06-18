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
    windowMode: 'window',
    promoIntervalSec: 30, promoDurationSec: 8, homeViewDurationSec: 60,
    sheetDurationsSec: { mini: 8, minor: 8, major: 8, grand: 8 },
    kpiSpeed: 1.0, useTestData: true, winnerDelaySec: 5, winnerModalDurationSec: 12,
    modalVideoVolume: 0.7, httpPort: 3000, cleanupIntervalMin: 60,
    memoryReloadMB: 300, reloadCheckIntervalSec: 60,
    iasEnabled: false, iasBaseUrl: '', iasRetryIntervalSec: 30
  };
}

let mainWindow;
let isWinnerActive = false;
let isPromoActive = false;
let pendingUpdates = [];
let dashboardReady = false;
let iasConfig = null;
let iasRetryTimer = null;

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
// Limpieza de la BD: borrar peticiones y eventos de mas de 90 dias
// (retencion 3 meses). Solo borra registros ya procesados/enviados
// para no perder datos pendientes.
// ============================================================
function cleanOldDbData() {
  if (!db || !dbReady) return;
  try {
    // Fecha limite: hace 90 dias en formato ISO
    const limit = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Borrar peticiones de mas de 90 dias YA PROCESADAS o YA ENVIADAS al IAS
    // (no borramos las que aun estan pendientes para no perderlas)
    const stmt1 = db.prepare(
      "DELETE FROM peticiones WHERE fecha_registro < ? AND (procesado = 1 OR enviado_externo = 1 OR ganador = 0)"
    );
    stmt1.run([limit]);
    const peticionesBorradas = db.getRowsModified();
    stmt1.free();

    // Borrar eventos de mas de 90 dias (todos)
    const stmt2 = db.prepare('DELETE FROM eventos WHERE fecha_registro < ?');
    stmt2.run([limit]);
    const eventosBorrados = db.getRowsModified();
    stmt2.free();

    if (peticionesBorradas > 0 || eventosBorrados > 0) {
      logInfo('Limpieza BD: ' + peticionesBorradas + ' peticiones, ' + eventosBorrados + ' eventos (> 90 dias)');
      scheduleDbSave();
    }
  } catch (e) {
    logError('Error en cleanOldDbData: ' + e.message);
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
        encolado INTEGER DEFAULT 0,
        endpoint TEXT NOT NULL DEFAULT 'update',
        posicion INTEGER,
        cod_sala TEXT,
        id_race INTEGER,
        enviado_externo INTEGER DEFAULT 0
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
      CREATE INDEX IF NOT EXISTS idx_peticiones_ias ON peticiones(ganador, enviado_externo);

      CREATE TABLE IF NOT EXISTS sprite_config (
        sheet TEXT PRIMARY KEY,
        show_sprite INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
    `);

    // ============================================================
    // MIGRACION: agregar columnas que faltan en BDs viejas.
    // SQLite no soporta "ADD COLUMN IF NOT EXISTS", asi que probamos
    // y silenciamos el error si ya existe.
    // ============================================================
    function migrarColumna(tabla, columna, definicion) {
      try {
        db.run('ALTER TABLE ' + tabla + ' ADD COLUMN ' + columna + ' ' + definicion);
        logInfo('Migracion: columna ' + tabla + '.' + columna + ' agregada');
      } catch (e) {
        // Si ya existe, SQLite tira "duplicate column name" - lo ignoramos
        if (!/duplicate column/i.test(e.message)) {
          logError('Error agregando columna ' + tabla + '.' + columna + ': ' + e.message);
        }
      }
    }
    migrarColumna('peticiones', 'endpoint',        "TEXT NOT NULL DEFAULT 'update'");
    migrarColumna('peticiones', 'posicion',        'INTEGER');
    migrarColumna('peticiones', 'cod_sala',        'TEXT');
    migrarColumna('peticiones', 'id_race',         'INTEGER');
    migrarColumna('peticiones', 'enviado_externo', 'INTEGER DEFAULT 0');

    // Defaults: mostrar sprite=true para grand y major (solo si no existen)
    db.run(`INSERT OR IGNORE INTO sprite_config (sheet, show_sprite, updated_at) VALUES ('grand', 1, datetime('now'));`);
    db.run(`INSERT OR IGNORE INTO sprite_config (sheet, show_sprite, updated_at) VALUES ('major', 1, datetime('now'));`);
    
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

function guardarPeticion(data, ipOrigen, encolado = false, endpoint = 'update') {
  if (!db || !dbReady) return null;
  try {
    const id = nextPeticionId++;
    const stmt = db.prepare(`
      INSERT INTO peticiones (id, sheet, amount, ganador, maquina, ip_origen, fecha_registro, encolado, endpoint, posicion, cod_sala, id_race)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      id,
      data.sheet,
      data.amount !== undefined && data.amount !== null ? data.amount : null,
      data.ganador ? 1 : 0,
      data.maquina || null,
      ipOrigen || 'unknown',
      fechaLocalISO(),
      encolado ? 1 : 0,
      endpoint,
      (typeof data.posicion === 'number') ? data.posicion : null,
      data.codSala || null,
      (typeof data.idRace === 'number') ? data.idRace : null
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

// ============================================================
// ENVIO A SERVIDOR EXTERNO (IAS)
// Cuando llega un ganador, se intenta enviar al endpoint externo
// /PraGanadores/CrearGanador. Si falla, queda con enviado_externo=0
// y se reintenta automaticamente cada iasRetryIntervalSec.
// ============================================================
let iasStats = {
  ultimoIntento: null,
  ultimoExito: null,
  ultimoError: null,
  totalEnviados: 0,
  totalErrores: 0
};

function marcarGanadorEnviadoIAS(peticionId) {
  if (!db || !dbReady || !peticionId) return;
  try {
    const stmt = db.prepare('UPDATE peticiones SET enviado_externo = 1 WHERE id = ?');
    stmt.run([peticionId]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando enviado_externo: ' + e.message);
  }
}

function mapearPozo(sheet) {
  // Mapeo solicitado: Car=grand, Moto=major, Minor=minor, Mini=mini
  const map = { mini: 'Mini', minor: 'Minor', major: 'Moto', grand: 'Car' };
  return map[sheet] || sheet;
}

function fechaLocalISO(fecha) {
  // Devuelve la fecha/hora LOCAL del sistema (la PC del casino esta en Peru)
  // en formato ISO sin zona: "2026-05-27T10:48:00.000"
  // C# DateTime parsea esto como hora local sin convertir a UTC.
  // Tambien se usa para guardar en la DB local, asi el history queda
  // en hora de Peru (no UTC).
  const d = fecha ? new Date(fecha) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}`;
}

function formatearFechaGanador(fechaLocal) {
  // El IAS (C# MVC) espera DateTime. Mandamos ISO con hora local de Peru
  // SIN la Z (sin indicador UTC) para que C# lo tome como hora local.
  // Ej: "2026-05-27T10:48:00"
  try {
    // Si ya viene en formato fechaLocalISO, le quitamos los milisegundos
    // para mandar limpio "2026-05-27T10:48:00"
    if (fechaLocal && fechaLocal.includes('T')) {
      return fechaLocal.split('.')[0];
    }
    // Fallback: generar ahora
    return fechaLocalISO().split('.')[0];
  } catch (e) {
    return '';
  }
}

async function enviarGanadorAIas(peticionId, data, fechaRegistro) {
  // Verificar config
  if (!iasConfig || !iasConfig.iasEnabled || !iasConfig.iasBaseUrl) {
    return false;
  }
  
  const url = iasConfig.iasBaseUrl.replace(/\/+$/, '') + '/PraGanadores/CrearGanador';
  const body = {
    IdRace: data.idRace,
    CodSala: data.codSala,       // string como nosotros lo tenemos
    CodMaquina: data.maquina,    // string como nosotros lo tenemos
    Posicion: (typeof data.posicion === 'number') ? data.posicion : 0,
    Monto: data.amount || 0,
    Pozo: mapearPozo(data.sheet),
    FechaGanador: formatearFechaGanador(fechaRegistro)
  };
  
  iasStats.ultimoIntento = new Date().toISOString();
  
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
      marcarGanadorEnviadoIAS(peticionId);
      iasStats.ultimoExito = new Date().toISOString();
      iasStats.totalEnviados++;
      logInfo('IAS OK: ganador id=' + peticionId + ' sheet=' + data.sheet);
      return true;
    } else {
      const txt = await resp.text().catch(() => '');
      iasStats.ultimoError = 'HTTP ' + resp.status + ' - ' + txt.substring(0, 200);
      iasStats.totalErrores++;
      logWarn('IAS FAIL ' + resp.status + ' id=' + peticionId + ': ' + txt.substring(0, 200));
      return false;
    }
  } catch (e) {
    iasStats.ultimoError = e.message;
    iasStats.totalErrores++;
    logWarn('IAS ERROR id=' + peticionId + ': ' + e.message);
    return false;
  }
}

function reintentarPendientesIAS() {
  if (!db || !dbReady) return;
  if (!iasConfig || !iasConfig.iasEnabled) return;
  
  try {
    const stmt = db.prepare(`
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
      }, fila.fecha_registro);
    });
  } catch (e) {
    logError('Error en reintentarPendientesIAS: ' + e.message);
  }
}

function contarPendientesIAS() {
  if (!db || !dbReady) return 0;
  try {
    const stmt = db.prepare('SELECT COUNT(*) AS c FROM peticiones WHERE ganador = 1 AND enviado_externo = 0');
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return row.c || 0;
  } catch (e) {
    return 0;
  }
}

function guardarEvento(tipo, descripcion, memoriaMB = null) {
  if (!db || !dbReady) return;
  try {
    const stmt = db.prepare(`
      INSERT INTO eventos (tipo, descripcion, memoria_mb, fecha_registro)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([tipo, descripcion, memoriaMB, fechaLocalISO()]);
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
// SPRITE_CONFIG: mostrar/ocultar el sprite de grand y major
// ============================================================
function getSpriteConfig() {
  // Default si DB no esta lista: ambos en true
  const out = { grand: true, major: true };
  if (!db || !dbReady) return out;
  try {
    const rows = queryRows('SELECT sheet, show_sprite FROM sprite_config');
    rows.forEach(r => {
      if (r.sheet === 'grand' || r.sheet === 'major') {
        out[r.sheet] = !!r.show_sprite;
      }
    });
  } catch (e) {
    logError('getSpriteConfig: ' + e.message);
  }
  return out;
}

function setSpriteConfig(sheet, show) {
  if (!['grand','major'].includes(sheet)) return false;
  if (!db || !dbReady) return false;
  try {
    db.run(
      'UPDATE sprite_config SET show_sprite = ?, updated_at = ? WHERE sheet = ?',
      [show ? 1 : 0, fechaLocalISO(), sheet]
    );
    scheduleDbSave();
    return true;
  } catch (e) {
    logError('setSpriteConfig: ' + e.message);
    return false;
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
  // Guardar la config del IAS en una variable accesible desde otras funciones
  iasConfig = {
    iasEnabled: !!config.iasEnabled,
    iasBaseUrl: config.iasBaseUrl || '',
    iasRetryIntervalSec: config.iasRetryIntervalSec || 30
  };
  
  // Arrancar timer de reintento de envios pendientes al IAS.
  // Esto cubre: ganadores que estaban en la DB de un crash anterior,
  // y ganadores cuyo POST inicial fallo (servidor externo caido).
  if (iasConfig.iasEnabled && iasConfig.iasBaseUrl) {
    logInfo('IAS habilitado: ' + iasConfig.iasBaseUrl + ' (retry cada ' + iasConfig.iasRetryIntervalSec + 's)');
    // Primer reintento al arrancar (despues de 5s para dejar que la DB cargue)
    setTimeout(reintentarPendientesIAS, 5000);
    // Despues cada N segundos
    iasRetryTimer = setInterval(reintentarPendientesIAS, iasConfig.iasRetryIntervalSec * 1000);
  } else {
    logInfo('IAS deshabilitado (iasEnabled=false o iasBaseUrl vacio)');
  }
  
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
    
    // Validacion de campos obligatorios
    if (!data || !data.sheet) {
      return res.status(400).json({ error: 'sheet es requerido' });
    }
    if (!['mini','minor','major','grand'].includes(data.sheet)) {
      return res.status(400).json({ error: 'sheet debe ser: mini, minor, major o grand' });
    }
    if (!data.codSala || typeof data.codSala !== 'string') {
      return res.status(400).json({ error: 'codSala es requerido (string)' });
    }
    if (data.idRace === undefined || data.idRace === null || !Number.isInteger(data.idRace)) {
      return res.status(400).json({ error: 'idRace es requerido (entero)' });
    }
    // posicion es opcional pero si viene debe ser numero entero
    if (data.posicion !== undefined && data.posicion !== null && !Number.isInteger(data.posicion)) {
      return res.status(400).json({ error: 'posicion debe ser entero (si se envia)' });
    }
    
    // Guardar en SQLite ANTES de procesar (siempre se registra)
    const peticionId = guardarPeticion(data, ipOrigen, false, 'update');
    
    // Si es ganador, disparar envio al servidor IAS en paralelo (no bloquea).
    // Si falla, queda con enviado_externo=0 y el retry timer lo intentara despues.
    if (data.ganador === true && peticionId) {
      const fechaGanador = fechaLocalISO();  // hora local de Peru
      setImmediate(() => {
        enviarGanadorAIas(peticionId, data, fechaGanador);
      });
    }
    
    sendUpdateToDashboard(data, peticionId);
    
    res.json({ 
      ok: true, 
      peticionId: peticionId,
      dashboardReady: dashboardReady, 
      queueSize: pendingUpdates.length 
    });
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
    if (!['mini','minor'].includes(data.sheet)) {
      return res.status(400).json({ error: 'sheet debe ser: mini o minor' });
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

  // ============================================================
  // ENDPOINT /sprite-config
  // Activa/desactiva el sprite (auto/moto) de grand y major.
  // Cuando show=false: la hoja se renderiza estilo mini/minor
  // (odometro, sin sprite ni KPIs, subtitulo "GANATE EFECTIVO").
  // El valor se persiste en BD y se mantiene tras reinicios.
  // ============================================================
  httpApp.post('/sprite-config', (req, res) => {
    const data = req.body;
    if (!data || !['grand','major'].includes(data.sheet)) {
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

  // GET /sprite-config -> estado actual
  httpApp.get('/sprite-config', (req, res) => {
    res.json(getSpriteConfig());
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

    const SHEETS = ['mini','minor','major','grand'];

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
      dashboardReady: dashboardReady,
      queueSize: pendingUpdates.length
    });
  });
  
  httpApp.get('/status', (req, res) => {
    res.json({ 
      config: config,
      spriteConfig: getSpriteConfig(),
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

  // ============================================================
  // ENDPOINT /audit
  // Lee la tabla 'eventos' (auditoria de cambios de configuracion:
  // sprite-config, sprite-config-bulk, etc).
  // Query params:
  //   ?limit=50           cantidad de registros (default 50)
  //   ?tipo=sprite-config filtrar por tipo de evento
  // ============================================================
  httpApp.get('/audit', (req, res) => {
    if (!db || !dbReady) return res.json({ error: 'DB no disponible' });
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
    if (!db || !dbReady) return res.json({ error: 'DB no disponible' });
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
  
  // Estado de envios al servidor IAS externo
  httpApp.get('/ias-status', (req, res) => {
    res.json({
      iasEnabled: iasConfig ? iasConfig.iasEnabled : false,
      iasBaseUrl: iasConfig ? iasConfig.iasBaseUrl : '',
      iasRetryIntervalSec: iasConfig ? iasConfig.iasRetryIntervalSec : 0,
      pendientes: contarPendientesIAS(),
      ultimoIntento: iasStats.ultimoIntento,
      ultimoExito: iasStats.ultimoExito,
      ultimoError: iasStats.ultimoError,
      totalEnviados: iasStats.totalEnviados,
      totalErrores: iasStats.totalErrores
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
  });
}

// ============================================================
// Enviar update al dashboard (con cola)
// ============================================================
async function sendUpdateToDashboard(data, peticionId) {
  const isReinicio = (data._endpoint === 'reinicio');
  
  if (!mainWindow || mainWindow.isDestroyed() || !dashboardReady) {
    pendingUpdates.push({ data, peticionId });
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
  
  // ============================================================
  // MODO DE VENTANA: 'kiosk' (pantalla completa sin bordes)
  //                  'window' (con barra de titulo, movible)
  // Por defecto es 'window' para poder mover entre pantallas.
  // Se puede cambiar editando config.json o con Ctrl+Shift+K en caliente.
  // ============================================================
  const isKiosk = (config.windowMode === 'kiosk');
  
  mainWindow = new BrowserWindow({
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

  // ============================================================
  // AUTO-RELOAD AL REDIMENSIONAR la ventana.
  // El diseño tiene muchos elementos que se calculan al cargar
  // (paths SVG, posicion de pots, runners) y no se reajustan
  // bien al cambiar tamaño. La forma mas segura de garantizar
  // que todo quede alineado es hacer reload (igual que Ctrl+Shift+R).
  // Debounce de 400ms para que solo dispare cuando se termina
  // de arrastrar/redimensionar (no en cada pixel).
  // No dispara si hay un ganador activo (igual proteccion que el
  // reload manual).
  // ============================================================
  let resizeReloadTimer = null;
  mainWindow.on('resize', () => {
    if (resizeReloadTimer) clearTimeout(resizeReloadTimer);
    resizeReloadTimer = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (isWinnerActive) {
        logWarn('Resize ignorado (ganador activo)');
        return;
      }
      logInfo('Resize detectado - reload automatico para reajustar layout');
      dashboardReady = false;
      savePendingToDisk();
      mainWindow.reload();
    }, 400);
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
      logWarn('Carpeta promos/ no existe - crear y poner videos .mp4 dentro');
    }
    
    const promosJson = JSON.stringify(promoFiles);
    // Ruta absoluta de promos para construir URLs file:// correctas
    // (cuando esta empaquetado, promos esta en resources/, no en el asar)
    const promosBaseUrl = 'file:///' + promosDir.replace(/\\/g, '/') + '/';
    
    await safeExecJs(`
      window.CASINO_CONFIG = ${configJson};
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

  // Limpieza de la BD (peticiones + eventos > 90 dias) cada 24 horas
  setInterval(cleanOldDbData, 24 * 60 * 60 * 1000);
  // Y una vez al iniciar (despues de 60s para que la DB este lista)
  setTimeout(cleanOldDbData, 60 * 1000);
  
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
  
  // Ctrl+Shift+K: alternar entre kiosko y ventana en caliente
  // (no reinicia la app, solo cambia la ventana)
  globalShortcut.register('Ctrl+Shift+K', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    const ahoraEsKiosko = mainWindow.isKiosk();
    
    if (ahoraEsKiosko) {
      // pasar a modo ventana
      mainWindow.setKiosk(false);
      mainWindow.setFullScreen(false);
      logInfo('Modo cambiado a VENTANA (con barra de titulo)');
    } else {
      // pasar a modo kiosko
      mainWindow.setKiosk(true);
      mainWindow.setFullScreen(true);
      logInfo('Modo cambiado a KIOSKO (pantalla completa)');
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