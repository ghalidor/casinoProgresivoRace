// ============================================================
// Base SQLite (sql.js): peticiones, eventos y sprite_config
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { cleanOldDbData, scheduleDbSave, initDatabase, guardarPeticion, marcarPeticionProcesada, marcarPeticionEncolada, marcarGanadorEnviadoIAS, marcarAcreditadoEnviadoIAS, guardarAcreditadoEnDB, contarPendientesIAS, guardarEvento, queryRows, getSpriteConfig, setSpriteConfig };

const fs = require('fs');
const estado = require('./estado');
const { fechaLocalISO } = require('./utilidades');
const { logInfo, logError } = require('./logger');

// ============================================================
// Limpieza de la BD: borrar peticiones y eventos de mas de 90 dias
// (retencion 3 meses). Solo borra registros ya procesados/enviados
// para no perder datos pendientes.
// ============================================================
function cleanOldDbData() {
  if (!estado.db || !estado.dbReady) return;
  try {
    // Fecha limite: hace 90 dias en formato ISO
    const limit = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Borrar peticiones de mas de 90 dias YA PROCESADAS o YA ENVIADAS al IAS
    // (no borramos las que aun estan pendientes para no perderlas)
    const stmt1 = estado.db.prepare(
      "DELETE FROM peticiones WHERE fecha_registro < ? AND (procesado = 1 OR enviado_externo = 1 OR ganador = 0)"
    );
    stmt1.run([limit]);
    const peticionesBorradas = estado.db.getRowsModified();
    stmt1.free();

    // Borrar eventos de mas de 90 dias (todos)
    const stmt2 = estado.db.prepare('DELETE FROM eventos WHERE fecha_registro < ?');
    stmt2.run([limit]);
    const eventosBorrados = estado.db.getRowsModified();
    stmt2.free();

    if (peticionesBorradas > 0 || eventosBorrados > 0) {
      logInfo('Limpieza BD: ' + peticionesBorradas + ' peticiones, ' + eventosBorrados + ' eventos (> 90 dias)');
      scheduleDbSave();
    }
  } catch (e) {
    logError('Error en cleanOldDbData: ' + e.message);
  }
}

