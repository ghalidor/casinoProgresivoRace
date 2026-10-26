// =================================================================
// HOJAS DE LOS POZOS: placa bajo el odometro (o bajo el vehiculo).
// Cada vez que se muestra una hoja se elige al azar que placa lleva:
//   - "crece": ¡EL POZO SIGUE CRECIENDO! con flechas del color del pozo
//   - "hora":  hora y fecha actuales
// sin repetir la que tuvo esa misma hoja la vez anterior.
// =================================================================
(function () {
    const POZOS = ["mini", "minor", "major", "grand"];
    const PLACAS = ["crece", "hora"];
    const ultima = {};

    function armar(sheet) {
        if (sheet.querySelector(".hoja-extra")) return;
        sheet.insertAdjacentHTML(
            "beforeend",
            `<div class="hoja-extra">
        <div class="hoja-placa" data-placa="crece">
          <span class="hoja-flecha">▲</span>
          <div class="hoja-marco"><span class="hoja-txt">¡EL POZO SIGUE CRECIENDO!</span></div>
          <span class="hoja-flecha">▲</span>
        </div>
        <div class="hoja-placa" data-placa="hora">
          <div class="hoja-marco"><div><small>HORA</small><span class="hoja-txt hoja-hora"></span></div></div>
          <div class="hoja-marco"><div><small>FECHA</small><span class="hoja-txt hoja-fecha"></span></div></div>
        </div>
      </div>`,
        );
    }

    // olas de LEDs del letrero y del fondo de LEDs (sin redibujar; ver olaLed en home-diseno.js)
    function olas(sheet) {
        if (typeof olaLed !== "function") return;
        olaLed(sheet.querySelector(".sheet-letrero"));
        // al final, para no cambiar cual es el primer/ultimo <i> de los otros fondos
        if (sheet.dataset.fondo === "1") olaLed(sheet.querySelector(".hoja-fondo"), "beforeend");
    }

    function elegir(sheet) {
        const id = sheet.dataset.id;
        const opciones = PLACAS.filter((p) => p !== ultima[id]);
        const placa = opciones[Math.floor(Math.random() * opciones.length)];
        ultima[id] = placa;
        sheet.dataset.placa = placa;
    }

    function actualizarHora() {
        const ahora = new Date();
        const hora = ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
        const fecha = ahora.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "").toUpperCase();
        document.querySelectorAll(".hoja-hora").forEach((el) => (el.textContent !== hora ? (el.textContent = hora) : null));
        document.querySelectorAll(".hoja-fecha").forEach((el) => (el.textContent !== fecha ? (el.textContent = fecha) : null));
    }

    // Tamano del odometro: lo mas grande posible (hasta ZOOM_MAX segun la distribucion)
    // sin salirse del contenedor, aunque el monto gane digitos.
    function ajustarOdometro(sheet) {
        const fila = sheet.querySelector(".amount-frame .reel-row");
        const caja = sheet.querySelector(".amount-frame");
        if (!fila || !caja || !caja.offsetWidth) return;
        const dist = document.body.dataset.dHojas || "centrado";
        const zoomMax = dist === "gigante" ? 1.75 : dist === "inferior" ? 1.45 : 1.24;
        fila.style.setProperty("--zoom-odo", 1);
        const natural = fila.scrollWidth;
        const cs = getComputedStyle(caja);
        const libre = caja.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const zoom = Math.max(0.6, Math.min(zoomMax, (libre * 0.98) / natural));
        fila.style.setProperty("--zoom-odo", zoom.toFixed(3));
    }
    function ajustarTodos() {
        document.querySelectorAll(".sheet[data-id]:not(.home-sheet)").forEach(ajustarOdometro);
    }
    addEventListener("resize", () => setTimeout(ajustarTodos, 200));

    // Las hojas se crean al terminar la carga: esperar a que existan y vigilar cuando se activan
    function iniciar() {
        const hojas = POZOS.map((id) => document.querySelector('.sheet[data-id="' + id + '"]')).filter(Boolean);
        if (hojas.length < POZOS.length) return setTimeout(iniciar, 500);
        hojas.forEach((sheet) => {
            armar(sheet);
            olas(sheet);
            elegir(sheet);
            // cuando aparece/desaparece un digito (el monto crece) se reajusta el tamano
            let pendiente = false;
            new MutationObserver(() => {
                if (pendiente) return;
                pendiente = true;
                requestAnimationFrame(() => {
                    pendiente = false;
                    ajustarOdometro(sheet);
                });
            }).observe(sheet.querySelector(".amount-frame") || sheet, { subtree: true, attributes: true, attributeFilter: ["class"] });
            let activa = sheet.classList.contains("active");
            new MutationObserver(() => {
                const ahora = sheet.classList.contains("active");
                if (ahora && !activa) {
                    elegir(sheet);
                    requestAnimationFrame(() => ajustarOdometro(sheet));
                }
                activa = ahora;
            }).observe(sheet, { attributes: true, attributeFilter: ["class"] });
        });
        actualizarHora();
        setInterval(actualizarHora, 1000);
    }
    iniciar();
})();
