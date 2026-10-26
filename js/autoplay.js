// HACK: simular click humano para desbloquear autoplay de videos
// Se ejecuta apenas el body existe (antes de cualquier otra cosa)
(function () {
    function unlockAutoplay() {
        // Crear evento sintetico de pointer/click en el documento
        try {
            const event = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: window,
            });
            document.body.dispatchEvent(event);

            // Tambien tocar todos los videos para "marcarlos" como interactuados
            document.querySelectorAll("video").forEach((v) => {
                v.muted = true;
                const p = v.play();
                if (p) p.catch(() => {});
            });
            console.log("[AUTOPLAY HACK] click sintetico disparado");
        } catch (e) {
            console.warn("[AUTOPLAY HACK] error:", e.message);
        }
    }

    // Disparar varias veces en distintos momentos
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", unlockAutoplay);
    } else {
        unlockAutoplay();
    }
    window.addEventListener("load", unlockAutoplay);
    setTimeout(unlockAutoplay, 100);
    setTimeout(unlockAutoplay, 500);
    setTimeout(unlockAutoplay, 1500);
})();
