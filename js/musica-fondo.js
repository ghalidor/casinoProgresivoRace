(function () {
    function initBgMusic() {
        const bgMusic = document.getElementById("bgMusic");
        if (!bgMusic) {
            console.warn("[BG-MUSIC] elemento audio no existe");
            return;
        }

        const targetVolume = window.CASINO_CONFIG && window.CASINO_CONFIG.bgMusicVolume !== undefined ? window.CASINO_CONFIG.bgMusicVolume : 0.3;

        // Si volumen es 0, no reproducir
        if (targetVolume <= 0) {
            console.warn("[BG-MUSIC] Volumen 0 - musica desactivada");
            return;
        }

        bgMusic.volume = targetVolume;

        // Intentar reproducir (con reintentos por autoplay policy)
        function tryPlay(attempts) {
            bgMusic
                .play()
                .then(() => {
                    console.warn("[BG-MUSIC] Reproduciendo a volumen", targetVolume);
                })
                .catch((err) => {
                    if (attempts > 0) {
                        setTimeout(() => tryPlay(attempts - 1), 500);
                    } else {
                        console.error("[BG-MUSIC] No se pudo reproducir:", err.message);
                    }
                });
        }
        tryPlay(5);

        // Watchdog: cada 2s, revisar si hay modal ganador o promo activo
        // Si los hay -> silenciar. Si no -> volumen normal
        setInterval(() => {
            const isWinner = !!document.querySelector(".winner-modal.showing");
            const isPromo = !!document.querySelector(".promo-video.showing");

            if (isWinner || isPromo) {
                // Silenciar suavemente (fade out rapido)
                if (bgMusic.volume > 0.01) {
                    bgMusic.volume = Math.max(0, bgMusic.volume - 0.1);
                }
            } else {
                // Subir suavemente al volumen normal (fade in)
                if (bgMusic.volume < targetVolume) {
                    bgMusic.volume = Math.min(targetVolume, bgMusic.volume + 0.05);
                }
            }

            // Si por alguna razon se pauso, reanudar
            if (bgMusic.paused && !isWinner && !isPromo) {
                bgMusic.play().catch(() => {});
            }
        }, 2000);
    }

    // Esperar a que cargue todo
    if (document.readyState === "complete") {
        setTimeout(initBgMusic, 1500);
    } else {
        window.addEventListener("load", () => setTimeout(initBgMusic, 1500));
    }
})();
