// ============================================================
// Imagen del premio de GRAND y MAJOR (lo que se muestra cuando el
// pozo esta en modo imagen en vez de monto). Se sube desde el editor
// (Ctrl+Shift+T) y se guarda en userData/premios/, asi una
// reinstalacion no la borra. Si no hay imagen subida se usa la de
// siempre (img/auto_sprite.png / img/moto_sprite.png).
// tipo:
//   "sprite" - hoja de 6x6 cuadros que gira como 3D (igual que la original)
//   "imagen" - una imagen fija (PNG/WebP) que se muestra entera
// ============================================================
module.exports = { leerPremios, guardarPremio, quitarPremio, rutaImagenPremio, infoPremios };

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const POZOS_PREMIO = ['grand', 'major'];
const TIPOS = ['sprite', 'imagen'];
const MAX_BYTES = 8 * 1024 * 1024;

function carpeta() {
  const dir = path.join(app.getPath('userData'), 'premios');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const rutaIndice = () => path.join(carpeta(), 'premios.json');

// { grand: { tipo, archivo, nombre, version }, major: {...} } (solo los que tienen imagen subida)
function leerPremios() {
  try {
    const p = rutaIndice();
    if (!fs.existsSync(p)) return {};
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const out = {};
    POZOS_PREMIO.forEach((pozo) => {
      const x = d && d[pozo];
      if (x && TIPOS.includes(x.tipo) && x.archivo && fs.existsSync(path.join(carpeta(), x.archivo))) out[pozo] = x;
    });
    return out;
  } catch (e) {
    return {};
  }
}

function escribirIndice(d) {
  fs.writeFileSync(rutaIndice(), JSON.stringify(d, null, 2), 'utf-8');
}

// Detecta PNG o WebP por sus primeros bytes (no por la extension)
function formato(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// datosBase64: el archivo en base64 (sin "data:...;base64,"). Devuelve el registro guardado.
function guardarPremio(pozo, tipo, datosBase64, nombre) {
  if (!POZOS_PREMIO.includes(pozo)) throw new Error('pozo debe ser grand o major');
  if (!TIPOS.includes(tipo)) throw new Error('tipo debe ser sprite o imagen');
  const buf = Buffer.from(String(datosBase64 || ''), 'base64');
  if (!buf.length) throw new Error('falta la imagen');
  if (buf.length > MAX_BYTES) throw new Error('la imagen pesa mas de 8 MB');
  const ext = formato(buf);
  if (!ext) throw new Error('la imagen debe ser PNG o WebP');

  const d = leerPremios();
  const anterior = d[pozo];
  const archivo = pozo + '-' + Date.now() + '.' + ext;
  fs.writeFileSync(path.join(carpeta(), archivo), buf);
  d[pozo] = {
    tipo: tipo,
    archivo: archivo,
    nombre: String(nombre || archivo).slice(0, 120),
    version: Date.now()
  };
  escribirIndice(d);
  if (anterior && anterior.archivo !== archivo) {
    try { fs.unlinkSync(path.join(carpeta(), anterior.archivo)); } catch (e) {}
  }
  return d[pozo];
}

// Vuelve a la imagen original del pozo
function quitarPremio(pozo) {
  if (!POZOS_PREMIO.includes(pozo)) throw new Error('pozo debe ser grand o major');
  const d = leerPremios();
  const anterior = d[pozo];
  delete d[pozo];
  escribirIndice(d);
  if (anterior) {
    try { fs.unlinkSync(path.join(carpeta(), anterior.archivo)); } catch (e) {}
  }
}

function rutaImagenPremio(pozo) {
  const x = leerPremios()[pozo];
  return x ? path.join(carpeta(), x.archivo) : null;
}

// Resumen para respuestas de la API: tipo "original" si no se subio nada
function infoPremios() {
  const d = leerPremios();
  const out = {};
  POZOS_PREMIO.forEach((pozo) => {
    const x = d[pozo];
    out[pozo] = x ? { tipo: x.tipo, nombre: x.nombre, version: x.version } : { tipo: 'original', nombre: null, version: 0 };
  });
  return out;
}
