/* ============================================================
   CASINO PROGRESIVOS - LOGICA PRINCIPAL
   - Carrusel con 3 transiciones diferentes (rotando)
   - Contadores con CountUp.js
   - Animaciones con GSAP
   - Optimizado 24/7 sin fugas de memoria
   ============================================================ */

// ============================================================
// CONFIGURACION
// ============================================================
const CONFIG = {
  segundosPorHoja: 8,           // Duracion de cada hoja
  segundosActualizarAPI: 5,     // Cada cuanto consultar API
  segundosGanador: 10,          // Cuanto dura la pantalla de ganador
  duracionTransicion: 1.4,      // Segundos por transicion entre hojas
  modoAPI: 'demo',              // 'demo' o 'real'
  urlAPI: 'https://tu-servidor.com/api/progresivos'
};

// ============================================================
// ESTADO GLOBAL
// ============================================================
const estado = {
  hojaActual: 0,
  totalHojas: 5,
  enTransicion: false,
  enModoGanador: false,
  intervaloCarrusel: null,
  intervaloAPI: null,
  ultimoGanador: null,

  // Valores actuales de los progresivos
  valores: {
    mini: 487.50,
    med: 12350.75,
    max: 458920.30
  },

  // Instancias de CountUp
  counters: {}
};

// ============================================================
// SVG DE BANDERAS A CUADROS (inyectadas dinamicamente)
// ============================================================
const banderaSVG = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 65" width="100%" height="100%">
    <defs>
      <pattern id="cuadros-bandera-${Math.random().toString(36).substr(2,5)}" patternUnits="userSpaceOnUse" width="14" height="14">
        <rect width="7" height="7" fill="#ffffff"/>
        <rect x="7" y="7" width="7" height="7" fill="#ffffff"/>
        <rect x="7" width="7" height="7" fill="#000"/>
        <rect y="7" width="7" height="7" fill="#000"/>
      </pattern>
    </defs>
    <line x1="4" y1="0" x2="4" y2="65" stroke="#999" stroke-width="3"/>
    <path d="M 7 3 Q 45 0 84 5 L 84 60 Q 45 63 7 60 Z"
          fill="url(#cuadros-bandera-shared)" stroke="#444" stroke-width="0.8"/>
  </svg>
`;

// Crear pattern compartido una sola vez
function inyectarBanderas() {
  // Crear el SVG con pattern compartido
  const svgGlobal = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgGlobal.setAttribute('width', '0');
  svgGlobal.setAttribute('height', '0');
  svgGlobal.style.position = 'absolute';
  svgGlobal.innerHTML = `
    <defs>
      <pattern id="cuadros-bandera-shared" patternUnits="userSpaceOnUse" width="14" height="14">
        <rect width="7" height="7" fill="#ffffff"/>
        <rect x="7" y="7" width="7" height="7" fill="#ffffff"/>
        <rect x="7" width="7" height="7" fill="#000"/>
        <rect y="7" width="7" height="7" fill="#000"/>
      </pattern>
    </defs>
  `;
  document.body.appendChild(svgGlobal);

  // Inyectar bandera en cada elemento
  document.querySelectorAll('.bandera-svg').forEach(el => {
    el.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 65" width="100%" height="100%">
        <line x1="4" y1="0" x2="4" y2="65" stroke="#999" stroke-width="3"/>
        <path d="M 7 3 Q 45 0 84 5 L 84 60 Q 45 63 7 60 Z"
              fill="url(#cuadros-bandera-shared)" stroke="#444" stroke-width="0.8"/>
      </svg>
    `;
  });
}

