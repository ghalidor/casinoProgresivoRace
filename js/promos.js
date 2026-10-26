(function () {
    // CONFIGURACION (editable):
    // Usar config global
    const PROMO_INTERVAL_SEC = window.CASINO_CONFIG.promoIntervalSec; // tiempo entre promos
    const PROMO_DURATION_SEC = window.CASINO_CONFIG.promoDurationSec; // duracion de cada promo

    function initPromoSystem() {
        const promoVideos = document.querySelectorAll(".promo-video");
        const vhsOverlay = document.getElementById("promoVhsOverlay");
        const glitchOverlay = document.getElementById("promoGlitch");
        const barFill = document.getElementById("nextPromoFill");
        const barText = document.getElementById("nextPromoText");

        if (!promoVideos.length || !barFill) {
            setTimeout(initPromoSystem, 500);
            return;
        }

        // Asegurar que esten muteados
        promoVideos.forEach((v) => {
            v.muted = true;
            v.volume = 0;
        });

        let countdown = PROMO_INTERVAL_SEC;
        let isShowingPromo = false;
        let lastPromoIdx = -1;

        function pickRandomPromo() {
            // Elegir aleatorio pero distinto del anterior
            let idx;
            do {
                idx = Math.floor(Math.random() * promoVideos.length);
            } while (idx === lastPromoIdx && promoVideos.length > 1);
            lastPromoIdx = idx;
            return promoVideos[idx];
        }

        // Avisa a main.js que la promo abrio/cerro (POST /promo-state).
        // Si falla, el watchdog de 5s de main.js lo detecta igual.
        function avisarPromo(activa) {
            if (!window.CASINO_API) return;
            fetch(window.CASINO_API + "/promo-state", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activa: activa }),
            }).catch(function () {});
        }

        function showPromo() {
            if (isShowingPromo) return;
            isShowingPromo = true;
            document.body.classList.add("promo-visible");

            const promo = pickRandomPromo();
            console.log("[PROMO] Mostrando:", promo.dataset.name, "paused:", promo.paused, "currentTime:", promo.currentTime);

            // Activar sonido y reproducir desde el inicio
            promo.muted = !!window.SONIDO_SILENCIADO; // boton de sonido (js/editor.js)
            // '|| 0.7' convertia el 0 en 0.7 (las promos sonaban con volumen 0).
            promo.volume = window.CASINO_CONFIG.modalVideoVolume !== undefined ? window.CASINO_CONFIG.modalVideoVolume : 0.7;
            promo.currentTime = 0;

            // Reproducir (con reintentos)
            const tryPlay = (attempts) => {
                promo
                    .play()
                    .then(() => {
                        console.log("[PROMO] Reproduciendo:", promo.dataset.name);
                    })
                    .catch((err) => {
                        // si la corto un ganador, no reintentar (quedaria reproduciendose oculto)
                        if (attempts > 0 && promo.classList.contains("showing")) setTimeout(() => tryPlay(attempts - 1), 100);
                    });
            };
            tryPlay(3);

            promo.classList.remove("hiding");
            promo.classList.add("showing");
            vhsOverlay.classList.add("showing");
            glitchOverlay.classList.add("showing");
            avisarPromo(true);

            // Mostrar el timer del propio video
            const promoTimer = document.getElementById("promoTimer");
            const promoTimerFill = document.getElementById("promoTimerFill");
            const promoTimerText = document.getElementById("promoTimerText");
            promoTimer.classList.add("showing");
            promoTimerFill.style.width = "100%";

            // Quitar glitch despues de su animacion (600ms)
            setTimeout(() => glitchOverlay.classList.remove("showing"), 600);

            // Watcher: garantizar que sigue reproduciendo
            const ensurePlay = () => {
                if (promo.paused && promo.classList.contains("showing")) {
                    promo.play().catch(() => {});
                }
            };
            ensurePlay();
            setTimeout(ensurePlay, 100);
            setTimeout(ensurePlay, 300);

            // Timer interno del promo: actualiza barra cada 100ms
            let promoStart = Date.now();
            const promoTimerId = setInterval(() => {
                const elapsed = (Date.now() - promoStart) / 1000;
                const remaining = Math.max(0, PROMO_DURATION_SEC - elapsed);
                const pct = (remaining / PROMO_DURATION_SEC) * 100;
                promoTimerFill.style.width = pct + "%";
                promoTimerText.textContent = Math.ceil(remaining) + "s";

                if (remaining <= 0) {
                    clearInterval(promoTimerId);
                }

                // Watcher: si el video se pauso solo, reanudarlo
                if (promo.paused && promo.classList.contains("showing")) {
                    promo.play().catch(() => {});
                }
            }, 100);
            promo._timerId = promoTimerId;

            // Cerrar despues de PROMO_DURATION_SEC (se cancela si la corta un ganador)
            promo._cierreId = setTimeout(() => hidePromo(promo), PROMO_DURATION_SEC * 1000);
        }

        function hidePromo(promo) {
            if (!promo.classList.contains("showing")) return; // ya se cerro (fin normal o cortada por ganador)
            console.log("[PROMO] Cerrando:", promo.dataset.name);
            clearTimeout(promo._cierreId);
            promo.classList.remove("showing");
            promo.classList.add("hiding");
            vhsOverlay.classList.remove("showing");
            avisarPromo(false);

            // Pausar y mutear el video para liberar CPU
            promo.pause();
            promo.muted = true;
            promo.volume = 0;
            promo.currentTime = 0;

            // Ocultar timer del promo
            const promoTimer = document.getElementById("promoTimer");
            promoTimer.classList.remove("showing");

            // Limpiar timer interno y listener
            if (promo._timerId) {
                clearInterval(promo._timerId);
                promo._timerId = null;
            }
            if (promo._onEnded) {
                promo.removeEventListener("ended", promo._onEnded);
                promo._onEnded = null;
            }

            // Despues de la animacion de salida, solo ocultar (NO pausar - asi sigue listo)
            setTimeout(() => {
                promo.classList.remove("hiding");
                // NO pausar: mantenemos los videos siempre reproduciendo en background
                isShowingPromo = false;
                document.body.classList.remove("promo-visible");
                countdown = PROMO_INTERVAL_SEC;
            }, 600);
        }

        // Llega un ganador: el video en pantalla se corta y el contador vuelve a empezar
        // (lo usa js/ganador.js; el ganador tiene prioridad sobre la promo)
        window.cerrarPromoAhora = function () {
            const promo = document.querySelector(".promo-video.showing");
            if (promo) hidePromo(promo);
        };

        // Vista previa desde el editor de tema: mostrar un video ahora
        window.mostrarPromoAhora = function () {
            // nunca encima de un ganador (en pantalla o en su espera)
            const modalGanador = document.getElementById("winnerModal");
            if (window.__winnerPending || (modalGanador && modalGanador.classList.contains("showing"))) return;
            if (!isShowingPromo) showPromo();
        };

        // Tick cada 1 segundo: actualizar contador y barra
        setInterval(() => {
            if (isShowingPromo) {
                // Mientras se muestra el promo, no avanza el contador externo
                // pero podemos mostrar el tiempo restante del video
                return;
            }

            // Turno del ganador: si hay uno en pantalla o esperando su
            // delay, la promo se pausa (no avanza ni arranca).
            const modalGanador = document.getElementById("winnerModal");
            if (window.__winnerPending || (modalGanador && modalGanador.classList.contains("showing"))) {
                return;
            }
            // recien cerro un ganador: si toca video, se espera el margen (puede venir otro de la cola)
            if (countdown <= 1 && Date.now() < (window.__promoBloqueadaHasta || 0)) {
                return;
            }

            countdown--;
            if (countdown <= 0) {
                showPromo();
                return;
            }

            // Actualizar UI
            const pct = ((PROMO_INTERVAL_SEC - countdown) / PROMO_INTERVAL_SEC) * 100;
            barFill.style.width = pct + "%";
            const txtSiguiente = (window.TEMA && window.TEMA.mensajes && window.TEMA.mensajes.siguienteVideo) || "SIGUIENTE VIDEO";
            barText.textContent = txtSiguiente + ": " + countdown + "s";
        }, 1000);

        console.log("[PROMO] Sistema iniciado (interval:", PROMO_INTERVAL_SEC + "s, duration:", PROMO_DURATION_SEC + "s)");
    }

    // Iniciar despues de que cargue el dashboard
    setTimeout(initPromoSystem, 2000);
})();
