// =================================================================
// VISTA HOME - diseno "riel de oro"
// homeDibujarRiel: dibuja el riel dorado alrededor de la hoja (pasa por el medio del
//   letrero), con LEDs, una ola de luz que los enciende y medallones en esquinas y costados.
// homeAjustarOdometros: dimensiona las casillas del odometro para llenar su espacio.
// Ambas las llama homePositionPots (principal.js) al mostrar el HOME y al redimensionar.
// =================================================================

const ORO_RIEL = [
    ["#6f3700", 1.06],
    ["#ffd24f", 1],
    ["#fff3a3", 0.93],
    ["#6f3700", 0.86],
    ["#ffd24f", 0.8],
    ["#0a0500", 0.7],
];

function homeDibujarRiel(sheet) {
    const svg = sheet.querySelector("#homeRiel");
    const letrero = sheet.querySelector(".home-marquee-title");
    if (!svg || !letrero) return;

    const W = sheet.clientWidth;
    const H = sheet.clientHeight;
    const t = H * 0.026;
    const m = t * 1.3;
    const r = H * 0.045;
    const T = t * 1.25; // grosor del riel
    const p = T * 0.42; // separacion entre LEDs
    const yTop = letrero.offsetTop + letrero.offsetHeight / 2; // el riel pasa por el medio del letrero

    const d = `M${m + r} ${yTop} H${W - m - r} A${r} ${r} 0 0 1 ${W - m} ${yTop + r} V${H - m - r} A${r} ${r} 0 0 1 ${W - m - r} ${H - m} H${m + r} A${r} ${r} 0 0 1 ${m} ${H - m - r} V${yTop + r} A${r} ${r} 0 0 1 ${m + r} ${yTop} Z`;
    const capa = (color, k, extra = "") => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${T * k}" stroke-linejoin="round" ${extra}/>`;
    const baja = `transform="translate(0 ${T * 0.32})"`;

    const medallon = (x, y, R, gema) => `
    <g transform="translate(${x} ${y})">
      <circle r="${R * 1.1}" fill="#1a0a00"/><circle r="${R}" fill="url(#rielOro)"/>
      <circle r="${R * 0.76}" fill="#2a1400" stroke="#ffe98a" stroke-width="${R * 0.06}"/>
      <rect class="gema" x="${-R * 0.42}" y="${-R * 0.42}" width="${R * 0.84}" height="${R * 0.84}" rx="${R * 0.1}" transform="rotate(45)" fill="url(#${gema})" stroke="#3a1d00" stroke-width="${R * 0.08}"/>
      <ellipse cx="${-R * 0.32}" cy="${-R * 0.4}" rx="${R * 0.32}" ry="${R * 0.13}" fill="rgba(255,255,255,.45)" transform="rotate(-30)"/>
    </g>`;

    // Medallones: esquinas del riel y costados a la altura del cruce de las cards
    const e = r * 0.29;
    const yCruce = H * 0.577;
    let medallones = "";
    [
        [m + e, yTop + e],
        [W - m - e, yTop + e],
        [m + e, H - m - e],
        [W - m - e, H - m - e],
    ].forEach(([x, y]) => (medallones += medallon(x, y, t * 1.25, "rielGema")));
    [
        [m, yCruce],
        [W - m, yCruce],
    ].forEach(([x, y]) => (medallones += medallon(x, y, t * 0.95, "rielRubi")));

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    // capa fija: sombra, canto, marco dorado, canal y LEDs apagados (no se redibuja)
    svg.innerHTML = `
    <defs>
      <radialGradient id="rielOro" cx="35%" cy="30%"><stop offset="0" stop-color="#fff8d2"/><stop offset=".35" stop-color="#ffd24f"/><stop offset=".75" stop-color="#9a5a08"/><stop offset="1" stop-color="#5a2e00"/></radialGradient>
      <radialGradient id="rielGema" cx="40%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffcc33"/><stop offset="1" stop-color="#b35d00"/></radialGradient>
      <radialGradient id="rielRubi" cx="40%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ff4d6a"/><stop offset="1" stop-color="#7a0010"/></radialGradient>
      <filter id="rielBrillo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${t * 0.25}"/></filter>
    </defs>
    <!-- sombra y canto 3D -->
    <path d="${d}" fill="none" stroke="rgba(0,0,0,.8)" stroke-width="${t * 1.7}" transform="translate(0 ${t * 0.35})" filter="url(#rielBrillo)"/>
    ${capa("#4f2e04", 1, baja)}${capa("#8f5a0b", 0.9, baja)}
    <!-- marco dorado doble con filo marron (como el letrero) -->
    ${ORO_RIEL.map(([c, k]) => capa(c, k)).join("")}
    <!-- canal oscuro con LEDs dorados tenues -->
    ${capa("#1a0e02", 0.5)}
    ${capa("rgba(255,194,26,.22)", 0.2, `stroke-linecap="round" stroke-dasharray="0 ${p}"`)}
  `;
    // capa animada: ola de luz que enciende los LEDs (brillo con trazos anchos, sin filtro) y medallones
    const anim = sheet.querySelector("#homeRielAnim");
    if (!anim) return;
    anim.setAttribute("viewBox", `0 0 ${W} ${H}`);
    anim.innerHTML = `
    <defs>
      <mask id="rielOlaMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <path class="ola" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="${T}" stroke-dasharray=".09 .91"/>
        <path class="ola2" d="${d}" pathLength="1" fill="none" stroke="#fff" stroke-width="${T}" stroke-dasharray=".09 .91"/>
      </mask>
    </defs>
    <g mask="url(#rielOlaMask)">
      ${capa("#ffd24f", 0.62, `stroke-linecap="round" stroke-dasharray="0 ${p}" stroke-opacity="0.3"`)}
      ${capa("#ffd24f", 0.34, `stroke-linecap="round" stroke-dasharray="0 ${p}"`)}
      ${capa("#fff6c4", 0.22, `stroke-linecap="round" stroke-dasharray="0 ${p}"`)}
    </g>
    ${medallones}
  `;
}