// Guardar DB a disco con debounce (no cada vez que escribimos, sino cada 2s)
function scheduleDbSave() {
  if (estado.dbSaveTimeout) clearTimeout(estado.dbSaveTimeout);
  estado.dbSaveTimeout = setTimeout(() => {
    if (estado.db) {
      try {
        const data = estado.db.export();
        fs.writeFileSync(estado.DB_PATH, Buffer.from(data));
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
    if (fs.existsSync(estado.DB_PATH)) {
      const fileBuffer = fs.readFileSync(estado.DB_PATH);
      estado.db = new SQL.Database(fileBuffer);
      logInfo('DB SQLite cargada desde: ' + estado.DB_PATH);
    } else {
      estado.db = new SQL.Database();
      logInfo('DB SQLite nueva creada');
    }

    // Crear tablas si no existen
    estado.db.run(`
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
        estado.db.run('ALTER TABLE ' + tabla + ' ADD COLUMN ' + columna + ' ' + definicion);
        logInfo('Migracion: columna ' + tabla + '.' + columna + ' agregada');
      } catch (e) {
        // Si ya existe, SQLite tira "duplicate column name" - lo ignoramos
        if (!/duplicate column/i.test(e.message)) {
          logError('Error agregando columna ' + tabla + '.' + columna + ': ' + e.message);
        }
      }
    }
    migrarColumna('peticiones', 'endpoint', "TEXT NOT NULL DEFAULT 'update'");
    migrarColumna('peticiones', 'posicion', 'INTEGER');
    migrarColumna('peticiones', 'cod_sala', 'TEXT');
    migrarColumna('peticiones', 'id_race', 'INTEGER');
    migrarColumna('peticiones', 'enviado_externo', 'INTEGER DEFAULT 0');
    migrarColumna('peticiones', 'acreditado_estado', 'INTEGER');
    migrarColumna('peticiones', 'acreditado_detalle', 'TEXT');
    migrarColumna('peticiones', 'acreditado_enviado', 'INTEGER DEFAULT 0');

    // Defaults: mostrar sprite=true para grand y major (solo si no existen)
    estado.db.run(`INSERT OR IGNORE INTO sprite_config (sheet, show_sprite, updated_at) VALUES ('grand', 1, datetime('now'));`);
    estado.db.run(`INSERT OR IGNORE INTO sprite_config (sheet, show_sprite, updated_at) VALUES ('major', 1, datetime('now'));`);

    // Obtener el proximo ID de peticiones
    const res = estado.db.exec('SELECT MAX(id) as maxId FROM peticiones');
    if (res.length > 0 && res[0].values[0][0]) {
      estado.nextPeticionId = res[0].values[0][0] + 1;
    }

    estado.dbReady = true;
    scheduleDbSave();
    return true;
  } catch (e) {
    logError('Error iniciando DB: ' + e.message);
    console.error('[DB] Error - asegurate de tener sql.js instalado: npm install sql.js');
    return false;
  }
}

function guardarPeticion(data, ipOrigen, encolado = false, endpoint = 'update') {
  if (!estado.db || !estado.dbReady) return null;
  try {
    const id = estado.nextPeticionId++;
    const stmt = estado.db.prepare(`
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
  if (!estado.db || !estado.dbReady || !id) return;
  try {
    const stmt = estado.db.prepare('UPDATE peticiones SET procesado = 1 WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando procesada: ' + e.message);
  }
}

function marcarPeticionEncolada(id) {
  if (!estado.db || !estado.dbReady || !id) return;
  try {
    const stmt = estado.db.prepare('UPDATE peticiones SET encolado = 1 WHERE id = ?');
    stmt.run([id]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando encolada: ' + e.message);
  }
}

function marcarGanadorEnviadoIAS(peticionId) {
  if (!estado.db || !estado.dbReady || !peticionId) return;
  try {
    const stmt = estado.db.prepare('UPDATE peticiones SET enviado_externo = 1 WHERE id = ?');
    stmt.run([peticionId]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando enviado_externo: ' + e.message);
  }
}

// ============================================================
// ACREDITACION: ActualizarEstadoAcreditado en el IAS.
// Se dispara cuando llega /confirmSubida (estado 1/0) o cuando el
// modal ganador cierra sin confirmSubida (estado 2 = no confirmaron).
// Se persiste en la DB y se reintenta si el POST al IAS falla.
// ============================================================
function marcarAcreditadoEnviadoIAS(peticionId) {
  if (!estado.db || !estado.dbReady || !peticionId) return;
  try {
    const stmt = estado.db.prepare('UPDATE peticiones SET acreditado_enviado = 1 WHERE id = ?');
    stmt.run([peticionId]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error marcando acreditado_enviado: ' + e.message);
  }
}

function guardarAcreditadoEnDB(peticionId, estado, detalle) {
  if (!estado.db || !estado.dbReady || !peticionId) return;
  try {
    const stmt = estado.db.prepare('UPDATE peticiones SET acreditado_estado = ?, acreditado_detalle = ?, acreditado_enviado = 0 WHERE id = ?');
    stmt.run([estado, detalle || '', peticionId]);
    stmt.free();
    scheduleDbSave();
  } catch (e) {
    logError('Error guardando acreditado en DB: ' + e.message);
  }
}

function contarPendientesIAS() {
  if (!estado.db || !estado.dbReady) return 0;
  try {
    const stmt = estado.db.prepare('SELECT COUNT(*) AS c FROM peticiones WHERE ganador = 1 AND enviado_externo = 0');
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return row.c || 0;
  } catch (e) {
    return 0;
  }
}

function guardarEvento(tipo, descripcion, memoriaMB = null) {
  if (!estado.db || !estado.dbReady) return;
  try {
    const stmt = estado.db.prepare(`
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
  if (!estado.db || !estado.dbReady) return [];
  try {
    const stmt = estado.db.prepare(sql);
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
  if (!estado.db || !estado.dbReady) return out;
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
  if (!['grand', 'major'].includes(sheet)) return false;
  if (!estado.db || !estado.dbReady) return false;
  try {
    estado.db.run(
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
