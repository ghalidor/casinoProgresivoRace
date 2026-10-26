// ============================================================
// Tema editable (textos que se ven en pantalla) y config local
// ============================================================
// - tema.json (userData): nombre del progresivo, nombre y subtitulos de cada
//   pozo y mensajes. Se edita desde el dashboard (Ctrl+Shift+T).
// - config-local.json (userData): valores de config.json cambiados desde el
//   dashboard (Ctrl+Shift+P). config.json no se toca: loadConfig() mezcla
//   config.json + config-local.json, asi el original queda como base.
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { cargarTema, guardarTema, leerConfigLocal, guardarConfigLocal, rutaConfigLocal };

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const TEMA_DEFECTO = {
  nombre: 'PROGRESIVO RACE',
  pozos: {
    grand: { nombre: 'GRAND', subtituloPremio: 'GANATE EL AUTO', subtituloEfectivo: 'GANATE EFECTIVO' },
    major: { nombre: 'MAJOR', subtituloPremio: 'GANATE LA MOTO', subtituloEfectivo: 'GANATE EFECTIVO' },
    minor: { nombre: 'MINOR', subtituloEfectivo: 'GANATE EFECTIVO' },
    mini: { nombre: 'MINI', subtituloEfectivo: 'GANATE EFECTIVO' }
  },
  mensajes: {
    pozoCreciendo: '¡EL POZO SIGUE CRECIENDO!',
    pozoActivo: 'POZO ACTIVO',
    enJuego: 'EN JUEGO',
    siguienteVideo: 'SIGUIENTE VIDEO',
    hora: 'HORA',
    fecha: 'FECHA'
  }
};

// Variantes de diseno que se pueden elegir para cada vista (la primera es la de siempre)
const VARIANTES = {
  home: ['oro', 'neon', 'cromo', 'rubi', 'marquesina', 'deco', 'fichas'],
  hojas: ['oro', 'neon', 'cromo', 'rubi', 'rodillos', 'lluvia', 'deco'],
  promo: ['destacado', 'cinta', 'esquinas', 'ventana', 'ticker', 'marcoL', 'vitrina'],
  homeDist: ['cuadricula', 'destacado', 'filas', 'podio', 'jerarquia'],
  hojasDist: ['centrado', 'gigante', 'columnas', 'inferior'],
  ganador: ['clasico', 'marquesina', 'deco', 'tesoro']
};

const MAX_TEXTO = 60;

function rutaTema() {
  return path.join(app.getPath('userData'), 'tema.json');
}
function rutaConfigLocal() {
  return path.join(app.getPath('userData'), 'config-local.json');
}

function leerJson(ruta) {
  try {
    if (fs.existsSync(ruta)) return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  } catch (e) {
    console.error('[TEMA] No se pudo leer ' + ruta + ': ' + e.message);
  }
  return null;
}

// Copia sobre el tema por defecto solo los textos conocidos (ignora claves extra)
function normalizarTema(entrada) {
  const limpio = (v, defecto) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_TEXTO) : defecto);
  const t = entrada || {};
  const out = { nombre: limpio(t.nombre, TEMA_DEFECTO.nombre), pozos: {}, mensajes: {} };
  Object.keys(TEMA_DEFECTO.pozos).forEach((id) => {
    const def = TEMA_DEFECTO.pozos[id];
    const p = (t.pozos && t.pozos[id]) || {};
    out.pozos[id] = {};
    Object.keys(def).forEach((k) => (out.pozos[id][k] = limpio(p[k], def[k])));
  });
  Object.keys(TEMA_DEFECTO.mensajes).forEach((k) => {
    out.mensajes[k] = limpio(t.mensajes && t.mensajes[k], TEMA_DEFECTO.mensajes[k]);
  });
  out.variantes = {};
  Object.keys(VARIANTES).forEach((vista) => {
    const v = t.variantes && t.variantes[vista];
    out.variantes[vista] = VARIANTES[vista].includes(v) ? v : VARIANTES[vista][0];
  });
  return out;
}

function cargarTema() {
  return normalizarTema(leerJson(rutaTema()));
}

function guardarTema(entrada) {
  const tema = normalizarTema(entrada);
  fs.writeFileSync(rutaTema(), JSON.stringify(tema, null, 2), 'utf-8');
  return tema;
}

function leerConfigLocal() {
  const c = leerJson(rutaConfigLocal());
  return c && typeof c === 'object' ? c : {};
}

// Guarda solo claves que existen en la config base y con el mismo tipo de dato.
function guardarConfigLocal(cambios, base) {
  const local = leerConfigLocal();
  const rechazados = [];
  Object.keys(cambios || {}).forEach((k) => {
    if (!(k in base) || k === 'adminPin') return rechazados.push(k);
    const tipo = typeof base[k];
    let v = cambios[k];
    if (tipo === 'number') v = Number(v);
    else if (tipo === 'boolean') v = v === true || v === 'true';
    else if (tipo === 'string') v = String(v);
    else return rechazados.push(k); // objetos/listas no se editan desde el panel
    if (tipo === 'number' && !Number.isFinite(v)) return rechazados.push(k);
    // igual al original: se quita de config-local (vuelve a mandar config.json)
    if (v === base[k]) delete local[k];
    else local[k] = v;
  });
  fs.writeFileSync(rutaConfigLocal(), JSON.stringify(local, null, 2), 'utf-8');
  return { local, rechazados };
}