// Casillas del odometro: el tamano sale del espacio libre y de cuantas casillas se ven
// (minimo 6 para que el tamano no salte con montos chicos).
function homeAjustarOdometros() {
    document.querySelectorAll(".home-sheet .home-odometer").forEach((odo) => {
        if (!odo.offsetParent) return; // oculto (ej. GRAND/MAJOR con vehiculo)
        let numeros = 0;
        let signos = 0;
        odo.querySelectorAll(".home-digit:not(.home-digit-hidden)").forEach((dg) => {
            if (dg.classList.contains("comma")) signos++;
            else numeros++;
        });
        const W = odo.clientWidth;
        const H = odo.clientHeight;
        if (!W || !H) return;
        const n = Math.max(numeros, 6);
        const dw = Math.min(W / (n * 1.06 + signos * 0.36), H / 1.1);
        odo.style.setProperty("--dw", dw.toFixed(1) + "px");
    });
}

// Reajustar cuando aparecen/desaparecen casillas (el monto gana un digito) o cuando
// GRAND/MAJOR cambian entre vehiculo y odometro (sprite-off).
(function () {
    let pendiente = false;
    const observer = new MutationObserver(() => {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(() => {
            pendiente = false;
            homeAjustarOdometros();
        });
    });
    function observar() {
        const home = document.querySelector(".sheet.home-sheet");
        if (!home) return setTimeout(observar, 500);
        observer.observe(home, { subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    observar();
})();

// =================================================================
// FOCO POR TURNOS: cada HOME_FOCO_MS una card crece (las otras se achican)
// siguiendo GRAND -> MAJOR -> MINOR -> MINI, como un latido lento.
// =================================================================
const HOME_FOCO_MS = 5000;
window.homeFoco = 0;
// Estilo del foco: a latido, b al frente, c reflector (ver css/home-diseno.css)
if (!document.body.dataset.focoModo) document.body.dataset.focoModo = "a";

setInterval(() => {
    const home = document.querySelector(".sheet.home-sheet.active");
    if (!home || typeof homePositionPots !== "function") return;
    // capa del destello del estilo "reflector" (una vez por card)
    home.querySelectorAll(".home-pot").forEach((p) => {
        if (!p.querySelector(".home-destello")) p.insertAdjacentHTML("beforeend", '<i class="home-destello"></i><i class="home-brillo"></i>');
    });
    window.homeFoco = (window.homeFoco + 1) % 4;
    homePositionPots();
}, HOME_FOCO_MS);

// =================================================================
// OLA DE LUZ SOBRE LEDs (sin redibujar): inserta la estructura de .ola-led
// (css/home-diseno.css) al inicio del contenedor. La usan el HOME y las hojas.
// =================================================================
function olaLed(contenedor, donde = "afterbegin") {
    if (!contenedor || contenedor.querySelector(":scope > .ola-led")) return;
    contenedor.insertAdjacentHTML(donde, '<i class="ola-led"><i class="ola-banda"><i class="ola-puntos"></i></i></i>');
}
(function armarOlasHome() {
    const home = document.querySelector(".sheet.home-sheet");
    if (!home) return setTimeout(armarOlasHome, 500);
    home.querySelectorAll(".home-pot").forEach((p) => {
        olaLed(p);
        // capas del latido y de las animaciones de cada variante (css/variantes/)
        if (!p.querySelector(".home-destello")) p.insertAdjacentHTML("beforeend", '<i class="home-destello"></i><i class="home-brillo"></i>');
    });
    olaLed(home.querySelector(".home-marquee-title"));
})();