// ============================================================
// FORMATEO DE NUMEROS
// ============================================================
function formatearSoles(num) {
  return num.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ============================================================
// INICIALIZAR CONTADORES (CountUp.js)
// ============================================================
function iniciarContadores() {
  const config = {
    decimalPlaces: 2,
    duration: 2,
    separator: ',',
    decimal: '.',
    useEasing: true
  };

  estado.counters.mini = new countUp.CountUp('counter-mini', estado.valores.mini, config);
  estado.counters.med = new countUp.CountUp('counter-med', estado.valores.med, config);
  estado.counters.max = new countUp.CountUp('counter-max', estado.valores.max, config);

  if (!estado.counters.mini.error) estado.counters.mini.start();
  if (!estado.counters.med.error) estado.counters.med.start();
  if (!estado.counters.max.error) estado.counters.max.start();
}

// Actualizar valores
function actualizarValores(nuevos) {
  if (estado.counters.mini && !estado.counters.mini.error) {
    estado.counters.mini.update(nuevos.mini);
  }
  if (estado.counters.med && !estado.counters.med.error) {
    estado.counters.med.update(nuevos.med);
  }
  if (estado.counters.max && !estado.counters.max.error) {
    estado.counters.max.update(nuevos.max);
  }

  estado.valores = { ...nuevos };
}

// ============================================================
// CARRUSEL: 3 TIPOS DE TRANSICION (rotando)
// ============================================================
function getTransicion(indice) {
  // Alterna entre 3 tipos
  const tipos = ['flip', 'zoom', 'cube'];
  return tipos[indice % 3];
}

function transicionFlip(salida, entrada) {
  // Vuelta de hoja 3D
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });

    tl.set(entrada, { rotationY: -180, opacity: 0, visibility: 'visible' })
      .to(salida, {
        rotationY: 180,
        opacity: 0,
        duration: CONFIG.duracionTransicion,
        ease: 'power2.inOut',
        onComplete: () => {
          salida.classList.remove('activa');
          gsap.set(salida, { clearProps: 'all', visibility: 'hidden' });
        }
      })
      .to(entrada, {
        rotationY: 0,
        opacity: 1,
        duration: CONFIG.duracionTransicion,
        ease: 'power2.inOut'
      }, '-=' + (CONFIG.duracionTransicion * 0.7));
  });
}

function transicionZoom(salida, entrada) {
  // Zoom out + zoom in con fade
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });

    tl.set(entrada, { scale: 0.3, opacity: 0, visibility: 'visible' })
      .to(salida, {
        scale: 1.6,
        opacity: 0,
        duration: CONFIG.duracionTransicion * 0.6,
        ease: 'power2.in',
        onComplete: () => {
          salida.classList.remove('activa');
          gsap.set(salida, { clearProps: 'all', visibility: 'hidden' });
        }
      })
      .to(entrada, {
        scale: 1,
        opacity: 1,
        duration: CONFIG.duracionTransicion * 0.7,
        ease: 'back.out(1.4)'
      }, '-=0.2');
  });
}

function transicionCube(salida, entrada) {
  // Cubo girando
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });

    tl.set(entrada, { rotationY: 90, opacity: 1, visibility: 'visible', transformOrigin: '0% 50%' })
      .set(salida, { transformOrigin: '100% 50%' })
      .to(salida, {
        rotationY: -90,
        duration: CONFIG.duracionTransicion,
        ease: 'power2.inOut',
        onComplete: () => {
          salida.classList.remove('activa');
          gsap.set(salida, { clearProps: 'all', visibility: 'hidden' });
        }
      })
      .to(entrada, {
        rotationY: 0,
        duration: CONFIG.duracionTransicion,
        ease: 'power2.inOut'
      }, '<');
  });
}

async function siguienteHoja() {
  if (estado.enTransicion || estado.enModoGanador) return;
  estado.enTransicion = true;

  const hojas = document.querySelectorAll('.hoja');
  const salida = hojas[estado.hojaActual];
  const siguienteIndice = (estado.hojaActual + 1) % estado.totalHojas;
  const entrada = hojas[siguienteIndice];

  // Marcar la nueva como activa (visualmente sigue oculta hasta la transicion)
  entrada.classList.add('activa');

  const tipo = getTransicion(estado.hojaActual);
  if (tipo === 'flip') await transicionFlip(salida, entrada);
  else if (tipo === 'zoom') await transicionZoom(salida, entrada);
  else if (tipo === 'cube') await transicionCube(salida, entrada);

  estado.hojaActual = siguienteIndice;
  estado.enTransicion = false;

  // Debug
  document.getElementById('dbg-hoja').textContent = entrada.dataset.hoja;
}

