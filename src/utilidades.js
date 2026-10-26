// ============================================================
// Fechas y helpers de formato
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { bodyParaLog, mapearPozo, fechaLocalISO, formatearFechaGanador };


// Texto corto del body para el log (maximo 500 caracteres).
function bodyParaLog(body) {
  let txt = '';
  try { txt = JSON.stringify(body === undefined ? null : body) || ''; } catch (e) { txt = '(no se pudo leer)'; }
  return txt.substring(0, 500);
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
