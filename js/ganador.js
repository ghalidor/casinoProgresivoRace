// ============================================================
// SISTEMA DE GANADOR + RECEPCION DE DATOS API
// ============================================================
(function () {
    window.__casinoHandlers = window.__casinoHandlers || {};

    // Confeti animation con canvas
    const confettiCanvas = document.getElementById("winnerConfetti");
    let confettiCtx,
        confettiParticles = [],
        confettiActive = false,
        confettiAnimId;

    function startConfetti() {
        if (!confettiCanvas) return;
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
        confettiCtx = confettiCanvas.getContext("2d");
        confettiParticles = [];
        const COLORS = ["#ffd700", "#ff3b3b", "#ffffff", "#ff8c00", "#00e5d4", "#ff4da6", "#8cff5a", "#ffe89a", "#c8902e"];
        // Generar 200 particulas festivas multicolor
        for (let i = 0; i < 200; i++) {
            confettiParticles.push({
                x: Math.random() * confettiCanvas.width,
                y: -20 - Math.random() * confettiCanvas.height,
                vx: (Math.random() - 0.5) * 5,
                vy: 3 + Math.random() * 5,
                size: 6 + Math.random() * 9,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
        }

        confettiActive = true;
        animateConfetti();
    }

    function animateConfetti() {
        if (!confettiActive) return;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        confettiParticles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravedad
            p.rot += p.rotSpeed;

            confettiCtx.save();
            confettiCtx.translate(p.x, p.y);
            confettiCtx.rotate(p.rot);
            confettiCtx.fillStyle = p.color;
            confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
            confettiCtx.restore();

            // Reciclar si sale del canvas
            if (p.y > confettiCanvas.height + 20) {
                p.y = -20;
                p.x = Math.random() * confettiCanvas.width;
                p.vy = 2 + Math.random() * 4;
            }
        });

        confettiAnimId = requestAnimationFrame(animateConfetti);
    }

    function stopConfetti() {
        confettiActive = false;
        if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
        if (confettiCtx) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }

    // Fuegos artificiales (chispas que explotan)
    function spawnFireworks() {
        const modal = document.getElementById("winnerModal");
        if (!modal) return;

        // Si hay vehiculo (grand/major), los fuegos salen a SU misma altura.
        let yCenter = 50,
            ySpread = 56;
        const veh = document.getElementById("winnerVehicleCenter");
        if (veh && veh.classList.contains("show")) {
            const r = veh.getBoundingClientRect();
            yCenter = ((r.top + r.bottom) / 2 / window.innerHeight) * 100;
            ySpread = 22;
        }

        for (let i = 0; i < 25; i++) {
            setTimeout(() => {
                const fw = document.createElement("div");
                fw.className = "firework";
                const x = 20 + Math.random() * 60; // 20%-80% pantalla
                const y = yCenter + (Math.random() - 0.5) * ySpread;
                fw.style.left = x + "%";
                fw.style.top = y + "%";
                fw.style.background = ["#ffd700", "#ff6600", "#00ff88", "#ffffff"][Math.floor(Math.random() * 4)];
                fw.style.boxShadow = "0 0 10px " + fw.style.background;
                fw.style.setProperty("--tx", (Math.random() - 0.5) * 200 + "px");
                fw.style.setProperty("--ty", (Math.random() - 0.5) * 200 + "px");
                fw.style.animation = "fireworkExplode 1.2s ease-out forwards";
                modal.appendChild(fw);
                setTimeout(() => fw.remove(), 1300);
            }, i * 80);
        }
    }

    // Mostrar modal de ganador
    function showWinnerModal(sheetId, amount, maquina, posicion, snapshotSprite) {
        const modal = document.getElementById("winnerModal");
        const titleEl = document.getElementById("winnerTitle");
        const msgEl = document.getElementById("winnerMessage");
        const amountEl = document.getElementById("winnerAmount");
        const machineEl = document.getElementById("winnerMachine");

        if (!modal) return;

        // Red de seguridad: nunca montar un ganador encima de otro.
        // El servidor ya encola los ganadores de a uno, asi que esto
        // no deberia pasar; si pasa, queda registrado.
        if (modal.classList.contains("showing")) {
            console.error("showWinnerModal ignorado: ya hay un ganador en pantalla",
                          { entrante: maquina, sheet: sheetId });
            return;
        }

        // Marcar el sheet activo del modal (lo usa /reinicio para decidir
        // si postergar o aplicar directo).
        window.__activeWinnerSheet = sheetId;

        // Configurar titulo segun la hoja (solo el nombre; "JACKPOT!" es fijo en el SVG)
        const titles = {
            mini: "MINI",
            minor: "MINOR",
            major: "MAJOR",
            grand: "GRAND",
        };
        const messages = {
            mini: "¡FELICIDADES POR GANAR!",
            minor: "¡FELICIDADES POR GANAR!",
            major: "¡FELICIDADES TE GANASTE LA MOTO!",
            grand: "¡FELICIDADES TE GANASTE EL AUTO!",
        };

        const nameEl = document.getElementById("winnerTitleName");
        const nombreTema = typeof temaNombre === "function" ? temaNombre(sheetId) : null;
        if (nameEl) nameEl.textContent = "¡" + (nombreTema || titles[sheetId] || "MINI");
        // Si SPRITE_CONFIG === false para grand/major, usar mensaje de "por ganar"
        // (no se muestra auto/moto en el modal: el premio es en efectivo).
        // Si nos pasaron snapshotSprite (estado al momento del ganador), usar ese
        // para evitar inconsistencias si el flag cambia durante el delay.
        const cfgGrand = snapshotSprite ? snapshotSprite.grand : window.SPRITE_CONFIG ? window.SPRITE_CONFIG.grand : true;
        const cfgMajor = snapshotSprite ? snapshotSprite.major : window.SPRITE_CONFIG ? window.SPRITE_CONFIG.major : true;
        const isSpriteOff = (sheetId === "grand" && cfgGrand === false) || (sheetId === "major" && cfgMajor === false);
        // el mismo estado (auto/moto o efectivo) vale hasta que cierre el modal, aunque el operador lo cambie
        window.__winnerSpriteOff = isSpriteOff;
        msgEl.textContent = isSpriteOff ? "¡FELICIDADES POR GANAR!" : messages[sheetId];

        // ============================================================
        // ACENTO DE COLOR por sheet (se aplica al borde del modal,
        // glow exterior y al brillo del sprite). El dorado base se
        // mantiene en banderas, trofeo y rayos.
        // ============================================================
        const accents = {
            mini: "#00ff66",
            minor: "#ff0033",
            major: "#ffaa00",
            grand: "#00e5d4",
        };
        modal.style.setProperty("--winner-accent", accents[sheetId] || "#ffd700");

        // ============================================================
        // SPRITE giratorio (auto/moto): UN solo vehiculo centrado, en el lugar
        // del monto. Solo grand/major. Mini/minor: oculto (son efectivo).
        // ============================================================
        const boxC = document.getElementById("winnerVehicleCenter");
        const sprC = document.getElementById("winnerSpriteCenter");
        if (boxC && sprC) {
            sprC.className = "winner-sprite"; // resetear
            boxC.classList.remove("show");
            // Si el flag SPRITE_CONFIG[sheet] === false, tratamos como mini/minor
            // (no se muestra el auto/moto en el modal: solo el monto en efectivo)
            const showSprite = !isSpriteOff;
            if (sheetId === "grand" && showSprite) {
                sprC.classList.add("winner-car");
                boxC.classList.add("show");
            } else if (sheetId === "major" && showSprite) {
                sprC.classList.add("winner-moto");
                boxC.classList.add("show");
            }
            // En mini/minor (o grand/major con flag=false) queda oculto (no .show)
        }

        // ============================================================
        // AUDIO del ganador. Si el archivo no existe, falla silencioso.
        // Volumen segun config (modalVideoVolume).
        // ============================================================
        const winnerAudio = document.getElementById("winnerAudio");
        if (winnerAudio) {
            try {
                winnerAudio.currentTime = 0;
                winnerAudio.volume = window.CASINO_CONFIG && window.CASINO_CONFIG.modalVideoVolume !== undefined ? window.CASINO_CONFIG.modalVideoVolume : 0.7;
                winnerAudio.muted = !!window.SONIDO_SILENCIADO; // boton de sonido (js/editor.js)
                const playPromise = winnerAudio.play();
                if (playPromise && playPromise.catch) {
                    playPromise.catch((e) => console.log("[WINNER] Audio no disponible:", e.message));
                }
            } catch (e) {
                console.log("[WINNER] Error reproduciendo audio:", e.message);
            }
        }

        const showAmountInModal = sheetId === "mini" || sheetId === "minor" || isSpriteOff;
        if (showAmountInModal) {
            // Marcar el modal con el sheet para que el loop globalAnimate
            // escriba el monto SINCRONIZADO con el sheet y el home.
            modal.dataset.sheet = sheetId;
            // Monto CONGELADO = lo que se gano. NO debe cambiar aunque lleguen
            // reinicios o updates mientras el modal esta visible.
            const wonCents = Math.round((amount || 0) * 100);
            modal.dataset.wonCents = wonCents;
            const amountText = document.getElementById("winnerAmountText");
            if (amountText) {
                amountText.textContent = "S/ " + (wonCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            amountEl.style.display = "inline-block";
        } else {
            modal.dataset.sheet = "";
            amountEl.style.display = "none";
        }

        const machineText = document.getElementById("winnerMachineText");
        if (machineText) {
            // Formato: "MAQUINA #102030-5" si hay posicion, sino "MAQUINA #102030"
            let maquinaStr = "MAQUINA #" + (maquina || "000");
            if (posicion !== undefined && posicion !== null && posicion !== "") {
                maquinaStr += "-" + posicion;
            }
            machineText.textContent = maquinaStr;
        }

        // Mostrar modal (winner-visible oculta la barra "SIGUIENTE VIDEO" mientras dure)
        modal.classList.add("showing");
        document.body.classList.add("winner-visible");
        startConfetti();

        // Disparar fuegos en oleadas
        spawnFireworks();
        setTimeout(spawnFireworks, 1500);
        setTimeout(spawnFireworks, 3000);

        // Ocultar mensaje de acreditacion de un ganador anterior
        const acrEl = document.getElementById("winnerAcreditado");
        if (acrEl) {
            acrEl.style.visibility = "hidden";
            acrEl.textContent = "";
            acrEl.className = "winner-acreditado";
        }
        // Flags para el caso 'no llego confirmSubida' (aviso rojo antes de cerrar).
        window.__winnerConfirmRecibido = false;
        window.__winnerAvisoSinConfirm = false;
        // Contador en color normal (por si el anterior termino en rojo).
        const cdInit = document.getElementById("winnerCountdown");
        if (cdInit) cdInit.classList.remove("extra");

        // Programar cierre (duracion configurada). Se puede EXTENDER si llega
        // confirmSubida cerca del final (ver window.casinoConfirmSubida).
        const durationSec = window.CASINO_CONFIG.winnerModalDurationSec || 12;
        programarCierreGanador(modal, Date.now() + durationSec * 1000);

        // Si el confirmSubida llego ANTES de abrir el modal, aplicarlo ahora.
        if (window.__pendingConfirm) {
            const pc = window.__pendingConfirm;
            window.__pendingConfirm = null;
            window.casinoConfirmSubida(pc);
        }

        console.log("[WINNER] Modal mostrado:", sheetId, "amount:", amount, "maquina:", maquina);
    }

    // Cierra el modal ganador y limpia todo (extraido para poder reprogramarlo).
    function cerrarModalGanador(modal) {
        // Avisar a main.js que el modal se cerro. Si no llego confirmSubida,
        // main.js reporta al IAS con estado 2. No bloquea el cierre.
        // La vista previa del editor no es un ganador: no se avisa.
        const eraPrueba = !!window.__ganadorDePrueba;
        window.__ganadorDePrueba = false;
        if (window.CASINO_API && !eraPrueba) {
            fetch(window.CASINO_API + "/winner-closed", { method: "POST" }).catch(function () {});
        }

        modal.classList.remove("showing");
        document.body.classList.remove("winner-visible");
        // Pausa entre ganadores (servidor) + espera del siguiente: si arrancara un video aqui,
        // el ganador que sigue en la cola lo cortaria al segundo. Se le da un margen.
        window.__promoBloqueadaHasta = Date.now() + 4000;
        stopConfetti();
        if (window.__winnerCountdownInterval) {
            clearInterval(window.__winnerCountdownInterval);
            window.__winnerCountdownInterval = null;
        }
        const wa = document.getElementById("winnerAudio");
        if (wa) {
            try {
                wa.pause();
                wa.currentTime = 0;
            } catch (e) {}
        }

        // Ocultar mensaje de acreditacion
        const acrEl = document.getElementById("winnerAcreditado");
        if (acrEl) {
            acrEl.style.visibility = "hidden";
            acrEl.textContent = "";
            acrEl.className = "winner-acreditado";
        }
        window.__pendingConfirm = null;
        window.__winnerCloseAt = 0;
        window.__winnerConfirmRecibido = false;
        window.__winnerAvisoSinConfirm = false;
        const cdEnd = document.getElementById("winnerCountdown");
        if (cdEnd) cdEnd.classList.remove("extra");

        // Limpiar sheet activo del modal
        const closedSheet = window.__activeWinnerSheet;
        window.__activeWinnerSheet = null;

        // Procesar reinicios que quedaron postergados para este sheet
        if (window.__pendingReinicios && window.__pendingReinicios.length > 0) {
            const remaining = [];
            window.__pendingReinicios.forEach((rData) => {
                if (rData.sheet === closedSheet) {
                    console.log("[API][REINICIO] Aplicando reinicio postergado:", rData.sheet);
                    window.__casinoHandlers.onUpdate(rData);
                } else {
                    remaining.push(rData);
                }
            });
            window.__pendingReinicios = remaining;
        }
    }

    // (Re)programa el cierre del modal para un instante absoluto (ms epoch).
    // Reajusta tambien el countdown visual. Se usa al abrir y al extender.
    function programarCierreGanador(modal, closeAtMs) {
        window.__winnerCloseAt = closeAtMs;
        const remaining = Math.max(0, closeAtMs - Date.now());

        if (window.__winnerCloseTimer) clearTimeout(window.__winnerCloseTimer);
        window.__winnerCloseTimer = setTimeout(() => alVencerTiempoGanador(modal), remaining);

        const countdownEl = document.getElementById("winnerCountdown");
        if (countdownEl) {
            if (window.__winnerCountdownInterval) clearInterval(window.__winnerCountdownInterval);
            let secsLeft = Math.ceil(remaining / 1000);
            countdownEl.textContent = secsLeft;
            window.__winnerCountdownInterval = setInterval(() => {
                secsLeft--;
                countdownEl.textContent = secsLeft > 0 ? secsLeft : 0;
                if (secsLeft <= 0) {
                    clearInterval(window.__winnerCountdownInterval);
                    window.__winnerCountdownInterval = null;
                }
            }, 1000);
        }
    }

    // Muestra el mensaje verde/rojo de acreditacion debajo del monto.
    function mostrarMensajeAcreditado(estado) {
        const el = document.getElementById("winnerAcreditado");
        if (!el) return;
        const okTxt = window.CASINO_CONFIG.msgAcreditadoOk || "Maquina acreditada correctamente";
        const errTxt = window.CASINO_CONFIG.msgAcreditadoError || "error al acreditar, verifique con el administrador";
        el.textContent = estado ? okTxt : errTxt;
        el.className = "winner-acreditado " + (estado ? "ok" : "error");
        el.style.visibility = "visible";
    }

    // Muestra en ROJO el aviso de que no llego confirmSubida.
    function mostrarMensajeSinConfirmacion() {
        const el = document.getElementById("winnerAcreditado");
        if (!el) return;
        const txt = window.CASINO_CONFIG.msgSinConfirmacion || "No se ha recibido confirmacion para la acreditacion";
        el.textContent = txt;
        el.className = "winner-acreditado error sin"; // "sin": el icono es un reloj (no llego), no una X
        el.style.visibility = "visible";
    }

    // Se llama cuando vence el tiempo del modal. Si NUNCA llego confirmSubida,
    // muestra el aviso rojo confirmMinDisplaySec segundos y RECIEN cierra.
    // (El envio al IAS con estado 2 sigue disparandose al cerrar, sin cambios.)
    function alVencerTiempoGanador(modal) {
        // grand/major con el sprite (moto/auto) visible: main.js ya acredito
        // automatico con estado 1. No se espera confirmSubida ni se muestra
        // ningun mensaje: el modal simplemente cierra.
        // Se usa el estado del momento en que se gano (el servidor decidio la acreditacion con ese)
        const shAuto = window.__activeWinnerSheet;
        const esAutoAcreditado = (shAuto === "grand" || shAuto === "major") && !window.__winnerSpriteOff;
        if (esAutoAcreditado) {
            cerrarModalGanador(modal);
            return;
        }

        if (!window.__winnerConfirmRecibido && !window.__winnerAvisoSinConfirm) {
            window.__winnerAvisoSinConfirm = true;
            mostrarMensajeSinConfirmacion();
            // Empieza la prorroga: contador en rojo.
            const cdEl = document.getElementById("winnerCountdown");
            if (cdEl) cdEl.classList.add("extra");
            const minMs = (window.CASINO_CONFIG.confirmMinDisplaySec || 8) * 1000;
            programarCierreGanador(modal, Date.now() + minMs);
            return;
        }
        cerrarModalGanador(modal);
    }

    // Llamada desde main.js cuando llega POST /confirmSubida.
    // Muestra el mensaje y garantiza que se vea minimo confirmMinDisplaySec.
    window.casinoConfirmSubida = function (payload) {
        const estado = !!(payload && payload.estado);
        const modal = document.getElementById("winnerModal");

        // Si el modal aun no abrio, guardar y aplicarlo al abrir. Solo si hay un ganador
        // en camino: una confirmacion tardia del ganador anterior no debe pasar al siguiente.
        if (!modal || !modal.classList.contains("showing")) {
            if (window.__winnerPending) window.__pendingConfirm = { estado: estado };
            return;
        }

        window.__winnerConfirmRecibido = true;
        mostrarMensajeAcreditado(estado);
        // si llego durante la prorroga, el contador vuelve a su color normal
        const cdConfirm = document.getElementById("winnerCountdown");
        if (cdConfirm) cdConfirm.classList.remove("extra");

        // Asegurar visibilidad minima: el mensaje se ve al menos minMs desde AHORA.
        // Si al modal ya le queda mas que eso, no se alarga.
        const minMs = (window.CASINO_CONFIG.confirmMinDisplaySec || 8) * 1000;
        const minCloseAt = Date.now() + minMs;
        if (minCloseAt > (window.__winnerCloseAt || 0)) {
            programarCierreGanador(modal, minCloseAt);
        }
    };

    // Handler de datos del API
    window.__casinoHandlers.onUpdate = function (data) {
        if (!data) return;

        // ============================================================
        // _endpoint === 'sprite-config': actualizar flag en vivo
        // ============================================================
        if (data._endpoint === "sprite-config") {
            if (data.sheet === "grand" || data.sheet === "major") {
                window.SPRITE_CONFIG[data.sheet] = !!data.show;
                console.log("[SPRITE_CONFIG] Actualizado:", data.sheet, "=", data.show);
                applySpriteConfig(data.sheet);
            }
            return;
        }

        // ============================================================
        // _endpoint === 'sprite-config-bulk': actualizar AMBOS flags
        // ============================================================
        if (data._endpoint === "sprite-config-bulk") {
            if (typeof data.grand === "boolean") window.SPRITE_CONFIG.grand = data.grand;
            if (typeof data.major === "boolean") window.SPRITE_CONFIG.major = data.major;
            console.log("[SPRITE_CONFIG] Bulk actualizado:", window.SPRITE_CONFIG);
            applySpriteConfig("grand");
            applySpriteConfig("major");
            return;
        }

        if (!data.sheet) return;

        console.log("[API] === UPDATE RECIBIDO ===", JSON.stringify(data));

        if (typeof globalAnimate === "undefined" || !globalAnimate.state) {
            console.warn("[API] globalAnimate.state no existe, reintentando en 500ms");
            setTimeout(() => window.__casinoHandlers.onUpdate(data), 500);
            return;
        }

        const state = globalAnimate.state;

        // ============================================================
        // ENDPOINT /reinicio: snap instantaneo del odometro mini/minor.
        // Si el modal ganador esta activo Y es del MISMO sheet, encolar
        // hasta que cierre. Si es OTRO sheet o no hay modal, aplicar ya.
        // No dispara modal, no es ganador.
        // ============================================================
        if (data._endpoint === "reinicio") {
            const isWinnerSameSheet = !!(window.__activeWinnerSheet && window.__activeWinnerSheet === data.sheet);

            if (isWinnerSameSheet) {
                // Postergar: guardar la peticion para aplicar cuando el modal cierre
                if (!window.__pendingReinicios) window.__pendingReinicios = [];
                window.__pendingReinicios.push(data);
                console.log("[API][REINICIO] Postergado (modal ganador del mismo sheet activo):", data.sheet);
                return;
            }

            // Aplicar snap directo: setear tanto el valor actual como el target al mismo valor
            // Aplica a los 4 sheets. En grand/major con sprite activo el monto no se
            // visualiza, pero igual queda actualizado para cuando se muestre en cash.
            if (data.sheet === "mini" || data.sheet === "minor" ||
                data.sheet === "grand" || data.sheet === "major") {
                if (!state.miniMinorOdo) state.miniMinorOdo = {};
                if (!state.miniMinorTarget) state.miniMinorTarget = {};
                const newCents = Math.round(data.amount * 100);
                state.miniMinorOdo[data.sheet] = newCents;
                state.miniMinorTarget[data.sheet] = newCents;
                console.log("[API][REINICIO] Snap aplicado:", data.sheet, "=", data.amount, "(centavos:", newCents, ")");
            }
            return;
        }

        // Log estado actual del target ANTES de actualizar
        if (state.miniMinorTarget) {
            console.log("[API] Target ANTES:", JSON.stringify(state.miniMinorTarget));
        }

        // ============================================================
        // ACTUALIZAR TARGET para que la animacion interpole hacia ese valor
        // (Esto siempre se hace, en modo prueba o produccion)
        // Para grand/major: solo si SPRITE_CONFIG[sheet] === false (modo cash)
        // ============================================================
        const targetIsCash = data.sheet === "mini" || data.sheet === "minor" || ((data.sheet === "grand" || data.sheet === "major") && window.SPRITE_CONFIG && window.SPRITE_CONFIG[data.sheet] === false);

        // El monto se GUARDA siempre para los 4 sheets, aunque el sprite
        // (moto/auto) este visible y el monto no se vea en pantalla. Asi,
        // al pasar a modo cash el odometro ya tiene el valor real acumulado.
        // targetIsCash sigue controlando solo la parte VISUAL (mas abajo).
        if (data.amount !== undefined) {
            if (data.amount !== undefined) {
                if (!state.miniMinorTarget) state.miniMinorTarget = {};
                if (!state.miniMinorOdo) state.miniMinorOdo = {};

                const newTargetCents = Math.round(data.amount * 100);
                const currentValue = state.miniMinorOdo[data.sheet] || 0;

                // Si el valor nuevo es MENOR que el actual, salto instantaneo (no animar bajando)
                if (newTargetCents < currentValue) {
                    console.log("[API] Valor menor recibido - salto instantaneo:", currentValue, "->", newTargetCents);
                    state.miniMinorOdo[data.sheet] = newTargetCents;
                    state.miniMinorTarget[data.sheet] = newTargetCents;
                } else {
                    // Valor mayor o igual: interpolar hacia el target (como antes)
                    state.miniMinorTarget[data.sheet] = newTargetCents;
                    console.log("[API] Target NUEVO:", data.sheet, "=", data.amount, "(centavos:", newTargetCents, "). Actual:", currentValue);
                }
            }
        }

        // ============================================================
        // ACTUALIZACION INMEDIATA del reel visual (sin esperar al loop)
        // Funciona aunque la hoja no este activa
        // ============================================================
        if (targetIsCash && data.amount !== undefined) {
            // Buscar la hoja correspondiente (este o no activa)
            const targetSheet = document.querySelector('.sheet[data-id="' + data.sheet + '"]');
            if (targetSheet) {
                const reels = targetSheet.querySelectorAll(".reel-strip");
                if (reels.length > 0) {
                    // Si es modo produccion, mostrar valor exacto
                    if (!window.CASINO_CONFIG.useTestData) {
                        // El loop interpolara desde miniMinorOdo hasta target suavemente
                        // pero forzamos que arranque desde el valor actual del DOM si esta vacio
                        if (!state.miniMinorOdo) state.miniMinorOdo = {};
                        if (state.miniMinorOdo[data.sheet] === undefined) {
                            state.miniMinorOdo[data.sheet] = 0;
                        }
                    }
                }
            }
        }

        // ============================================================
        // ACTUALIZAR odómetro del HOME y modal: YA NO se hace aqui.
        // Lo hace el loop globalAnimate via syncHomeAndModalOdometer(),
        // leyendo del MISMO state.miniMinorOdo que mueve el sheet.
        // Asi los 3 odometros suben juntos con la misma animacion.
        // ============================================================

        // ============================================================
        // GANADOR
        // ============================================================
        // Aceptar ganador como cualquier valor truthy: true, 1, "true", "1"
        const esGanador = data.ganador === true || data.ganador === 1 || data.ganador === "true" || data.ganador === "1";
        console.log("[API] Check ganador:", data.sheet, "| valor recibido:", JSON.stringify(data.ganador), "| typeof:", typeof data.ganador, "| esGanador:", esGanador);

        if (esGanador) {
            // 0 es valido (sin espera); solo si falta el valor se usan 5 s
            const espera = Number(window.CASINO_CONFIG.winnerDelaySec);
            const delay = (Number.isFinite(espera) && espera >= 0 ? espera : 5) * 1000;
            console.log("[API] GANADOR confirmado:", data.sheet, "- modal en", delay, "ms");

            // Capturar SPRITE_CONFIG al MOMENTO del ganador (no cuando se muestre el modal).
            // Si entre el push del ganador y el modal alguien cambia el flag, el modal
            // se muestra con el flag del momento en que se gano (consistencia).
            const snapshotSprite = {
                grand: window.SPRITE_CONFIG ? !!window.SPRITE_CONFIG.grand : true,
                major: window.SPRITE_CONFIG ? !!window.SPRITE_CONFIG.major : true,
            };

            // Marcar pendiente (util para evitar recarga por memoria durante el delay)
            window.__winnerPending = true;
            // empieza limpio: nada guardado del ganador anterior
            window.__pendingConfirm = null;

            // Si esta abierta la vista previa del modal (editor), se cierra para dejar lugar al real
            if (typeof window.cerrarGanadorDePrueba === "function") window.cerrarGanadorDePrueba();

            // El ganador tiene prioridad: si hay un video promo en pantalla, se corta ya
            if (typeof window.cerrarPromoAhora === "function") window.cerrarPromoAhora();

            // Para mini/minor: actualizar target a monto final ANTES del delay
            if ((data.sheet === "mini" || data.sheet === "minor") && data.amount !== undefined) {
                if (!state.miniMinorTarget) state.miniMinorTarget = {};
                state.miniMinorTarget[data.sheet] = Math.round(data.amount * 100);
            }

            setTimeout(() => {
                abrirGanadorEnSuTurno(data, snapshotSprite);
            }, delay);
        }
    };

    // Abre el modal ganador. El video promo se corta al llegar el ganador;
    // si por algo hay uno en pantalla al abrir, se corta ahora y el modal sale
    // cuando termina su animacion de salida (el sonido nunca se superpone).
    function abrirGanadorEnSuTurno(data, snapshotSprite) {
        if (document.querySelector(".promo-video.showing")) {
            console.log("[API] Ganador corta la promo en pantalla:", data.sheet);
            if (typeof window.cerrarPromoAhora === "function") window.cerrarPromoAhora();
            setTimeout(() => abrirGanadorEnSuTurno(data, snapshotSprite), 650);
            return;
        }
        try {
            showWinnerModal(data.sheet, data.amount, data.maquina, data.posicion, snapshotSprite);
        } catch (e) {
            console.error("[API] Error mostrando modal ganador:", e);
        }
        window.__winnerPending = false;
    }

    // Vista previa del modal para el editor de tema (Ctrl+Shift+T > Apariencia).
    // Muestra un ganador de ejemplo con el mensaje de acreditacion, sin avisar al
    // servidor ni cerrarse solo. No se abre si hay un ganador real en curso.
    window.mostrarGanadorDePrueba = function () {
        const modal = document.getElementById("winnerModal");
        if (!modal || window.__winnerPending || modal.classList.contains("showing")) return false;
        window.__ganadorDePrueba = true;
        showWinnerModal("minor", 4000, "000000", 1);
        if (window.__winnerCloseTimer) clearTimeout(window.__winnerCloseTimer);
        if (window.__winnerCountdownInterval) clearInterval(window.__winnerCountdownInterval);
        mostrarMensajeAcreditado(true);
        return true;
    };
    window.cerrarGanadorDePrueba = function () {
        const modal = document.getElementById("winnerModal");
        if (!window.__ganadorDePrueba || !modal) return;
        if (window.__winnerCloseTimer) clearTimeout(window.__winnerCloseTimer);
        cerrarModalGanador(modal);
    };

    // Funcion de prueba (para testing manual desde consola)
    window.testWinner = function (sheet, amount, maquina, posicion) {
        showWinnerModal(sheet || "mini", amount || 12345, maquina || "102030", posicion);
    };

    console.log("[API] Sistema de ganador iniciado");
    console.log('[API] Para probar manualmente: window.testWinner("mini", 12345, "102030", 5)');
    console.log('[API] Para enviar datos: window.casinoUpdate({sheet: "mini", amount: 5000, ganador: false, codSala: "S01", idRace: 1})');
    console.log("[CONFIG]", window.CASINO_CONFIG);
})();
