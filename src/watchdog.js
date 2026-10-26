// ============================================================
// Vigilancia de memoria, ganador/promo en pantalla y limpiezas periodicas
// ============================================================
// Las funciones se exportan antes de los require: entre modulos hay
// require circulares y asi cada uno ya encuentra las funciones del otro.
module.exports = { startWatchdog };

const estado = require('./estado');
const { logWarn, logInfo, cleanOldLogs } = require('./logger');
const { guardarEvento, cleanOldDbData } = require('./db');
const { hayGanadorEnCurso, savePendingToDisk, textoPendiente, resolverAcreditado, programarFlushGanador, flushPendingUpdates } = require('./cola-ganadores');
const { safeExecJs } = require('./ventana');

// ============================================================
// WATCHDOG con auto-reload por memoria
// ============================================================
function startWatchdog(config) {
  const reloadCheckMs = (config.reloadCheckIntervalSec || 60) * 1000;
  const memoryThresholdMB = config.memoryReloadMB || 300;

  // Watchdog principal cada 60s: revisar estado y memoria
  setInterval(async () => {
    if (!estado.mainWindow || estado.mainWindow.isDestroyed()) return;

    const statusStr = await safeExecJs(`
      return JSON.stringify({
        winner: !!document.querySelector('.winner-modal.showing'),
        promo: !!document.querySelector('.promo-video.showing'),
        memMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0
      });
    `);

    if (!statusStr) return;

    let status;
    try { status = JSON.parse(statusStr); } catch (e) { return; }

    // Este chequeo SOLO se ocupa de la memoria. isWinnerActive e isPromoActive
    // los actualiza unicamente el vigilante de 5s: si este tambien los pisara,
    // el vigilante podria no ver que termino una promo y no liberaria la cola.

    // Guardar memoria a la DB cada hora
    if (Math.random() < 0.02) {  // ~1% probabilidad por check = ~1 vez por hora si check es cada 60s
      guardarEvento('memoria', 'Check de memoria', status.memMB);
    }

    // Si memoria pasa el umbral Y no hay ganador NI promo activo, hacer reload
    // hayGanadorEnCurso cubre el delay antes de abrir el modal, donde
    // status.winner todavia es false. Si no, se perdia el ganador.
    if (status.memMB > memoryThresholdMB && !status.winner && !status.promo &&
        !hayGanadorEnCurso() && estado.pendingUpdates.length === 0) {
      logWarn('Memoria > ' + memoryThresholdMB + 'MB (actual: ' + status.memMB + 'MB) - RELOAD automatico');
      guardarEvento('reload_auto', 'Memoria excedida: ' + status.memMB + 'MB', status.memMB);

      // Persistir pending updates al disco antes de reload
      savePendingToDisk();

      estado.dashboardReady = false;
      estado.mainWindow.reload();
    } else if (status.memMB > memoryThresholdMB) {
      logInfo('Memoria alta (' + status.memMB + 'MB) pero hay actividad - reload pospuesto');
    }
  }, reloadCheckMs);

  // Watchdog rapido (cada 5s) para sincronizar estado ganador + promo
  setInterval(async () => {
    if (!estado.mainWindow || estado.mainWindow.isDestroyed()) return;

    const statusStr = await safeExecJs(`
      return JSON.stringify({
        winner: !!document.querySelector('.winner-modal.showing'),
        promo: !!document.querySelector('.promo-video.showing')
      });
    `);

    if (statusStr === null) return;

    let status;
    try { status = JSON.parse(statusStr); } catch (e) { return; }

    const winnerActive = status.winner;
    const promoActive = status.promo;

    // Seguridad: si se despacho un ganador y el modal nunca llego a verse,
    // liberar la marca para no bloquear la cola indefinidamente.
    if (estado.winnerDespachado && !winnerActive && !estado.isWinnerActive &&
        (Date.now() - estado.winnerDespachadoAt) > estado.winnerDespachoMaxMs) {
      logWarn('Ganador despachado pero el modal nunca aparecio' + textoPendiente() + ' - liberando cola');
      if (estado.ganadorPendiente) resolverAcreditado(2, estado.iasDetalleTimeout);
      programarFlushGanador();
    }

    // Si termino ganador o promo, procesar cola
    if ((estado.isWinnerActive && !winnerActive) || (estado.isPromoActive && !promoActive)) {
      const ganadorTermino = (estado.isWinnerActive && !winnerActive);
      if (ganadorTermino) {
        logInfo('Ganador termino, procesando cola');
        // Si el modal cerro sin recibir confirmSubida -> avisar al IAS (estado 2).
        if (estado.ganadorPendiente) {
          logInfo('confirmSubida NO llego (timeout modal)' + textoPendiente() + ' -> ActualizarEstadoAcreditado estado=2');
          resolverAcreditado(2, estado.iasDetalleTimeout);
        }
      }
      // Solo si hay algo esperando (si no, se escribia en cada promo).
      if (estado.isPromoActive && !promoActive && estado.pendingUpdates.length > 0) logInfo('Promo termino, procesando cola');
      estado.isPromoActive = promoActive;
      if (ganadorTermino) {
        // Respaldo por si el dashboard no pudo llamar a /winner-closed.
        // Si ya lo llamo, programarFlushGanador no hace nada (flag).
        programarFlushGanador();
      } else {
        estado.isWinnerActive = winnerActive;
        flushPendingUpdates();
      }
    } else {
      estado.isWinnerActive = winnerActive;
      estado.isPromoActive = promoActive;
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
