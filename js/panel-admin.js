(function () {
    const panel = document.getElementById("panelAdmin");
    const paso1 = document.getElementById("paPaso1");
    const paso2 = document.getElementById("paPaso2");
    const inputPin = document.getElementById("paPin");
    const pinError = document.getElementById("paPinError");
    const chkGrand = document.getElementById("paGrand");
    const chkMajor = document.getElementById("paMajor");
    const estado = document.getElementById("paEstado");
    const cajaLog = document.getElementById("paLog");
    const inputFiltro = document.getElementById("paFiltroMaquina");
    const contador = document.getElementById("paContador");
    let lineasLog = []; // ultimas lineas leidas (sin filtrar)

    function api(ruta, opciones) {
        if (!window.CASINO_API) return Promise.reject(new Error("API no disponible"));
        return fetch(window.CASINO_API + ruta, opciones).then((r) => r.json());
    }

    function abrir() {
        // Siempre pide el PIN al abrir
        paso1.style.display = "";
        paso2.style.display = "none";
        inputPin.value = "";
        pinError.textContent = "";
        estado.textContent = "";
        inputFiltro.value = "";
        panel.classList.add("abierto");
        setTimeout(() => inputPin.focus(), 50);
    }

    function cerrar() {
        panel.classList.remove("abierto");
        inputPin.value = "";
    }

    function entrar() {
        pinError.textContent = "";
        api("/admin/pin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: inputPin.value }),
        })
            .then((r) => {
                if (!r.ok) {
                    pinError.textContent = "PIN incorrecto";
                    inputPin.select();
                    return;
                }
                paso1.style.display = "none";
                paso2.style.display = "";
                cargarConfig();
                cargarLog();
            })
            .catch((e) => (pinError.textContent = "Error: " + e.message));
    }

    function cargarConfig() {
        api("/sprite-config")
            .then((c) => {
                chkGrand.checked = c.grand === true;
                chkMajor.checked = c.major === true;
            })
            .catch((e) => mostrarEstado("No se pudo leer: " + e.message, false));
    }

    function guardar() {
        mostrarEstado("Guardando...", true);
        // Mismo pedido que desde Postman
        api("/sprite-config-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ grand: chkGrand.checked, major: chkMajor.checked }),
        })
            .then((r) => {
                if (r.ok) mostrarEstado("Guardado", true);
                else mostrarEstado("Error: " + (r.error || "no se pudo guardar"), false);
            })
            .catch((e) => mostrarEstado("Error: " + e.message, false));
    }

    function mostrarEstado(texto, ok) {
        estado.textContent = texto;
        estado.className = "pa-msg " + (ok ? "ok" : "error");
    }

    function cargarLog() {
        cajaLog.textContent = "Cargando...";
        contador.textContent = "";
        api("/admin/log-ganadores")
            .then((r) => {
                lineasLog = r.lineas || [];
                dibujarLog();
            })
            .catch((e) => (cajaLog.textContent = "No se pudo leer el log: " + e.message));
    }

    // Dibuja el log aplicando el filtro de maquina (si hay).
    function dibujarLog() {
        cajaLog.textContent = "";
        const filtro = inputFiltro.value.trim().toLowerCase();
        const lineas = filtro ? filtrarPorMaquina(lineasLog, filtro) : lineasLog;

        if (lineasLog.length === 0) {
            cajaLog.textContent = "Sin movimientos de ganadores hoy ni ayer.";
        } else if (lineas.length === 0) {
            cajaLog.textContent = "No hay movimientos de esa maquina.";
        }
        lineas.forEach((l) => cajaLog.appendChild(crearLinea(l)));
        contador.textContent = filtro ? lineas.length + " de " + lineasLog.length + " lineas" : lineasLog.length + " lineas";
    }

    // Maquinas que aparecen en una linea: maquina=X, maquina X,
    // "maquina":"X", "CodMaquina":"X" y "en pantalla (X)".
    function maquinasDeLinea(linea) {
        const encontradas = [];
        const re = /maquina[=\s]+([\w-]+)|"(?:Cod)?[Mm]aquina"\s*:\s*"([^"]*)"|en pantalla \(([^)]+)\)/g;
        let m;
        while ((m = re.exec(linea)) !== null) {
            encontradas.push((m[1] || m[2] || m[3] || "").toLowerCase());
        }
        return encontradas;
    }

    // Id de la peticion: "peticion=7", "peticion 7" o "id=7".
    function idDeLinea(linea) {
        const m = linea.match(/(?:peticion[=\s]+|\bid=)(\d+)/);
        return m ? m[1] : null;
    }

    // Lineas de esa maquina + las del mismo id de peticion
    // (las respuestas del IAS solo traen el id, no la maquina).
    function filtrarPorMaquina(lineas, filtro) {
        const esDeLaMaquina = (l) => maquinasDeLinea(l).some((maq) => maq.includes(filtro));
        const ids = new Set();
        lineas.forEach((l) => {
            if (esDeLaMaquina(l)) {
                const id = idDeLinea(l);
                if (id) ids.add(id);
            }
        });
        return lineas.filter((l) => esDeLaMaquina(l) || ids.has(idDeLinea(l)));
    }

    // "[2026-09-16T19:09:29.859] [INFO] mensaje" -> "16/09 19:09:29  mensaje"
    function crearLinea(linea) {
        const div = document.createElement("div");
        div.className = "pa-linea";
        const m = linea.match(/^\[(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})[^\]]*\]\s*\[(\w+)\]\s*(.*)$/);
        let texto = linea;
        if (m) {
            const hora = document.createElement("span");
            hora.className = "hora";
            hora.textContent = m[3] + "/" + m[2] + " " + m[4];
            div.appendChild(hora);
            texto = m[6];
        }
        div.appendChild(document.createTextNode(texto));

        if (/FAIL|ERROR|RECHAZADO|descartado|NO llego|sin confirmSubida/.test(linea)) div.classList.add("mal");
        else if (/GANADOR recibido/.test(linea)) div.classList.add("ganador");
        else if (/ OK|confirmSubida OK/.test(linea)) div.classList.add("ok");
        return div;
    }

    document.getElementById("paCerrar").addEventListener("click", cerrar);
    document.getElementById("paEntrar").addEventListener("click", entrar);
    document.getElementById("paGuardar").addEventListener("click", guardar);
    document.getElementById("paActualizar").addEventListener("click", cargarLog);
    inputFiltro.addEventListener("input", dibujarLog);
    document.getElementById("paLimpiarFiltro").addEventListener("click", () => {
        inputFiltro.value = "";
        dibujarLog();
        inputFiltro.focus();
    });
    inputPin.addEventListener("keydown", (e) => {
        if (e.key === "Enter") entrar();
    });

    // Ctrl+Shift+C abre/cierra. Esc cierra.
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyC") {
            e.preventDefault();
            if (panel.classList.contains("abierto")) cerrar();
            else abrir();
        } else if (e.key === "Escape" && panel.classList.contains("abierto")) {
            cerrar();
        }
    });
})();
