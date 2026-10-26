// ============================================================
// Rutas de escritura en userData (logs, db, cola pendiente)
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { initPaths };

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const estado = require('./estado');

function initPaths() {
  estado.USER_DATA_DIR = app.getPath('userData');
  if (!fs.existsSync(estado.USER_DATA_DIR)) fs.mkdirSync(estado.USER_DATA_DIR, { recursive: true });

  estado.PENDING_FILE = path.join(estado.USER_DATA_DIR, 'pending-updates.json');
  estado.LOGS_DIR = path.join(estado.USER_DATA_DIR, 'logs');
  estado.DB_PATH = path.join(estado.USER_DATA_DIR, 'dashboard.db');

  if (!fs.existsSync(estado.LOGS_DIR)) fs.mkdirSync(estado.LOGS_DIR, { recursive: true });
}