function iniciarCarrusel() {
  if (estado.intervaloCarrusel) clearInterval(estado.intervaloCarrusel);
  estado.intervaloCarrusel = setInterval(() => {
    siguienteHoja();
  }, CONFIG.segundosPorHoja * 1000);
}

function pausarCarrusel() {
  if (estado.intervaloCarrusel) {
    clearInterval(estado.intervaloCarrusel);
    estado.intervaloCarrusel = null;
  }
}

// ============================================================
// API
// ============================================================
async function consultarAPI() {
  if (CONFIG.modoAPI === 'demo') {
    // Simulacion: incremento aleatorio
    return {
      mini: estado.valores.mini + Math.random() * 3,
      med:  estado.valores.med  + Math.random() * 8,
      max:  estado.valores.max  + Math.random() * 20,
      winner: null
    };
  }

  try {
    const res = await fetch(CONFIG.urlAPI);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (error) {
    console.error('Error API:', error);
    document.getElementById('dbg-api').textContent = 'ERROR';
    return null;
  }
}

async function tickAPI() {
  const datos = await consultarAPI();
  if (!datos) return;

  document.getElementById('dbg-api').textContent =
    CONFIG.modoAPI === 'demo' ? 'DEMO' : 'REAL';

  actualizarValores({
    mini: datos.mini,
    med: datos.med || datos.minor,
    max: datos.max || datos.mayor
  });

  // Detectar ganador
  if (datos.winner && !estado.enModoGanador) {
    const idGanador = (datos.winner.type || '') + '_' + (datos.winner.amount || '');
    if (idGanador !== estado.ultimoGanador) {
      estado.ultimoGanador = idGanador;
      mostrarGanador(datos.winner.type, datos.winner.amount);
    }
  }
}

// ============================================================
// PANTALLA DE GANADOR
// ============================================================
function mostrarGanador(tipo, monto) {
  if (estado.enModoGanador) return;
  estado.enModoGanador = true;

  pausarCarrusel();

  // Configurar texto
  let tipoTexto = (tipo || 'max').toUpperCase();
  if (tipoTexto === 'MAX' || tipoTexto === 'MAYOR') tipoTexto = 'GRAN PREMIO';
  if (tipoTexto === 'MED' || tipoTexto === 'MINOR') tipoTexto = 'PREMIO MEDIO';
  if (tipoTexto === 'AUTO') tipoTexto = 'GANADOR AUTO';
  if (tipoTexto === 'MOTO') tipoTexto = 'GANADOR MOTO';

  document.getElementById('ganador-tipo').textContent = tipoTexto;

  const panel = document.getElementById('pantalla-ganador');
  panel.classList.remove('oculto');

  // Animacion de entrada con GSAP
  gsap.set('.ganador-contenido', { scale: 0, opacity: 0 });
  gsap.to('.ganador-contenido', {
    scale: 1,
    opacity: 1,
    duration: 0.8,
    ease: 'back.out(1.7)'
  });

  // Iniciar confetti
  ConfettiManager.iniciar();

  // Explosiones de confetti programadas
  const cw = window.innerWidth;
  const ch = window.innerHeight;

  setTimeout(() => ConfettiManager.lanzarExplosion(cw / 2, ch / 2, 100), 200);
  setTimeout(() => ConfettiManager.lanzarExplosion(cw * 0.3, ch * 0.5, 60), 600);
  setTimeout(() => ConfettiManager.lanzarExplosion(cw * 0.7, ch * 0.5, 60), 900);

  // Lluvia continua de confetti durante el ganador
  const intervalConfetti = setInterval(() => {
    if (estado.enModoGanador) {
      ConfettiManager.lanzarLluvia();
    } else {
      clearInterval(intervalConfetti);
    }
  }, 800);

  // Animar el monto (rapido, espectacular)
  const counterGanador = new countUp.CountUp('ganador-monto', monto || 0, {
    decimalPlaces: 2,
    duration: 3.5,
    separator: ',',
    decimal: '.',
    useEasing: true
  });
  if (!counterGanador.error) counterGanador.start();

  // Audio
  const audio = document.getElementById('audio-ganador');
  audio.currentTime = 0;
  audio.play().catch(() => {});

  // Volver al carrusel despues
  setTimeout(() => cerrarGanador(), CONFIG.segundosGanador * 1000);
}

function cerrarGanador() {
  const panel = document.getElementById('pantalla-ganador');

  gsap.to('.ganador-contenido', {
    scale: 0.7,
    opacity: 0,
    duration: 0.5,
    ease: 'power2.in',
    onComplete: () => {
      panel.classList.add('oculto');
      ConfettiManager.detener();

      const audio = document.getElementById('audio-ganador');
      audio.pause();
      audio.currentTime = 0;

      estado.enModoGanador = false;
      iniciarCarrusel();
    }
  });
}

// Funcion para el boton demo
function simularGanador(tipo) {
  let monto = 0;
  if (tipo === 'mini') monto = estado.valores.mini;
  else if (tipo === 'med') monto = estado.valores.med;
  else if (tipo === 'max') monto = estado.valores.max;
  else if (tipo === 'auto') monto = estado.valores.max * 1.5;
  else if (tipo === 'moto') monto = estado.valores.med * 2;

  mostrarGanador(tipo, monto);
}

// ============================================================
// FPS COUNTER (para monitorear performance 24/7)
// ============================================================
function iniciarFPSCounter() {
  let frames = 0;
  let ultimoTiempo = performance.now();
  const fpsEl = document.getElementById('dbg-fps');

  function tick() {
    frames++;
    const ahora = performance.now();
    if (ahora - ultimoTiempo >= 1000) {
      if (fpsEl) fpsEl.textContent = frames;
      frames = 0;
      ultimoTiempo = ahora;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================================
// GESTION DE MEMORIA (cleanup periodico para 24/7)
// ============================================================
function iniciarLimpiezaPeriodica() {
  // Cada 30 minutos: limpiar cosas que pudieran acumularse
  setInterval(() => {
    // Forzar GC sugerido (no garantizado pero ayuda)
    if (window.gc) window.gc();

    // Verificar memoria si esta disponible
    if (performance.memory) {
      const mb = performance.memory.usedJSHeapSize / 1024 / 1024;
      console.log(`[Cleanup] Memoria: ${mb.toFixed(1)} MB`);
    }
  }, 30 * 60 * 1000);
}

// ============================================================
// INICIALIZACION
// ============================================================
function iniciar() {
  console.log('Iniciando casino totem...');

  // Inyectar banderas SVG
  inyectarBanderas();

  // Inicializar confetti
  const canvas = document.getElementById('confetti-canvas');
  ConfettiManager.init(canvas);

  // Inicializar contadores
  iniciarContadores();

  // Iniciar carrusel
  iniciarCarrusel();

  // Loop API
  estado.intervaloAPI = setInterval(tickAPI, CONFIG.segundosActualizarAPI * 1000);

  // FPS y limpieza para 24/7
  iniciarFPSCounter();
  iniciarLimpiezaPeriodica();

  // Audio standby
  const audioStandby = document.getElementById('audio-standby');
  audioStandby.volume = 0.2;
  audioStandby.play().catch(() => console.log('Audio standby no disponible'));

  // Debug inicial
  document.getElementById('dbg-hoja').textContent = 'mini';

  console.log('Casino totem corriendo 24/7. FPS objetivo: 60.');
}

// Reanudar audio en click (politica de navegadores)
document.addEventListener('click', () => {
  const audioStandby = document.getElementById('audio-standby');
  if (audioStandby.paused) audioStandby.play().catch(() => {});
}, { once: true });

window.addEventListener('load', iniciar);
