// =================================================================
// PROMO: mientras se ve el video, una placa abajo rota entre los 4 pozos
// (GRAND, MAJOR, MINOR, MINI) cada ROTAR_MS, con el mismo estilo del HOME.
// - Pozo en modo efectivo: muestra su monto (el mismo valor que el HOME).
// - GRAND/MAJOR con vehiculo (SPRITE_CONFIG true): muestra el premio fisico.
// Tambien muestra el letrero arriba a la izquierda. El tiempo del video lo
// maneja promos.js (#promoTimer).
// =================================================================
(function () {
    const caja = document.getElementById("promoPozos");
    const puntos = document.getElementById("promoPuntos");
    const marca = document.getElementById("promoMarca");
    if (!caja || !puntos) return;

    const ROTAR_MS = 2000;
    const POZOS = [
        { id: "grand", titulo: "GRAND", premio: "GANATE EL AUTO" },
        { id: "major", titulo: "MAJOR", premio: "GANATE LA MOTO" },
        { id: "minor", titulo: "MINOR" },
        { id: "mini", titulo: "MINI" },
    ];

    // Una placa por pozo; solo una visible a la vez
    caja.innerHTML = POZOS.map(
        (p) => `
    <div class="promo-placa" data-pozo="${p.id}" style="--pot-c: var(--c-${p.id})">
      <div class="promo-placa-titulo">${p.titulo}</div>
      <div class="promo-placa-monto"></div>
      <div class="promo-placa-premio">${p.premio || ""}</div>
    </div>`,
    ).join("");
    puntos.innerHTML = POZOS.map(() => "<i></i>").join("");
    const placas = [...caja.querySelectorAll(".promo-placa")];
    const marcas = [...puntos.querySelectorAll("i")];

    // Centavos actuales del pozo (los mismos que anima el HOME); null si no hay valor
    function centavos(id) {
        const st = typeof globalAnimate !== "undefined" && globalAnimate.state ? globalAnimate.state : null;
        if (!st || !st.miniMinorOdo || typeof st.miniMinorOdo[id] !== "number") return null;
        return st.miniMinorOdo[id];
    }

    // Monto como casillas: "S/." + digitos con coma de miles y 2 decimales
    function htmlMonto(cents) {
        const [ent, dec] = (cents / 100).toFixed(2).split(".");
        const chars = [...Number(ent).toLocaleString("en-US"), ".", ...dec];
        return '<span class="promo-soles">S/.</span>' + chars.map((c) => (/\d/.test(c) ? `<span class="promo-d"><b>${c}</b></span>` : `<span class="promo-p">${c}</span>`)).join("");
    }

    function conVehiculo(id) {
        return (id === "grand" || id === "major") && !(window.SPRITE_CONFIG && window.SPRITE_CONFIG[id] === false);
    }

    function actualizar() {
        placas.forEach((pl) => {
            const id = pl.dataset.pozo;
            const veh = conVehiculo(id);
            pl.classList.toggle("vehiculo", veh);
            if (veh) return;
            const cents = centavos(id);
            const html = htmlMonto(cents === null ? 0 : cents);
            const monto = pl.querySelector(".promo-placa-monto");
            if (monto.innerHTML !== html) monto.innerHTML = html;
        });
    }

    let actual = -1;
    let ultimoCambio = 0;
    function mostrar(i) {
        actual = i;
        ultimoCambio = performance.now();
        placas.forEach((pl, k) => pl.classList.toggle("activa", k === i));
        marcas.forEach((m, k) => m.classList.toggle("on", k === i));
    }

    let visible = false;
    setInterval(() => {
        const promoActiva = !!document.querySelector(".promo-video.showing");
        if (promoActiva !== visible) {
            visible = promoActiva;
            [caja, puntos, marca].forEach((el) => el && el.classList.toggle("showing", promoActiva));
            if (promoActiva) mostrar(0); // cada promo empieza por GRAND
        }
        if (!promoActiva) return;
        actualizar();
        if (performance.now() - ultimoCambio >= ROTAR_MS) mostrar((actual + 1) % placas.length);
    }, 150);
})();
