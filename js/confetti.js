/* ============================================================
   SISTEMA DE CONFETTI OPTIMIZADO
   Usa canvas + requestAnimationFrame.
   Limpia particulas correctamente para no fugar memoria.
   ============================================================ */

const ConfettiManager = (function() {
  let canvas = null;
  let ctx = null;
  let particulas = [];
  let animandoId = null;
  let activo = false;

  const colores = [
    '#ffd700', '#ff8c00', '#ff2d55', '#00ff88',
    '#00d4ff', '#ffea00', '#ff00aa', '#ffffff'
  ];

  function init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    redimensionar();
    window.addEventListener('resize', redimensionar);
  }

  function redimensionar() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function crearParticula(x, y) {
    return {
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 20,
      vy: Math.random() * -20 - 5,
      gravedad: 0.4,
      ancho: Math.random() * 8 + 6,
      alto: Math.random() * 14 + 8,
      rotacion: Math.random() * 360,
      rotVel: (Math.random() - 0.5) * 15,
      color: colores[Math.floor(Math.random() * colores.length)],
      vida: 1.0
    };
  }

  function lanzarExplosion(x, y, cantidad = 80) {
    for (let i = 0; i < cantidad; i++) {
      particulas.push(crearParticula(x, y));
    }
  }

  function lanzarLluvia() {
    // Lluvia desde arriba
    for (let i = 0; i < 30; i++) {
      particulas.push({
        x: Math.random() * canvas.width,
        y: -20,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 5 + 3,
        gravedad: 0.15,
        ancho: Math.random() * 8 + 6,
        alto: Math.random() * 14 + 8,
        rotacion: Math.random() * 360,
        rotVel: (Math.random() - 0.5) * 10,
        color: colores[Math.floor(Math.random() * colores.length)],
        vida: 1.0
      });
    }
  }

  function actualizar() {
    if (!activo || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Filtrar particulas vivas y actualizarlas
    particulas = particulas.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravedad;
      p.rotacion += p.rotVel;
      p.vida -= 0.005;

      // Eliminar si salio de pantalla o se desvanecio
      if (p.y > canvas.height + 50 || p.vida <= 0) return false;

      // Dibujar
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotacion * Math.PI / 180);
      ctx.globalAlpha = p.vida;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.ancho / 2, -p.alto / 2, p.ancho, p.alto);
      ctx.restore();

      return true;
    });

    animandoId = requestAnimationFrame(actualizar);
  }

  function iniciar() {
    if (activo) return;
    activo = true;
    actualizar();
  }

  function detener() {
    activo = false;
    if (animandoId) {
      cancelAnimationFrame(animandoId);
      animandoId = null;
    }
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    particulas = [];
  }

  return {
    init: init,
    iniciar: iniciar,
    detener: detener,
    lanzarExplosion: lanzarExplosion,
    lanzarLluvia: lanzarLluvia
  };
})();
