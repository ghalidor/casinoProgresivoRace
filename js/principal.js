// ============================================================
// CONFIG GLOBAL - editable aqui o desde window.CASINO_CONFIG
// ============================================================
window.CASINO_CONFIG = window.CASINO_CONFIG || {
    promoIntervalSec: 30, // cada cuanto aparece video modal
    promoDurationSec: 8, // duracion de cada video modal
    kpiSpeed: 1.0, // velocidad KPIs (1.0=normal, 0.5=lento, 2.0=rapido)
    useTestData: true, // true=valores de prueba, false=espera servicio
    winnerDelaySec: 0, // delay antes del modal ganador (instantaneo)
    winnerModalDurationSec: 12, // duracion del modal ganador
    modalVideoVolume: 0.7, // volumen videos modales (0.0-1.0)
    bgMusicVolume: 0.3, // volumen musica de fondo (0.0-1.0)
    confirmMinDisplaySec: 8, // minimo que se muestra el mensaje de acreditacion
    msgAcreditadoOk: "Maquina acreditada correctamente",
    msgAcreditadoError: "error al acreditar, verifique con el administrador",
    msgSinConfirmacion: "No se ha recibido confirmacion para la acreditacion",
};

// API publica para datos externos:
// window.casinoUpdate({sheet: 'mini', amount: 12345.67, ganador: false, maquina: '102030'})
window.casinoUpdate = function (data) {
    console.log("[API] Datos recibidos:", data);
    if (window.__casinoHandlers && window.__casinoHandlers.onUpdate) {
        window.__casinoHandlers.onUpdate(data);
    }
};

// ============================================================
// SPRITE_CONFIG: controla si la hoja grand/major muestra el sprite
// (auto / moto) o se muestra como una hoja "cash" estilo mini/minor.
// El valor se carga desde el backend (/status) y se actualiza en vivo
// cuando llega un _endpoint === 'sprite-config'.
// ============================================================
window.SPRITE_CONFIG = { grand: true, major: true };

// ============================================================
// MARCADOR DE VERSION - si ves esto en consola, tienes la version NUEVA
// ============================================================
console.log("%c[DASHBOARD VERSION] v-sprite-config-2026-06-16 cargada", "background:#0f0;color:#000;font-size:16px;padding:6px;font-weight:bold");

function applySpriteConfig(sheetId) {
    if (sheetId !== "grand" && sheetId !== "major") return;
    const sheet = document.querySelector('.sheet[data-id="' + sheetId + '"]');
    const homePot = document.getElementById("home-pot-" + sheetId);
    if (!sheet && !homePot) {
        // Aun no estan en el DOM: reintentar en 200ms
        console.log("[SPRITE_CONFIG] DOM no listo para", sheetId, "- reintentando");
        setTimeout(() => applySpriteConfig(sheetId), 200);
        return;
    }
    const show = !!window.SPRITE_CONFIG[sheetId];
    console.log("[SPRITE_CONFIG] Aplicando", sheetId, "show=", show);

    if (sheet) {
        sheet.classList.toggle("sprite-off", !show);
        const sub = sheet.querySelector(".sheet-subtitle");
        if (sub) {
            // texto del tema editable (js/tema.js); si aun no cargo, el de siempre
            const deTema = typeof temaSubtitulo === "function" ? temaSubtitulo(sheetId, show) : null;
            if (deTema) sub.textContent = deTema;
            else if (!show) sub.textContent = "GANATE EFECTIVO";
            else sub.textContent = sheetId === "grand" ? "GANATE EL AUTO" : "GANATE LA MOTO";
        }
    }
    if (homePot) {
        homePot.classList.toggle("sprite-off", !show);
        const homeSub = homePot.querySelector(".home-pot-subtitle");
        if (homeSub) {
            const deTema = typeof temaSubtitulo === "function" ? temaSubtitulo(sheetId, show) : null;
            if (deTema) homeSub.textContent = deTema;
            else if (!show) homeSub.textContent = "GANATE EFECTIVO";
            else homeSub.textContent = sheetId === "grand" ? "GANATE EL AUTO" : "GANATE LA MOTO";
        }
        // la distribucion "jerarquia" acomoda las cards segun si MAJOR muestra la moto
        if (document.body.dataset.dHome === "jerarquia") homePositionPots();
    }
}

function applyAllSpriteConfig() {
    applySpriteConfig("grand");
    applySpriteConfig("major");
}

// Aplicar clase production-mode al body si useTestData es false
// (para pausar animaciones CSS de los reels)
function applyProductionMode() {
    if (!window.CASINO_CONFIG.useTestData) {
        document.body.classList.add("production-mode");
        console.log("[CONFIG] Modo PRODUCCION activado (animaciones CSS pausadas)");
    } else {
        document.body.classList.remove("production-mode");
        console.log("[CONFIG] Modo PRUEBA activado (animaciones CSS automaticas)");
    }
}
if (document.body) applyProductionMode();
else document.addEventListener("DOMContentLoaded", applyProductionMode);

// =================================================================
// CONFIGURACION DE HOJAS - aqui se editan los valores individuales
// =================================================================
const SHEETS_DATA = [
    // Vista HOME (vista principal con la pista y los 4 jackpots)
    {
        id: "home",
        title: "PROGRESIVO RACE",
        subtitle: "INICIO",
        accent: "#ffd700",
        theme: "home",
        type: "home",
    },
    {
        id: "mini",
        title: "MINI",
        subtitle: "GANATE EFECTIVO",
        accent: "#00ff66",
        theme: "green",
        type: "reels",
        amountStart: [0, 0, 0, 0, 0, 0, 0],
        amountEnd: [0, 0, 0, 0, 0, 0, 0],
        temp: 65,
        gear: 4,
        kmh: 178,
        fuel: 62,
        rpm: 3200,
        speed: 178,
        progress: 35,
        stats: { gear: "4", kmh: "178", rpm: "3200", marcha: "4", velocidad: "178", temp: "OK", aceite: "OK", freno: "OK", combustible: "62%", bateria: "OK", status: "ACTIVE" },
    },
    {
        id: "minor",
        title: "MINOR",
        subtitle: "GANATE EFECTIVO",
        accent: "#ff0033",
        theme: "red",
        type: "reels",
        amountStart: [0, 0, 0, 0, 0, 0, 0],
        amountEnd: [0, 0, 0, 0, 0, 0, 0],
        temp: 70,
        gear: 5,
        kmh: 220,
        fuel: 75,
        rpm: 5800,
        speed: 220,
        progress: 60,
        stats: { gear: "5", kmh: "220", rpm: "5800", marcha: "5", velocidad: "220", temp: "OK", aceite: "OK", freno: "OK", combustible: "75%", bateria: "OK", status: "ACTIVE" },
    },
    {
        id: "major",
        title: "MAJOR",
        subtitle: "GANATE LA MOTO",
        accent: "#ffcc00",
        theme: "yellow",
        type: "moto",
        rpm: 4450,
        speed: 64,
        fuel: 42,
        gear: 3,
        progress: 88,
        temp: 83,
        kmh: 64,
        stats: { gear: "3", kmh: "64", rpm: "4450", marcha: "3", velocidad: "64", temp: "OK", aceite: "OK", freno: "OK", combustible: "42%", bateria: "OK", status: "ACTIVE" },
    },
    {
        id: "grand",
        title: "GRAND",
        subtitle: "GANATE EL AUTO",
        accent: "#00e5d4",
        theme: "turquoise",
        type: "car",
        rpm: 6800,
        speed: 240,
        fuel: 88,
        gear: 6,
        progress: 95,
        temp: 78,
        kmh: 240,
        odometer: 12345,
        battery: 95,
        stats: { gear: "6", kmh: "240", rpm: "6800", marcha: "6", velocidad: "240", temp: "OK", aceite: "OK", freno: "OK", combustible: "88%", bateria: "95%", status: "ACTIVE" },
    },
];

const SHEET_DURATION = 8000; // 8 segundos por hoja (sheets de jackpot)
let HOME_DURATION = 60000; // 60 segundos para la vista HOME (se sobrescribe con config)
const TRANSITION_DURATION = 800; // duracion del slide

// Cargar la config del servidor (endpoint /status) y aplicarla al dashboard.
// Antes solo se leia homeViewDurationSec; ahora tambien se aplican los demas
// valores que usa el frontend, para que config.json controle el dashboard.
// URL del API: main.js la pasa por query string (?api=...) al cargar.
// window.CASINO_API recien se inyecta en did-finish-load, despues de esto.
const API_BASE = new URLSearchParams(location.search).get("api") || "http://127.0.0.1:3000";

fetch(API_BASE + "/status")
    .then((r) => r.json())
    .then((s) => {
        if (!s || !s.config) return;
        const c = s.config;

        // Solo las claves que usa el frontend (si vienen en el config del server).
        const CLAVES_UI = ["promoIntervalSec", "promoDurationSec", "kpiSpeed", "useTestData", "winnerDelaySec", "winnerModalDurationSec", "modalVideoVolume", "bgMusicVolume", "confirmMinDisplaySec", "msgAcreditadoOk", "msgAcreditadoError", "msgSinConfirmacion"];
        CLAVES_UI.forEach((k) => {
            if (c[k] !== undefined) window.CASINO_CONFIG[k] = c[k];
        });

        // homeViewDurationSec controla la duracion de la hoja HOME.
        if (c.homeViewDurationSec) {
            HOME_DURATION = c.homeViewDurationSec * 1000;
        }

        // useTestData pudo cambiar: re-aplicar modo produccion/prueba (clase CSS).
        applyProductionMode();

        console.log("[CONFIG] Config del servidor aplicada:", window.CASINO_CONFIG);
    })
    .catch((e) => {
        console.warn("[STATUS] fetch fallo, se usa config por defecto:", e.message);
    });

// Cargar SPRITE_CONFIG con reintento (independiente del fetch /status)
function loadSpriteConfig(intentos) {
    intentos = intentos || 0;
    fetch(API_BASE + "/sprite-config")
        .then((r) => r.json())
        .then((cfg) => {
            if (cfg && typeof cfg.grand === "boolean") window.SPRITE_CONFIG.grand = cfg.grand;
            if (cfg && typeof cfg.major === "boolean") window.SPRITE_CONFIG.major = cfg.major;
            console.log("[SPRITE_CONFIG] Cargado del servidor:", window.SPRITE_CONFIG);
            // Aplicar (con retry interno si DOM aun no tiene las hojas)
            applyAllSpriteConfig();
        })
        .catch((e) => {
            console.warn("[SPRITE_CONFIG] fetch fallo (intento " + intentos + "):", e.message);
            // Reintentar hasta 5 veces, cada 2s (cubre arranques de Electron donde HTTP aun no esta listo)
            if (intentos < 5) {
                setTimeout(() => loadSpriteConfig(intentos + 1), 2000);
            }
        });
}
loadSpriteConfig();

// Helper: devuelve la duracion correcta segun la hoja (HOME usa HOME_DURATION)
function getDurationForSheet(idx) {
    const data = SHEETS_DATA[idx];
    if (data && data.id === "home") return HOME_DURATION;
    return SHEET_DURATION;
}

let currentSheetIdx = 0;
let nextChangeTime = 0;
let progressBarPath = null;
let progressBarLength = 0;

// =================================================================
// CONSTRUIR EL ESCUDO SVG SEGUN LA HOJA ACTIVA
// =================================================================
function buildShield(sheetData) {
    // Si la hoja es HOME, usar un theme "dorado/neutral" - el dashboard construye su escudo normal
    // (el HOME ya no tiene escudo propio - usa el del dashboard)

    const svg = document.getElementById("shieldSvg");
    const w = window.innerWidth;
    const h = window.innerHeight;
    const screenRatio = w / h;

    const VBH = 620;
    let VBW;
    if (screenRatio > 1.13) {
        VBW = Math.round(VBH * screenRatio);
    } else {
        VBW = 700;
    }

    svg.setAttribute("viewBox", `0 0 ${VBW} ${VBH}`);

    const CX = VBW / 2;
    let SH_HALF = 80;
    let SH_OUTER = 110;
    let SH_TOP = 0;
    const FLAT_TOP = 22;

    // Hojas de pozo: el tramo elevado del camino pasa justo por el borde superior del
    // letrero y baja por sus costados hasta la linea de arriba del escudo.
    const conLetrero = ["mini", "minor", "major", "grand"].includes(sheetData.id);
    if (conLetrero) {
        const letrero = document.querySelector('.sheet[data-id="' + sheetData.id + '"] .sheet-letrero');
        if (letrero && letrero.offsetWidth) {
            const esc = Math.min(w / VBW, h / VBH);
            const ox = (w - VBW * esc) / 2;
            const oy = (h - VBH * esc) / 2;
            const izq = (letrero.offsetLeft - ox) / esc; // borde izquierdo del letrero en el viewBox
            const arriba = (letrero.offsetTop - oy) / esc; // borde superior del letrero en el viewBox
            // el camino rodea el letrero por fuera (separado SEP) para que el borde del
            // letrero no lo tape: TL_SH_TOP_LEFT + 12 = izq - SEP y pTc = arriba - SEP
            const SEP = 10;
            SH_OUTER = 6;
            SH_HALF = CX - izq + 12 + SEP;
            SH_TOP = Math.max(-14, Math.min(arriba - 24.5 - SEP, FLAT_TOP - 4));
        }
    }
    const SX0 = 8;
    const SX1 = VBW - 8;
    const ST = FLAT_TOP;
    const SY_TOP = SH_TOP;
    const TL_SH_END = CX - SH_HALF - SH_OUTER;
    const TL_SH_TOP_LEFT = CX - SH_HALF;
    const TL_SH_TOP_RIGHT = CX + SH_HALF;
    const TL_SH_END_RIGHT = CX + SH_HALF + SH_OUTER;
    const BB_OUT_L = CX - 130;
    const BB_IN_L = CX - 110;
    const BB_IN_R = CX + 110;
    const BB_OUT_R = CX + 130;

    // PATHS
    const mainPath = `M ${SX0},${ST} L ${TL_SH_END},${ST} L ${TL_SH_TOP_LEFT},${SY_TOP} L ${TL_SH_TOP_RIGHT},${SY_TOP} L ${TL_SH_END_RIGHT},${ST} L ${SX1},${ST} Q ${SX1 + 20},${ST} ${SX1 + 20},${ST + 20} L ${SX1 + 20},${VBH - ST - 20} Q ${SX1 + 20},${VBH - ST} ${SX1},${VBH - ST} L ${BB_OUT_R},${VBH - ST} L ${BB_IN_R},${VBH - 2} L ${BB_IN_L},${VBH - 2} L ${BB_OUT_L},${VBH - ST} L ${SX0},${VBH - ST} Q ${SX0 - 20},${VBH - ST} ${SX0 - 20},${VBH - ST - 20} L ${SX0 - 20},${ST + 20} Q ${SX0 - 20},${ST} ${SX0},${ST} Z`;
    const goldPath = `M ${SX0 + 18},${ST + 18} L ${TL_SH_END + 10},${ST + 18} L ${TL_SH_TOP_LEFT + 10},${SY_TOP + 18} L ${TL_SH_TOP_RIGHT - 10},${SY_TOP + 18} L ${TL_SH_END_RIGHT - 10},${ST + 18} L ${SX1 - 18},${ST + 18} Q ${SX1 + 2},${ST + 18} ${SX1 + 2},${ST + 38} L ${SX1 + 2},${VBH - ST - 38} Q ${SX1 + 2},${VBH - ST - 18} ${SX1 - 18},${VBH - ST - 18} L ${BB_OUT_R - 12},${VBH - ST - 18} L ${BB_IN_R - 12},${VBH - 20} L ${BB_IN_L + 12},${VBH - 20} L ${BB_OUT_L + 12},${VBH - ST - 18} L ${SX0 + 18},${VBH - ST - 18} Q ${SX0 - 2},${VBH - ST - 18} ${SX0 - 2},${VBH - ST - 38} L ${SX0 - 2},${ST + 38} Q ${SX0 - 2},${ST + 18} ${SX0 + 18},${ST + 18} Z`;
    const innerPath = `M ${SX0 + 31},${ST + 31} L ${TL_SH_END + 14},${ST + 31} L ${TL_SH_TOP_LEFT + 14},${SY_TOP + 31} L ${TL_SH_TOP_RIGHT - 14},${SY_TOP + 31} L ${TL_SH_END_RIGHT - 14},${ST + 31} L ${SX1 - 31},${ST + 31} Q ${SX1 - 11},${ST + 31} ${SX1 - 11},${ST + 51} L ${SX1 - 11},${VBH - ST - 51} Q ${SX1 - 11},${VBH - ST - 31} ${SX1 - 31},${VBH - ST - 31} L ${BB_OUT_R - 26},${VBH - ST - 31} L ${BB_IN_R - 26},${VBH - 33} L ${BB_IN_L + 26},${VBH - 33} L ${BB_OUT_L + 26},${VBH - ST - 31} L ${SX0 + 31},${VBH - ST - 31} Q ${SX0 + 11},${VBH - ST - 31} ${SX0 + 11},${VBH - ST - 51} L ${SX0 + 11},${ST + 51} Q ${SX0 + 11},${ST + 31} ${SX0 + 31},${ST + 31} Z`;

    // BARRA DE PROGRESO: sigue exactamente el promedio entre goldPath e innerPath
    // Empieza en el centro superior y recorre todo el perimetro (sentido horario)
    //
    // PROMEDIO entre dorada (offset 18) y roja delgada (offset 31):
    // - Y top plana: ST + 24.5    (entre ST+18 y ST+31)
    // - Y top central: SY_TOP + 24.5   (entre SY_TOP+18 y SY_TOP+31)
    // - Y bottom plana: VBH - ST - 24.5
    // - Y bottom central: VBH - 26.5
    // - X lateral derecho vertical: SX1 - 4.5  (entre SX1+2 y SX1-11)
    // - X lateral izquierdo vertical: SX0 + 4.5  (entre SX0-2 y SX0+11)
    // - Esquinas (curvas Q): se promedian tambien

    const pT = ST + 24.5; // y top parte plana
    const pTc = SY_TOP + 24.5; // y top parte central elevada
    const pB = VBH - ST - 24.5; // y bottom parte plana
    const pBc = VBH - 26.5; // y bottom parte central baja
    const pR = SX1 - 4.5; // x lateral derecho vertical
    const pL = SX0 + 4.5; // x lateral izquierdo vertical
    const pXR = SX1 - 24.5; // x donde el top/bottom plano termina y empieza la curva derecha
    const pXL = SX0 + 24.5; // x donde el top/bottom plano empieza desde la curva izquierda

    // Path: empieza en centro superior, va horario completo, vuelve al inicio
    const progressPath = [
        `M ${CX} ${pTc}`,
        // Top derecha: del centro hacia la diagonal del shoulder
        `L ${TL_SH_TOP_RIGHT - 12} ${pTc}`,
        // Diagonal del shoulder (sube hacia el tramo plano)
        `L ${TL_SH_END_RIGHT - 12} ${pT}`,
        // Tramo plano superior derecho hasta antes de la curva
        `L ${pXR} ${pT}`,
        // Curva esquina superior derecha
        `Q ${pR} ${pT} ${pR} ${ST + 44.5}`,
        // Lateral derecho vertical
        `L ${pR} ${VBH - ST - 44.5}`,
        // Curva esquina inferior derecha
        `Q ${pR} ${pB} ${pXR} ${pB}`,
        // Tramo plano inferior derecho hasta el shoulder bottom
        `L ${BB_OUT_R - 19} ${pB}`,
        // Diagonal shoulder bottom derecho (baja al centro)
        `L ${BB_IN_R - 19} ${pBc}`,
        // Centro inferior plano (entre los dos shoulders bottom)
        `L ${BB_IN_L + 19} ${pBc}`,
        // Diagonal shoulder bottom izquierdo (sube)
        `L ${BB_OUT_L + 19} ${pB}`,
        // Tramo plano inferior izquierdo
        `L ${pXL} ${pB}`,
        // Curva esquina inferior izquierda
        `Q ${pL} ${pB} ${pL} ${VBH - ST - 44.5}`,
        // Lateral izquierdo vertical (sube)
        `L ${pL} ${ST + 44.5}`,
        // Curva esquina superior izquierda
        `Q ${pL} ${pT} ${pXL} ${pT}`,
        // Tramo plano superior izquierdo hasta antes del shoulder
        `L ${TL_SH_END + 12} ${pT}`,
        // Diagonal del shoulder izquierdo (sube al centro elevado)
        `L ${TL_SH_TOP_LEFT + 12} ${pTc}`,
        // Cierra al centro superior
        `L ${CX} ${pTc}`,
    ].join(" ");

    // PATH INTERIOR para el auto (solo HOME): misma forma del escudo pero
    // todas las coordenadas desplazadas OFFSET pixeles hacia adentro.
    const OFFSET_INNER = 14;
    const i_pT = pT + OFFSET_INNER;
    const i_pTc = pTc + OFFSET_INNER;
    const i_pB = pB - OFFSET_INNER;
    const i_pBc = pBc - OFFSET_INNER;
    const i_pR = pR - OFFSET_INNER;
    const i_pL = pL + OFFSET_INNER;
    const i_pXR = pXR - OFFSET_INNER;
    const i_pXL = pXL + OFFSET_INNER;
    const innerProgressPath = [`M ${CX} ${i_pTc}`, `L ${TL_SH_TOP_RIGHT - 12 - OFFSET_INNER} ${i_pTc}`, `L ${TL_SH_END_RIGHT - 12 - OFFSET_INNER} ${i_pT}`, `L ${i_pXR} ${i_pT}`, `Q ${i_pR} ${i_pT} ${i_pR} ${ST + 44.5 + OFFSET_INNER}`, `L ${i_pR} ${VBH - ST - 44.5 - OFFSET_INNER}`, `Q ${i_pR} ${i_pB} ${i_pXR} ${i_pB}`, `L ${BB_OUT_R - 19 - OFFSET_INNER} ${i_pB}`, `L ${BB_IN_R - 19 - OFFSET_INNER} ${i_pBc}`, `L ${BB_IN_L + 19 + OFFSET_INNER} ${i_pBc}`, `L ${BB_OUT_L + 19 + OFFSET_INNER} ${i_pB}`, `L ${i_pXL} ${i_pB}`, `Q ${i_pL} ${i_pB} ${i_pL} ${VBH - ST - 44.5 - OFFSET_INNER}`, `L ${i_pL} ${ST + 44.5 + OFFSET_INNER}`, `Q ${i_pL} ${i_pT} ${i_pXL} ${i_pT}`, `L ${TL_SH_END + 12 + OFFSET_INNER} ${i_pT}`, `L ${TL_SH_TOP_LEFT + 12 + OFFSET_INNER} ${i_pTc}`, `L ${CX} ${i_pTc}`].join(" ");

    // BOMBILLOS
    const bulbSpacing = 40;
    const bulbs = [];

    for (let x = SX0 + 40; x < TL_SH_END - 10; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: ST, delay: ((x % 100) * 0.01).toFixed(2) });
    }
    for (let x = TL_SH_TOP_LEFT + 15; x < TL_SH_TOP_RIGHT - 10; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: SY_TOP, delay: ((x % 100) * 0.012).toFixed(2) });
    }
    bulbs.push({ cx: (TL_SH_END + TL_SH_TOP_LEFT) / 2, cy: (ST + SY_TOP) / 2, delay: "0.15" });
    bulbs.push({ cx: (TL_SH_TOP_RIGHT + TL_SH_END_RIGHT) / 2, cy: (SY_TOP + ST) / 2, delay: "0.25" });
    for (let x = TL_SH_END_RIGHT + 30; x < SX1 - 10; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: ST, delay: ((x % 100) * 0.011).toFixed(2) });
    }
    for (let y = ST + 50; y < VBH - ST - 30; y += 50) {
        bulbs.push({ cx: SX0 - 20, cy: y, delay: ((y % 100) * 0.008).toFixed(2) });
    }
    for (let y = ST + 50; y < VBH - ST - 30; y += 50) {
        bulbs.push({ cx: SX1 + 20, cy: y, delay: ((y % 100) * 0.009).toFixed(2) });
    }
    for (let x = SX0 + 40; x < BB_OUT_L - 5; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: VBH - ST, delay: ((x % 100) * 0.013).toFixed(2) });
    }
    bulbs.push({ cx: (BB_OUT_L + BB_IN_L) / 2, cy: (VBH - ST + VBH - 2) / 2, delay: "0.4" });
    bulbs.push({ cx: (BB_IN_R + BB_OUT_R) / 2, cy: (VBH - ST + VBH - 2) / 2, delay: "0.5" });
    for (let x = BB_IN_L + 15; x < BB_IN_R - 10; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: VBH - 2, delay: ((x % 100) * 0.014).toFixed(2) });
    }
    for (let x = BB_OUT_R + 20; x < SX1 - 10; x += bulbSpacing) {
        bulbs.push({ cx: x, cy: VBH - ST, delay: ((x % 100) * 0.015).toFixed(2) });
    }

    const screwOff = 20;
    const screws = [
        { cx: SX0 + screwOff, cy: ST + screwOff + 18 },
        { cx: SX1 - screwOff, cy: ST + screwOff + 18 },
        { cx: SX0 + screwOff, cy: VBH - ST - screwOff - 18 },
        { cx: SX1 - screwOff, cy: VBH - ST - screwOff - 18 },
    ];

    const flagW = 64;
    const flagH = 14;
    const flagL_x = TL_SH_END + 10;
    const flagR_x = TL_SH_END_RIGHT - flagW - 10;
    const flag_y = ST + 18;

    // Color de la malla y la linea delgada interna segun el theme
    let gridStrokeColor, innerLineColor;
    if (sheetData.theme === "green") {
        gridStrokeColor = "#00cc44";
        innerLineColor = "rgba(0,255,102,0.7)";
    } else if (sheetData.theme === "yellow") {
        gridStrokeColor = "#ffaa00";
        innerLineColor = "rgba(255,204,0,0.7)";
    } else if (sheetData.theme === "turquoise") {
        gridStrokeColor = "#00aa99";
        innerLineColor = "rgba(0,229,212,0.75)";
    } else if (sheetData.theme === "home") {
        gridStrokeColor = "#ffaa00";
        innerLineColor = "rgba(255,215,0,0.6)";
    } else {
        gridStrokeColor = "#ff0033";
        innerLineColor = "rgba(255,0,51,0.7)";
    }

    // Color del neon que recorre el borde: en MINI/MINOR un tono fluorescente mas vivo
    const NEON = { mini: "#39ff14", minor: "#ff2d6f", major: "#ffe81a", grand: "#19fff0" };
    const neon = NEON[sheetData.id] || sheetData.accent;

    let svgContent = `
    <defs>
      <linearGradient id="redLine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c43a4e"/>
        <stop offset="25%" stop-color="#9e1f2f"/>
        <stop offset="50%" stop-color="#7a0016"/>
        <stop offset="75%" stop-color="#56000e"/>
        <stop offset="100%" stop-color="#380007"/>
      </linearGradient>
      <linearGradient id="redSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="22%" stop-color="#ffd6de" stop-opacity="0.55"/>
        <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="goldStroke" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd600"/>
        <stop offset="40%" stop-color="#ff8800"/>
        <stop offset="60%" stop-color="#b8860b"/>
        <stop offset="100%" stop-color="#ffd600"/>
      </linearGradient>
      <radialGradient id="bigBulb" cx="40%" cy="35%" r="50%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="20%" stop-color="#fff8c0"/>
        <stop offset="45%" stop-color="#ffd700"/>
        <stop offset="75%" stop-color="#ff8800"/>
        <stop offset="100%" stop-color="#cc4400"/>
      </radialGradient>
      <radialGradient id="bulbHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd700" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#ff8800" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#ff8800" stop-opacity="0"/>
      </radialGradient>
      <pattern id="gridInner" width="22" height="22" patternUnits="userSpaceOnUse">
        <path d="M 22 0 L 0 0 0 22" fill="none" stroke="${gridStrokeColor}" stroke-width="0.6" opacity="0.55"/>
      </pattern>
      <filter id="bigGlow"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>

    <!-- FONDO: cuadricula que cubre toda la hoja (color sigue al tema) -->
    <rect x="0" y="0" width="${VBW}" height="${VBH}" fill="url(#gridInner)" opacity="0.7"/>

    <path d="${mainPath}" fill="rgba(0,0,0,0.55)"/>
    <path d="${mainPath}" fill="url(#gridInner)" opacity="0.7"/>

    <!-- BARRA DE PROGRESO: track (fondo tenue) -->
    <path d="${progressPath}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Path reutilizable para la moto (animateMotion lo usa por id) -->
    <path id="progressPathDef" d="${progressPath}" fill="none" stroke="none" pathLength="1"/>

    <!-- BARRA DE PROGRESO: glow exterior amplio -->
    <!-- (stroke-dasharray/offset del grupo se heredan a sus trazos; el brillo son capas anchas y tenues, sin filtros) -->
    <g id="progressBarGlow" fill="none" stroke="${neon}" stroke-linecap="round" style="opacity: ${conLetrero ? 0.85 : 0.6}; stroke-dasharray: 1; stroke-dashoffset: 1;">
      <path d="${progressPath}" pathLength="1" stroke-width="${conLetrero ? 26 : 16}" stroke-opacity="0.1"/>
      <path d="${progressPath}" pathLength="1" stroke-width="${conLetrero ? 18 : 11}" stroke-opacity="0.18"/>
      <path d="${progressPath}" pathLength="1" stroke-width="${conLetrero ? 11 : 7}" stroke-opacity="0.32"/>
    </g>
    <!-- BARRA DE PROGRESO: fill principal con brillo intenso -->
    <g id="progressBar" fill="none" stroke-linecap="round" style="stroke-dasharray: 1; stroke-dashoffset: 1;">
      <path d="${progressPath}" pathLength="1" stroke="${neon}" stroke-width="${conLetrero ? 9 : 7}" stroke-opacity="0.35"/>
      <path d="${progressPath}" pathLength="1" stroke="${neon}" stroke-width="${conLetrero ? 6 : 5}" stroke-opacity="0.6"/>
      <path d="${progressPath}" pathLength="1" stroke="${neon}" stroke-width="${conLetrero ? 3.5 : 3}"/>
      <path d="${progressPath}" pathLength="1" stroke="#fff" stroke-width="1.3" stroke-opacity="0.75"/>
    </g>
    ${
        sheetData.id === "home"
            ? `

    <!-- HOME: PATH INTERIOR para el auto (haz de luz propio) -->
    <path id="autoPathDef" d="${innerProgressPath}" fill="none" stroke="none" pathLength="1"/>
    <path id="autoBarGlow" d="${innerProgressPath}" fill="none" stroke="#00e5d4" stroke-width="6" stroke-linecap="round"
      style="filter: blur(4px) drop-shadow(0 0 8px #00e5d4); opacity: 0.6; stroke-dasharray: 1; stroke-dashoffset: 1;"
      pathLength="1"/>
    <path id="autoBar" d="${innerProgressPath}" fill="none" stroke="#00e5d4" stroke-width="3" stroke-linecap="round"
      style="filter: drop-shadow(0 0 4px #fff) drop-shadow(0 0 8px #00e5d4) drop-shadow(0 0 16px #00e5d4); stroke-dasharray: 1; stroke-dashoffset: 1;"
      pathLength="1"/>

    <!-- HOME: moto visual sobre el camino existente; no toca el contador/progreso -->
    <g id="motoRunner">
      ${typeof iconoPremioSvg === "function" ? iconoPremioSvg("major", -30, -15, 60, 30) : '<image href="img/moto.png" x="-30" y="-15" width="60" height="30"/>'}
    </g>
    <!-- HOME: auto recorriendo el camino INTERIOR (al lado opuesto de la moto) -->
    <g id="autoRunner">
      ${typeof iconoPremioSvg === "function" ? iconoPremioSvg("grand", -32, -14, 64, 28) : '<image href="img/auto.png" x="-32" y="-14" width="64" height="28"/>'}
    </g>
    `
            : sheetData.id === "major"
              ? `
    <!-- MOTO en la barra de progreso -->
    <g id="motoRunner">
      ${typeof iconoPremioSvg === "function" ? iconoPremioSvg("major", -30, -15, 60, 30) : '<image href="img/moto.png" x="-30" y="-15" width="60" height="30"/>'}
    </g>
    `
              : sheetData.id === "grand"
                ? `
    <!-- AUTO en la barra de progreso -->
    <g id="motoRunner">
      ${typeof iconoPremioSvg === "function" ? iconoPremioSvg("grand", -32, -14, 64, 28) : '<image href="img/auto.png" x="-32" y="-14" width="64" height="28"/>'}
    </g>
    `
                : `
    <!-- Punta brillante: cabeza blanca que va llenando -->
    <g id="progressBarHead" fill="none" stroke-linecap="round" style="stroke-dasharray: ${conLetrero ? 0.008 : 0.005} 1; stroke-dashoffset: 1;">
      <path d="${progressPath}" pathLength="1" stroke="${neon}" stroke-width="${conLetrero ? 18 : 12}" stroke-opacity="0.3"/>
      <path d="${progressPath}" pathLength="1" stroke="#fff" stroke-width="${conLetrero ? 11 : 7}" stroke-opacity="0.45"/>
      <path d="${progressPath}" pathLength="1" stroke="#fff" stroke-width="${conLetrero ? 6 : 3.5}"/>
    </g>
    `
    }
  `;

    // Tornillos con id e ids para poder encenderlos cuando el runner los alcanza
    svgContent += '<g class="corner-screws">';
    screws.forEach((s, idx) => {
        // en MINI/MINOR el circulo queda como aro de luz detras del medallon
        svgContent += `<circle id="screw-${idx}" class="corner-screw" data-cx="${s.cx}" data-cy="${s.cy}" cx="${s.cx}" cy="${s.cy}" r="${conLetrero ? 13 : 6}" fill="#1a0000" stroke="url(#goldStroke)" stroke-width="1.5"/>`;
    });
    svgContent += "</g>";
    if (conLetrero) {
        // Medallon dorado con gema (como los del HOME). Lleva la clase screw-cross para
        // girar con la misma logica de los tornillos cuando pasa el neon.
        svgContent += `<defs>
          <radialGradient id="medOro" cx="35%" cy="30%"><stop offset="0" stop-color="#fff8d2"/><stop offset=".35" stop-color="#ffd24f"/><stop offset=".75" stop-color="#9a5a08"/><stop offset="1" stop-color="#5a2e00"/></radialGradient>
          <radialGradient id="medGema" cx="40%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#ffcc33"/><stop offset="1" stop-color="#b35d00"/></radialGradient>
        </defs>`;
        screws.forEach((s, idx) => {
            const R = 11;
            svgContent += `<g class="screw-cross" data-screw="${idx}">
              <circle cx="${s.cx}" cy="${s.cy}" r="${R}" fill="url(#medOro)" stroke="#1a0a00" stroke-width="1.2"/>
              <circle cx="${s.cx}" cy="${s.cy}" r="${R * 0.76}" fill="#2a1400" stroke="#ffe98a" stroke-width="0.7"/>
              <rect x="${s.cx - R * 0.42}" y="${s.cy - R * 0.42}" width="${R * 0.84}" height="${R * 0.84}" rx="1" transform="rotate(45 ${s.cx} ${s.cy})" fill="url(#medGema)" stroke="#3a1d00" stroke-width="0.8"/>
              <ellipse cx="${s.cx - R * 0.32}" cy="${s.cy - R * 0.4}" rx="${R * 0.32}" ry="${R * 0.13}" fill="rgba(255,255,255,.45)" transform="rotate(-30 ${s.cx - R * 0.32} ${s.cy - R * 0.4})"/>
            </g>`;
        });
    } else {
        svgContent += '<g class="corner-crosses" stroke="#ffd600" stroke-width="1.2" stroke-linecap="round" style="filter: drop-shadow(0 0 1.5px #000) drop-shadow(0 0 3px rgba(0,0,0,0.8));">';
        screws.forEach((s, idx) => {
            svgContent += `<line class="screw-cross" data-screw="${idx}" x1="${s.cx - 5}" y1="${s.cy}" x2="${s.cx + 5}" y2="${s.cy}"/>`;
            svgContent += `<line class="screw-cross" data-screw="${idx}" x1="${s.cx}" y1="${s.cy - 5}" x2="${s.cx}" y2="${s.cy + 5}"/>`;
        });
        svgContent += "</g>";
    }

    // HOME no muestra banderas a cuadros (no son carrera de jackpot)
    if (sheetData.id !== "home" && !conLetrero) {
        [flagL_x, flagR_x].forEach((fx) => {
            svgContent += `<rect x="${fx}" y="${flag_y}" width="${flagW}" height="${flagH}" fill="#000" stroke="#ffd600" stroke-width="0.8"/>`;
            svgContent += '<g fill="#fff">';
            svgContent += `<rect x="${fx}" y="${flag_y}" width="11" height="7"/>`;
            svgContent += `<rect x="${fx + 22}" y="${flag_y}" width="11" height="7"/>`;
            svgContent += `<rect x="${fx + 44}" y="${flag_y}" width="11" height="7"/>`;
            svgContent += `<rect x="${fx + 11}" y="${flag_y + 7}" width="11" height="7"/>`;
            svgContent += `<rect x="${fx + 33}" y="${flag_y + 7}" width="11" height="7"/>`;
            svgContent += `<rect x="${fx + 55}" y="${flag_y + 7}" width="9" height="7"/>`;
            svgContent += "</g>";
        });
    }

    svg.innerHTML = svgContent;
    const anim = document.getElementById("shieldAnimSvg");
    if (anim) {
        anim.setAttribute("viewBox", svg.getAttribute("viewBox"));
        anim.innerHTML = "";
        ["progressBarGlow", "progressBar", "progressBarHead", "autoBarGlow", "autoBar", "motoRunner", "autoRunner"].forEach((id) => {
            const el = svg.querySelector("#" + id);
            if (el) anim.appendChild(el);
        });
    }
    progressBarPath = document.getElementById("progressBar");

    // Restaurar el progreso real INMEDIATAMENTE (no dejar la barra en 0).
    // Si el shield se reconstruye (resize, modal cerrandose, etc) y estamos
    // a mitad del HOME/sheet, la barra debe seguir donde estaba.
    if (progressBarPath && nextChangeTime > 0) {
        const now = performance.now();
        const curDuration = getDurationForSheet(currentSheetIdx);
        const remaining = nextChangeTime - now;
        const elapsed = curDuration - remaining;
        const progress = Math.max(0, Math.min(1, elapsed / curDuration));
        const offset = (1 - progress).toFixed(4);
        progressBarPath.style.strokeDashoffset = offset;
        const glow = document.getElementById("progressBarGlow");
        const head = document.getElementById("progressBarHead");
        if (glow) glow.style.strokeDashoffset = offset;
        if (head) head.style.strokeDashoffset = offset;
    }
}

// Helper: bottom-row con CALOR + GEAR/KM/H/TEMP/STATUS (mini/minor + grand/major sprite-off)
function buildBottomRowHTML(data) {
    return `
    <div class="bottom-row">
      <div class="thermometer">
        <div class="thermo-label">CALOR</div>
        <div class="thermo-tube-wrap">
          <div class="thermo-tube">
            <div class="thermo-fill" style="height:${data.temp}%"></div>
            <div class="bubble" style="left:4px;animation-delay:0s;"></div>
            <div class="bubble" style="left:7px;animation-delay:0.8s;"></div>
          </div>
        </div>
        <div class="thermo-bulb"></div>
        <div class="thermo-value">${data.temp}%</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        <div class="kpis-chain-wrap">
          <svg class="kpis-chain-svg" viewBox="0 0 800 120" preserveAspectRatio="none">
            <defs>
              <radialGradient id="concave-${data.id}" cx="0.5" cy="0.5" r="0.7">
                <stop offset="0%" stop-color="#000"/>
                <stop offset="60%" stop-color="${data.accent}33"/>
                <stop offset="100%" stop-color="${data.accent}66"/>
              </radialGradient>
            </defs>
            <path d="M 5 30 L 160 30 Q 200 30 200 60 Q 200 90 160 90 L 5 90 Z"
                  fill="#000" stroke="${data.accent}" stroke-width="3"/>
            <path d="M 15 35 L 160 35 Q 192 35 192 50" fill="none" stroke="${data.accent}" stroke-width="1.5" opacity="0.45"/>
            <path d="M 180 10 Q 140 10 140 60 Q 140 110 180 110 L 360 110 Q 400 110 400 60 Q 400 10 360 10 Z"
                  fill="#000" stroke="${data.accent}" stroke-width="3"/>
            <path d="M 195 18 Q 152 18 152 50 M 360 18 Q 392 18 392 50" fill="none" stroke="${data.accent}" stroke-width="1.5" opacity="0.45"/>
            <path d="M 380 30 Q 340 30 340 60 Q 340 90 380 90 L 560 90 Q 600 90 600 60 Q 600 30 560 30 Z"
                  fill="#000" stroke="${data.accent}" stroke-width="3"/>
            <path d="M 392 35 Q 352 35 352 50 M 560 35 Q 592 35 592 50" fill="none" stroke="${data.accent}" stroke-width="1.5" opacity="0.45"/>
            <path d="M 580 10 Q 540 10 540 60 Q 540 110 580 110 L 795 110 L 795 10 Z"
                  fill="#000" stroke="${data.accent}" stroke-width="3"/>
            <path d="M 595 18 Q 552 18 552 50" fill="none" stroke="${data.accent}" stroke-width="1.5" opacity="0.45"/>
          </svg>
          <div class="kpis-chain-overlay">
            <div class="chain-cell">
              <div class="stat-label">GEAR</div>
              <div class="stat-value" style="color:#ffd600;text-shadow:0 0 6px #ffd600;">${data.stats.gear}</div>
            </div>
            <div class="chain-cell">
              <div class="stat-label">KM/H</div>
              <div class="stat-value blink" style="color:#ff8800;text-shadow:0 0 6px #ff8800;">${data.stats.kmh}</div>
            </div>
            <div class="chain-cell">
              <div class="stat-label">TEMP</div>
              <div class="stat-value" style="color:${data.accent};text-shadow:0 0 6px ${data.accent};">${data.stats.temp}</div>
            </div>
            <div class="chain-cell">
              <div class="stat-label">STATUS</div>
              <div class="stat-value blink" style="color:#00ff66;text-shadow:0 0 6px #00ff66;font-size:1.3cqw;margin-top:2px;">${data.stats.status}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Helper: HTML del odometro con reels (mini/minor + grand/major cuando sprite-off)
function buildAmountFrameHTML() {
    const reels = [0, 0, 0, 0, 0, 0, 0, 0].map((_, idx) => {
        const digits = [];
        for (let d = 0; d < 11; d++) digits.push(`<span>${d % 10}</span>`);
        const hidden = idx <= 4 ? " reel-hidden" : "";
        return `<div class="reel-digit${hidden}"><div class="reel-strip" data-digit="0">${digits.join("")}</div></div>`;
    });
    const reelHTML = `
    <span class="reel-prefix">S/.</span>
    ${reels[0]}${reels[1]}${reels[2]}
    <span class="reel-sep comma reel-hidden">,</span>
    ${reels[3]}${reels[4]}${reels[5]}
    <span class="reel-sep dot">.</span>
    ${reels[6]}${reels[7]}
  `;
    return `
    <div class="amount-frame">
      <svg class="amount-frame-neon" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <rect class="neon-pulse-glow" x="0" y="0" fill="none" stroke="#ffaa00"
              stroke-linecap="round" rx="8" ry="8" style="width:100%; height:100%;"/>
        <rect class="neon-pulse-mid" x="0" y="0" fill="none" stroke="#ffaa00"
              stroke-linecap="round" rx="8" ry="8" style="width:100%; height:100%;"/>
        <rect class="neon-pulse" x="0" y="0" fill="none" stroke="#ffd700"
              stroke-linecap="round" rx="8" ry="8" style="width:100%; height:100%;"/>
      </svg>
      <div class="reel-row">${reelHTML}</div>
    </div>
  `;
}

// =================================================================
// CONSTRUIR UNA HOJA DEL CARRUSEL
// =================================================================
function buildSheet(data) {
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.dataset.theme = data.theme;
    sheet.dataset.id = data.id;
    sheet.style.setProperty("--theme-accent", data.accent);
    // Fondo animado de cada pozo: 1 LEDs, 2 rayos, 3 pista, 4 velocidad (css/hojas-diseno.css)
    const FONDO_HOJA = { mini: "1", minor: "3", major: "2", grand: "4" };
    if (FONDO_HOJA[data.id]) sheet.dataset.fondo = FONDO_HOJA[data.id];

    // Despachar segun tipo de hoja
    if (data.type === "home") {
        return buildHomeSheet(data, sheet);
    }
    if (data.type === "moto") {
        return buildMotoSheet(data, sheet);
    }
    if (data.type === "car") {
        return buildCarSheet(data, sheet);
    }

    // Reels SIEMPRE empiezan en 0 - JS los pone en su lugar
    // (helper compartido con buildMotoSheet / buildCarSheet)
    const amountFrameHTML = buildAmountFrameHTML();

    sheet.innerHTML = `
    <div class="scan-line"></div>
    <div class="spark-dot" style="top:18%;left:18%;animation-delay:0s;"></div>
    <div class="spark-dot" style="top:22%;right:18%;animation-delay:0.6s;"></div>
    <div class="spark-dot" style="bottom:18%;left:18%;animation-delay:0.8s;"></div>
    <div class="spark-dot" style="bottom:22%;right:18%;animation-delay:0.2s;"></div>

    <!-- fondo animado de la hoja (estilo en css/hojas-diseno.css) -->
    <div class="hoja-fondo"><i></i><i></i></div>

    <div class="sheet-letrero">
      <div class="sheet-title">${data.title}</div>
      <div class="sheet-subtitle">${data.subtitle}</div>
    </div>

    ${amountFrameHTML}

    ${buildBottomRowHTML(data)}
  `;

    return sheet;
}

// =================================================================
// CARRUSEL: cambio entre hojas con animacion slide
// =================================================================
// Construir hoja MAJOR (cluster de moto)
function buildHomeSheet(data, sheet) {
    sheet.classList.add("home-sheet");
    sheet.innerHTML = `
  <!-- NOTA: video, escudo, barra de progreso ya las provee el dashboard -->

  <!-- RIEL DE ORO alrededor de la pantalla (lo dibuja homeDibujarRiel en js/home-diseno.js) -->
  <svg class="home-riel" id="homeRiel" aria-hidden="true"></svg>
  <svg class="home-riel home-riel-anim" id="homeRielAnim" aria-hidden="true"></svg>

  <!-- TITULO superior (solo texto dorado, sin marquesina ni focos) -->
  <div class="home-marquee-title">
    <h1>PROGRESIVO RACE</h1>
  </div>

  <!-- POZOS -->
  <div class="home-pot home-mini" id="home-pot-mini">
    <div class="home-pot-mini-header">
      <div class="home-pot-mini-left">
        <div class="home-pot-title">MINI</div>
        <div class="home-pot-subtitle">GANATE EFECTIVO</div>
      </div>
      <div class="home-pot-mini-right">
        <div class="home-odometer-prefix home-odometer-prefix-top">S/.</div>
      </div>
    </div>
    <div class="home-odometer">
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma home-digit-hidden"><span class="home-digit-n">,</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma"><span class="home-digit-n">.</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
    </div>
  </div>

  <div class="home-pot home-minor" id="home-pot-minor">
    <div class="home-pot-mini-header">
      <div class="home-pot-mini-left">
        <div class="home-pot-title">MINOR</div>
        <div class="home-pot-subtitle">GANATE EFECTIVO</div>
      </div>
      <div class="home-pot-mini-right">
        <div class="home-odometer-prefix home-odometer-prefix-top">S/.</div>
      </div>
    </div>
    <div class="home-odometer">
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma home-digit-hidden"><span class="home-digit-n">,</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma"><span class="home-digit-n">.</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
    </div>
  </div>

  <div class="home-pot home-major" id="home-pot-major">
    <div class="home-pot-label">
      <div class="home-pot-title">MAJOR</div>
      <div class="home-pot-subtitle">GANATE LA MOTO</div>
    </div>
    <div class="home-pot-right-stack">
      <div class="home-pot-vehicle-row">
        <div class="home-pot-vehicle-box">
          <div class="home-pot-sprite home-moto"></div>
        </div>
      </div>
    </div>
    <!-- Odometro alterno (visible solo con .sprite-off) -->
    <div class="home-odometer-prefix home-odometer-prefix-top home-pot-altprefix">S/.</div>
    <div class="home-odometer home-pot-altodo">
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma home-digit-hidden"><span class="home-digit-n">,</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma"><span class="home-digit-n">.</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
    </div>
  </div>

  <div class="home-pot home-grand" id="home-pot-grand">
    <div class="home-pot-label">
      <div class="home-pot-title">GRAND</div>
      <div class="home-pot-subtitle">GANATE EL AUTO</div>
    </div>
    <div class="home-pot-right-stack">
      <div class="home-pot-vehicle-row">
        <div class="home-pot-vehicle-box">
          <div class="home-pot-sprite home-car"></div>
        </div>
      </div>
    </div>
    <!-- Odometro alterno (visible solo con .sprite-off) -->
    <div class="home-odometer-prefix home-odometer-prefix-top home-pot-altprefix">S/.</div>
    <div class="home-odometer home-pot-altodo">
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma home-digit-hidden"><span class="home-digit-n">,</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit home-digit-hidden"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit comma"><span class="home-digit-n">.</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
      <div class="home-digit"><span class="home-digit-n">0</span></div>
    </div>
  </div>

  <!-- Rombo dorado en el cruce de las 4 cards -->
  <div class="home-rombo" id="homeRombo"></div>

  <!-- POZO ACTIVO / EN JUEGO montados sobre el borde inferior de cada card -->
  <div class="home-estado" id="home-estado-grand" style="--pot-c: var(--c-grand)"><span class="home-pot-tag">POZO ACTIVO</span><span class="home-pot-status"><span class="home-estado-txt">EN JUEGO</span></span></div>
  <div class="home-estado" id="home-estado-major" style="--pot-c: var(--c-major)"><span class="home-pot-tag">POZO ACTIVO</span><span class="home-pot-status"><span class="home-estado-txt">EN JUEGO</span></span></div>
  <div class="home-estado" id="home-estado-minor" style="--pot-c: var(--c-minor)"><span class="home-pot-tag">POZO ACTIVO</span><span class="home-pot-status"><span class="home-estado-txt">EN JUEGO</span></span></div>
  <div class="home-estado" id="home-estado-mini" style="--pot-c: var(--c-mini)"><span class="home-pot-tag">POZO ACTIVO</span><span class="home-pot-status"><span class="home-estado-txt">EN JUEGO</span></span></div>
`;

    // Despues de que el DOM este insertado, construir el escudo y la pista del HOME
    // (se hace en switchToSheet/buildAllSheets cuando se inserta al DOM)
    return sheet;
}

function buildMotoSheet(data, sheet) {
    // KPIs: 2 a la izquierda de los gauges + 2 a la derecha
    const kL1 = data.stats.rpm || "0";
    const kL2 = data.stats.marcha || "1";
    const kR1 = data.stats.aceite || "OK";
    const kR2 = data.stats.freno || "OK";

    // Combustible: 10 segmentos
    const fuelSegments = Math.round(data.fuel / 10);
    let fuelHTML = "";
    for (let i = 0; i < 10; i++) {
        fuelHTML += `<div class="moto-fuel-bar ${i < fuelSegments ? "on" : ""}"></div>`;
    }

    sheet.innerHTML = `
    <div class="scan-line"></div>
    <div class="spark-dot" style="top:18%;left:18%;animation-delay:0s;"></div>
    <div class="spark-dot" style="top:22%;right:18%;animation-delay:0.6s;"></div>
    <div class="spark-dot" style="bottom:18%;left:18%;animation-delay:0.8s;"></div>
    <div class="spark-dot" style="bottom:22%;right:18%;animation-delay:0.2s;"></div>

    <!-- fondo animado de la hoja (estilo en css/hojas-diseno.css) -->
    <div class="hoja-fondo"><i></i><i></i></div>

    <div class="sheet-letrero">
      <div class="sheet-title">${data.title}</div>
      <div class="sheet-subtitle">${data.subtitle}</div>
    </div>


    <div class="vehicle-layout">

      <!-- IZQUIERDA: termo + fuel apilados -->
      <div class="vehicle-side-left">
        <div class="thermometer">
          <div class="thermo-label">CALOR</div>
          <div class="thermo-tube-wrap">
            <div class="thermo-tube">
              <div class="thermo-fill" style="height:${data.temp}%"></div>
              <div class="bubble" style="left:4px;animation-delay:0s;"></div>
              <div class="bubble" style="left:7px;animation-delay:0.8s;"></div>
            </div>
          </div>
          <div class="thermo-bulb"></div>
          <div class="thermo-value">${data.temp}%</div>
        </div>
        <div class="moto-fuel">
          <div class="moto-fuel-label">FUEL</div>
          <div class="moto-fuel-bars" data-role="fuel-bars">${fuelHTML}</div>
          <div class="moto-fuel-value" data-role="fuel-value">${data.fuel}%</div>
        </div>
      </div>

      <!-- CENTRO: cluster de moto (KPIs izq + 2 gauges + KPIs der + barra abajo) -->
      <div class="cluster cluster-moto">
        <!-- forma del cluster (SVG de fondo) -->
        <svg class="cluster-bg" viewBox="0 0 1000 460" preserveAspectRatio="none">
          <defs>
            <linearGradient id="clusterMotoBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(255,170,0,0.10)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0.5)"/>
            </linearGradient>
          </defs>
          <!-- Cluster de moto: forma trapezoidal con visera curva arriba y base recortada abajo -->
          <path d="M 50,40
                   Q 100,5 200,5
                   L 800,5
                   Q 900,5 950,40
                   L 980,180
                   Q 990,250 980,310
                   L 920,420
                   Q 880,455 820,455
                   L 180,455
                   Q 120,455 80,420
                   L 20,310
                   Q 10,250 20,180 Z"
                fill="url(#clusterMotoBg)"
                stroke="rgba(255,215,0,0.55)"
                stroke-width="3"
                filter="drop-shadow(0 0 18px rgba(255,170,0,0.4))"/>
          <!-- linea decorativa interna -->
          <path d="M 70,55
                   Q 115,22 205,22
                   L 795,22
                   Q 885,22 930,55
                   L 962,180
                   Q 970,250 962,310
                   L 905,405
                   Q 870,438 815,438
                   L 185,438
                   Q 130,438 95,405
                   L 38,310
                   Q 30,250 38,180 Z"
                fill="none"
                stroke="rgba(255,215,0,0.25)"
                stroke-width="1"/>
        </svg>

        <!-- contenido del cluster -->
        <div class="cluster-grid moto-grid">
          <!-- KPIs izq -->
          <div class="cluster-kpi-col">
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">RPM</div>
              <div class="cluster-kpi-value" data-role="rpm-kpi" style="color:#ffd600;text-shadow:0 0 6px #ffd600;">${kL1}</div>
            </div>
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">GEAR</div>
              <div class="cluster-kpi-value blink" data-role="gear-kpi" style="color:#ff8800;text-shadow:0 0 6px #ff8800;">${kL2}</div>
            </div>
          </div>

          <!-- Gauges -->
          <div class="cluster-gauges">
            <div class="moto-gauge">
              <svg viewBox="-100 -100 200 200">
                <defs>
                  <linearGradient id="gaugeBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1a0008"/>
                    <stop offset="100%" stop-color="#000"/>
                  </linearGradient>
                </defs>
                <circle cx="0" cy="0" r="92" fill="url(#gaugeBg)" stroke="#ffd700" stroke-width="3"/>
                <circle cx="0" cy="0" r="92" fill="none" stroke="#ffd700" stroke-width="0.8" opacity="0.5"/>
                ${generateGaugeMarks(false)}
                <g class="gauge-needle" data-role="rpm-needle">
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#ff3300" stroke-width="3" stroke-linecap="round" filter="drop-shadow(0 0 4px #ff5500)"/>
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                  <circle cx="0" cy="0" r="8" fill="#ffd700" stroke="#ff8800" stroke-width="2"/>
                  <circle cx="0" cy="0" r="3" fill="#fff"/>
                </g>
              </svg>
              <div class="moto-gauge-value" data-role="rpm-value">${data.rpm}</div>
              <div class="moto-gauge-label">RPM</div>
            </div>
            <div class="moto-gauge">
              <svg viewBox="-100 -100 200 200">
                <circle cx="0" cy="0" r="92" fill="url(#gaugeBg)" stroke="#ffd700" stroke-width="3"/>
                <circle cx="0" cy="0" r="92" fill="none" stroke="#ffd700" stroke-width="0.8" opacity="0.5"/>
                ${generateGaugeMarks(true)}
                <g class="gauge-needle fast" data-role="speed-needle">
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#ff3300" stroke-width="3" stroke-linecap="round" filter="drop-shadow(0 0 4px #ff5500)"/>
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                  <circle cx="0" cy="0" r="8" fill="#ffd700" stroke="#ff8800" stroke-width="2"/>
                  <circle cx="0" cy="0" r="3" fill="#fff"/>
                </g>
              </svg>
              <div class="moto-gauge-value" data-role="speed-value">${data.speed}</div>
              <div class="moto-gauge-label">KM/H</div>
            </div>
          </div>

          <!-- KPIs der -->
          <div class="cluster-kpi-col">
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">ACEITE</div>
              <div class="cluster-kpi-value" style="color:${data.accent};text-shadow:0 0 6px ${data.accent};">${kR1}</div>
            </div>
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">FRENO</div>
              <div class="cluster-kpi-value blink" style="color:#00ff66;text-shadow:0 0 6px #00ff66;">${kR2}</div>
            </div>
          </div>
        </div>

      </div>

      <!-- DERECHA: moto giratoria arriba + marcha gigante abajo -->
      <div class="vehicle-side-right">
        <div class="sprite-wrapper moto-wrapper">
          <canvas class="pedestal-3d" id="motoPedestal3D" width="320" height="320"></canvas>
          <div class="moto-sprite" id="motoSprite"></div>
        </div>
      </div>

    </div>
    ${buildAmountFrameHTML()}
    ${buildBottomRowHTML(data)}
  `;

    return sheet;
}

// Construir hoja GRAND (cluster de auto)
function buildCarSheet(data, sheet) {
    const kL1 = data.stats.rpm || "0";
    const kL2 = data.stats.velocidad || "0";
    const kR1 = data.stats.bateria || "0%";
    const kR2 = data.stats.combustible || "0%";

    const fuelSegments = Math.round(data.fuel / 10);
    let fuelHTML = "";
    for (let i = 0; i < 10; i++) {
        fuelHTML += `<div class="moto-fuel-bar ${i < fuelSegments ? "on car" : ""}"></div>`;
    }

    const odoStr = data.odometer.toLocaleString("en-US");

    sheet.innerHTML = `
    <div class="scan-line"></div>
    <div class="spark-dot" style="top:18%;left:18%;animation-delay:0s;"></div>
    <div class="spark-dot" style="top:22%;right:18%;animation-delay:0.6s;"></div>
    <div class="spark-dot" style="bottom:18%;left:18%;animation-delay:0.8s;"></div>
    <div class="spark-dot" style="bottom:22%;right:18%;animation-delay:0.2s;"></div>

    <!-- fondo animado de la hoja (estilo en css/hojas-diseno.css) -->
    <div class="hoja-fondo"><i></i><i></i></div>

    <div class="sheet-letrero">
      <div class="sheet-title">${data.title}</div>
      <div class="sheet-subtitle">${data.subtitle}</div>
    </div>


    <div class="vehicle-layout">

      <div class="vehicle-side-left">
        <div class="thermometer">
          <div class="thermo-label">CALOR</div>
          <div class="thermo-tube-wrap">
            <div class="thermo-tube">
              <div class="thermo-fill" style="height:${data.temp}%"></div>
              <div class="bubble" style="left:4px;animation-delay:0s;"></div>
              <div class="bubble" style="left:7px;animation-delay:0.8s;"></div>
            </div>
          </div>
          <div class="thermo-bulb"></div>
          <div class="thermo-value">${data.temp}%</div>
        </div>
        <div class="moto-fuel car">
          <div class="moto-fuel-label">FUEL</div>
          <div class="moto-fuel-bars" data-role="fuel-bars">${fuelHTML}</div>
          <div class="moto-fuel-value" data-role="fuel-value">${data.fuel}%</div>
        </div>
      </div>

      <!-- CLUSTER DE AUTO: forma horizontal estilo F1/GT con esquinas cortadas -->
      <div class="cluster cluster-car">
        <svg class="cluster-bg" viewBox="0 0 1000 460" preserveAspectRatio="none">
          <defs>
            <linearGradient id="clusterCarBg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(0,229,212,0.10)"/>
              <stop offset="100%" stop-color="rgba(0,0,0,0.5)"/>
            </linearGradient>
          </defs>
          <!-- Cluster auto: rectangular con esquinas cortadas en diagonal (estilo F1) -->
          <path d="M 60,5
                   L 940,5
                   L 990,55
                   L 990,360
                   L 940,420
                   L 870,420
                   L 850,455
                   L 150,455
                   L 130,420
                   L 60,420
                   L 10,360
                   L 10,55 Z"
                fill="url(#clusterCarBg)"
                stroke="rgba(0,229,212,0.55)"
                stroke-width="3"
                filter="drop-shadow(0 0 18px rgba(0,229,212,0.4))"/>
          <!-- linea decorativa interna -->
          <path d="M 75,22
                   L 925,22
                   L 970,68
                   L 970,348
                   L 925,402
                   L 860,402
                   L 840,438
                   L 160,438
                   L 140,402
                   L 75,402
                   L 30,348
                   L 30,68 Z"
                fill="none"
                stroke="rgba(0,229,212,0.25)"
                stroke-width="1"/>
        </svg>

        <div class="cluster-grid car-grid">
          <div class="cluster-kpi-col">
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">RPM</div>
              <div class="cluster-kpi-value" data-role="rpm-kpi" style="color:#ffd600;text-shadow:0 0 6px #ffd600;">${kL1}</div>
            </div>
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">VELOC</div>
              <div class="cluster-kpi-value blink" data-role="speed-kpi" style="color:#ff8800;text-shadow:0 0 6px #ff8800;">${kL2}</div>
            </div>
          </div>

          <div class="cluster-gauges">
            <div class="moto-gauge car">
              <svg viewBox="-100 -100 200 200">
                <defs>
                  <linearGradient id="gaugeBgCar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#001a18"/>
                    <stop offset="100%" stop-color="#000"/>
                  </linearGradient>
                </defs>
                <circle cx="0" cy="0" r="92" fill="url(#gaugeBgCar)" stroke="#00e5d4" stroke-width="3"/>
                <circle cx="0" cy="0" r="92" fill="none" stroke="#00e5d4" stroke-width="0.8" opacity="0.5"/>
                ${generateGaugeMarks(true)}
                <g class="gauge-needle fast" data-role="speed-needle">
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#00ffe5" stroke-width="3" stroke-linecap="round" filter="drop-shadow(0 0 4px #00e5d4)"/>
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                  <circle cx="0" cy="0" r="8" fill="#00e5d4" stroke="#00ffe5" stroke-width="2"/>
                  <circle cx="0" cy="0" r="3" fill="#fff"/>
                </g>
              </svg>
              <div class="moto-gauge-value car" data-role="speed-value">${data.speed}</div>
              <div class="moto-gauge-label car">KM/H</div>
            </div>
            <div class="moto-gauge car">
              <svg viewBox="-100 -100 200 200">
                <circle cx="0" cy="0" r="92" fill="url(#gaugeBgCar)" stroke="#00e5d4" stroke-width="3"/>
                <circle cx="0" cy="0" r="92" fill="none" stroke="#00e5d4" stroke-width="0.8" opacity="0.5"/>
                ${generateGaugeMarks(false)}
                <g class="gauge-needle" data-role="rpm-needle">
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#00ffe5" stroke-width="3" stroke-linecap="round" filter="drop-shadow(0 0 4px #00e5d4)"/>
                  <line x1="0" y1="0" x2="0" y2="-72" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
                  <circle cx="0" cy="0" r="8" fill="#00e5d4" stroke="#00ffe5" stroke-width="2"/>
                  <circle cx="0" cy="0" r="3" fill="#fff"/>
                </g>
              </svg>
              <div class="moto-gauge-value car" data-role="rpm-value">${data.rpm}</div>
              <div class="moto-gauge-label car">RPM</div>
            </div>
          </div>

          <div class="cluster-kpi-col">
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">BATERIA</div>
              <div class="cluster-kpi-value" style="color:${data.accent};text-shadow:0 0 6px ${data.accent};">${kR1}</div>
            </div>
            <div class="cluster-kpi">
              <div class="cluster-kpi-label">FUEL</div>
              <div class="cluster-kpi-value blink" style="color:#00ff66;text-shadow:0 0 6px #00ff66;">${kR2}</div>
            </div>
          </div>
        </div>

      </div>

      <!-- DERECHA: bateria + odometro apilados -->
      <div class="vehicle-side-right">
        <div class="sprite-wrapper auto-wrapper">
          <canvas class="pedestal-3d" id="autoPedestal3D" width="320" height="320"></canvas>
          <div class="auto-sprite" id="autoSprite"></div>
        </div>
      </div>

    </div>
    ${buildAmountFrameHTML()}
    ${buildBottomRowHTML(data)}
  `;

    return sheet;
}

// Genera las marcas del gauge con clase .gauge-mark y data-angle para iluminado dinamico
function generateGaugeMarks(isSpeed) {
    let marks = "";
    // 14 marcas MAYORES de -130 a +130 grados (las "agujas pequeñas" o ticks principales)
    for (let i = 0; i <= 13; i++) {
        const angle = -130 + (260 / 13) * i;
        const rad = (angle * Math.PI) / 180;
        const x1 = Math.sin(rad) * 78;
        const y1 = -Math.cos(rad) * 78;
        const x2 = Math.sin(rad) * 88;
        const y2 = -Math.cos(rad) * 88;
        const isRed = i >= 10;
        const offColor = isRed ? "#5a1100" : "#665500"; // apagado (oscuro)
        const onColor = isRed ? "#ff3300" : "#ffd700"; // encendido (brillante)
        marks += `<line class="gauge-mark gauge-mark-major" data-angle="${angle.toFixed(1)}" data-on-color="${onColor}" data-off-color="${offColor}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${offColor}" stroke-width="2"/>`;
    }
    // 13 marcas MENORES entre las mayores
    for (let i = 0; i <= 26; i++) {
        if (i % 2 === 0) continue;
        const angle = -130 + (260 / 26) * i;
        const rad = (angle * Math.PI) / 180;
        const x1 = Math.sin(rad) * 82;
        const y1 = -Math.cos(rad) * 82;
        const x2 = Math.sin(rad) * 88;
        const y2 = -Math.cos(rad) * 88;
        marks += `<line class="gauge-mark gauge-mark-minor" data-angle="${angle.toFixed(1)}" data-on-color="#ffaa00" data-off-color="#3a2a00" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#3a2a00" stroke-width="0.8" opacity="0.7"/>`;
    }
    return marks;
}

// =================================================================
// SIMULACION DE CARRERA: solo aplica a hojas vehiculo (MAJOR/GRAND)
// Curva tipo F1: arranque, aceleron al maximo, frenada, vuelta a acelerar
// Todo sincronizado con SHEET_DURATION (8s por ciclo)
// =================================================================
// La telemetria (relojes, RPM, velocidad, combustible) ya no se muestra en ninguna hoja.
// Sus ciclos solo trabajan si la hoja activa tiene los relojes visibles (se revisa cada 500 ms).
function telemetriaVisible() {
    const now = performance.now();
    if (telemetriaVisible.t && now - telemetriaVisible.t < 500) return telemetriaVisible.v;
    telemetriaVisible.t = now;
    const g = document.querySelector(".sheet.active .cluster-gauges");
    telemetriaVisible.v = !!(g && g.offsetParent && getComputedStyle(g).visibility === "visible");
    return telemetriaVisible.v;
}

function simulateRace(now) {
    // OPTIMIZACION: throttle a 30 fps (suficiente para agujas/numeros)
    if (!simulateRace.lastFrame) simulateRace.lastFrame = 0;
    if (now - simulateRace.lastFrame < 33) {
        requestAnimationFrame(simulateRace);
        return;
    }
    simulateRace.lastFrame = now;
    if (!telemetriaVisible()) {
        requestAnimationFrame(simulateRace);
        return;
    }

    const sheet = document.querySelector(".sheet.active");
    if (!sheet) {
        requestAnimationFrame(simulateRace);
        return;
    }

    const sheetId = sheet.dataset.id;
    if (sheetId !== "major" && sheetId !== "grand") {
        requestAnimationFrame(simulateRace);
        return;
    }

    // OPTIMIZACION: cachear todas las referencias DOM por sheet
    // Si cambio la hoja activa, invalidar cache
    if (!simulateRace.domCache) simulateRace.domCache = {};
    if (simulateRace.domCache.sheetId !== sheetId) {
        simulateRace.domCache = {
            sheetId: sheetId,
            rpmNeedle: sheet.querySelector('[data-role="rpm-needle"]'),
            speedNeedle: sheet.querySelector('[data-role="speed-needle"]'),
            rpmValue: sheet.querySelector('[data-role="rpm-value"]'),
            speedValue: sheet.querySelector('[data-role="speed-value"]'),
            rpmKpi: sheet.querySelector('[data-role="rpm-kpi"]'),
            gearKpi: sheet.querySelector('[data-role="gear-kpi"]'),
            speedKpi: sheet.querySelector('[data-role="speed-kpi"]'),
            gearBig: sheet.querySelector('[data-role="gear-big"]'),
            fuelValue: sheet.querySelector('[data-role="fuel-value"]'),
            fuelBars: sheet.querySelector('[data-role="fuel-bars"]'),
            batFill: sheet.querySelector('[data-role="battery-fill"]'),
            batValue: sheet.querySelector('[data-role="battery-value"]'),
        };
        // Cachear tambien las barras de combustible (un solo querySelectorAll)
        if (simulateRace.domCache.fuelBars) {
            simulateRace.domCache.fuelBarsList = simulateRace.domCache.fuelBars.querySelectorAll(".moto-fuel-bar");
        }
    }
    const dom = simulateRace.domCache;

    const sheetData = SHEETS_DATA.find((s) => s.id === sheetId);
    if (!sheetData) {
        requestAnimationFrame(simulateRace);
        return;
    }

    // Tiempo dentro del ciclo actual (0 a 1)
    const curDuration = getDurationForSheet(currentSheetIdx);
    const timeInSheet = curDuration - (nextChangeTime - now);
    const t = Math.max(0, Math.min(1, timeInSheet / curDuration));

    // ============================================================
    // CURVA DE ACELERACION TIPO F1/MotoGP:
    // - 0.00-0.15: arranque, RPM sube de min a alto
    // - 0.15-0.35: maxima velocidad, RPM al rojo
    // - 0.35-0.50: FRENADA brusca antes de curva (RPM y vel bajan)
    // - 0.50-0.75: aceleracion saliendo de curva (RPM y vel suben)
    // - 0.75-0.90: rectaaa final, RPM al maximo
    // - 0.90-1.00: frenada para nueva vuelta
    // ============================================================
    let rpmFactor; // 0 a 1
    if (t < 0.15) {
        rpmFactor = (t / 0.15) * 0.85; // 0 -> 0.85
    } else if (t < 0.35) {
        rpmFactor = 0.85 + ((t - 0.15) / 0.2) * 0.15; // 0.85 -> 1.0
    } else if (t < 0.5) {
        rpmFactor = 1.0 - ((t - 0.35) / 0.15) * 0.65; // 1.0 -> 0.35 (frenada)
    } else if (t < 0.75) {
        rpmFactor = 0.35 + ((t - 0.5) / 0.25) * 0.6; // 0.35 -> 0.95
    } else if (t < 0.9) {
        rpmFactor = 0.95 + ((t - 0.75) / 0.15) * 0.05; // 0.95 -> 1.0
    } else {
        rpmFactor = 1.0 - ((t - 0.9) / 0.1) * 0.7; // 1.0 -> 0.3 (frenada final)
    }

    // Vibracion micro para realismo (motor revolucionando)
    const jitter = (Math.sin(now * 0.05) + Math.sin(now * 0.13)) * 0.012;
    rpmFactor = Math.max(0, Math.min(1, rpmFactor + jitter));

    // ============================================================
    // CALCULOS DE VALORES
    // ============================================================
    const maxRpm = sheetId === "major" ? 13000 : 8500; // moto rev mas alto
    const maxSpeed = sheetId === "major" ? 280 : 250;
    const minRpm = 800;

    const rpm = Math.round(minRpm + rpmFactor * (maxRpm - minRpm));
    const speed = Math.round(rpmFactor * maxSpeed);

    // Marcha: cambia segun velocidad
    let gear;
    if (speed < 30) gear = 1;
    else if (speed < 70) gear = 2;
    else if (speed < 120) gear = 3;
    else if (speed < 170) gear = 4;
    else if (speed < 220) gear = 5;
    else gear = 6;

    // Combustible: baja proporcional al RPM, se RESETEA al inicio del ciclo
    const fuelStart = sheetData.fuel;
    const fuelMin = Math.max(20, fuelStart - 30); // baja maximo 30%
    // Acumula gasto basado en t (linealmente, mas rapido si rpm alto)
    // Como queremos que se RESETE al inicio, simplemente: fuel = fuelStart - (gasto en este ciclo)
    // Gasto se calcula integrando rpmFactor sobre t, pero aproximamos con t * promedio_rpm
    const fuelDrop = t * (fuelStart - fuelMin);
    const fuel = Math.max(fuelMin, Math.round(fuelStart - fuelDrop));

    // Bateria (solo GRAND): baja un poquito
    const batteryStart = sheetData.battery || 96;
    const batteryDrop = t * 8; // baja 8% durante el ciclo
    const battery = Math.max(batteryStart - 8, Math.round(batteryStart - batteryDrop));

    // ============================================================
    // ACTUALIZAR LA UI
    // ============================================================
    // Aguja RPM (-130deg a +130deg)
    const rpmAngle = -130 + rpmFactor * 260;
    if (dom.rpmNeedle) dom.rpmNeedle.style.transform = `rotate(${rpmAngle.toFixed(2)}deg)`;

    // Aguja velocidad (mismo factor pero con un pequeño retraso visual)
    const speedFactor = Math.max(0, Math.min(1, rpmFactor - 0.05));
    const speedAngle = -130 + speedFactor * 260;
    if (dom.speedNeedle) dom.speedNeedle.style.transform = `rotate(${speedAngle.toFixed(2)}deg)`;

    // ============================================================
    // VALORES NUMERICOS: con LERP suave + REDONDEADO para no parpadear
    // ============================================================
    // Cache: guardar el valor mostrado actualmente para hacer interpolacion
    if (!simulateRace.shown) simulateRace.shown = { rpm: 800, speed: 0, fuel: 100, battery: 100 };
    const shown = simulateRace.shown;

    // Lerp factor MAS LENTO para que el cambio se vea fluido
    // 0.04 = se mueve al 4% del trayecto cada frame -> demora ~1.5s en alcanzar el target
    const lerpRpm = 0.04;
    const lerpSpd = 0.04;
    shown.rpm += (rpm - shown.rpm) * lerpRpm;
    shown.speed += (speed - shown.speed) * lerpSpd;
    shown.fuel += (fuel - shown.fuel) * 0.03;
    shown.battery += (battery - shown.battery) * 0.03;

    // Redondear el RPM a multiplos de 50 para que cambie en saltos visibles, no de 1 en 1
    const rpmDisplay = Math.round(shown.rpm / 50) * 50;
    const speedDisplay = Math.round(shown.speed);
    const fuelDisplay = Math.round(shown.fuel);
    const batteryDisplay = Math.round(shown.battery);

    // Actualizar DOM solo cuando cambia el valor mostrado (evita repaints inutiles)
    if (!simulateRace.lastDisplay) simulateRace.lastDisplay = {};
    const last = simulateRace.lastDisplay;

    if (dom.rpmValue && last.rpm !== rpmDisplay) {
        dom.rpmValue.textContent = rpmDisplay;
    }
    if (dom.speedValue && last.speed !== speedDisplay) {
        dom.speedValue.textContent = speedDisplay;
    }
    if (dom.rpmKpi && last.rpm !== rpmDisplay) {
        dom.rpmKpi.textContent = rpmDisplay;
    }
    if (dom.gearKpi && last.gear !== gear) {
        dom.gearKpi.textContent = gear;
    }
    if (dom.speedKpi && last.speed !== speedDisplay) {
        dom.speedKpi.textContent = speedDisplay;
    }
    if (dom.gearBig && last.gear !== gear) {
        dom.gearBig.textContent = gear;
    }

    // Combustible: actualizar valor numerico
    if (dom.fuelValue && last.fuel !== fuelDisplay) {
        dom.fuelValue.textContent = fuelDisplay + "%";
    }

    // Guardar valores mostrados para no repintar igual
    last.rpm = rpmDisplay;
    last.speed = speedDisplay;
    last.gear = gear;
    last.fuel = fuelDisplay;
    last.battery = batteryDisplay;

    // Combustible: actualizar barras (encender las primeras N segun fuel %)
    if (dom.fuelBarsList) {
        const segments = Math.round(fuel / 10);
        dom.fuelBarsList.forEach((bar, i) => {
            const shouldOn = i < segments;
            const isOn = bar.classList.contains("on");
            if (shouldOn && !isOn) {
                bar.classList.add("on");
                if (sheetId === "grand") bar.classList.add("car");
            } else if (!shouldOn && isOn) {
                bar.classList.remove("on");
                bar.classList.remove("car");
            }
        });
    }

    // Bateria (solo GRAND): tambien con lerp
    if (sheetId === "grand") {
        if (dom.batFill) dom.batFill.style.width = batteryDisplay + "%";
        if (dom.batValue && last.batteryShown !== batteryDisplay) {
            dom.batValue.textContent = batteryDisplay + "%";
            last.batteryShown = batteryDisplay;
        }
    }

    requestAnimationFrame(simulateRace);
}

// =================================================================
// ANIMACION GLOBAL: termometro suave + KPIs MINI/MINOR + KM TOTAL + tornillos rotando
// =================================================================
function globalAnimate(now) {
    if (!globalAnimate.state) {
        globalAnimate.state = {
            lastKpiUpdate: 0,
            lastOdoUpdate: 0,
            lastFrameTime: 0,
            kpiValues: {},
            tempPhase: Math.random() * Math.PI * 2,
            odometerOffset: 0,
            _cache: {},
        };
    }

    // THROTTLE: limitar a 30fps (suficiente para KPIs/odometro)
    // 33ms = ~30fps, libera CPU para otros loops
    const nowFrame = performance.now();
    if (nowFrame - globalAnimate.state.lastFrameTime < 33) {
        requestAnimationFrame(globalAnimate);
        return;
    }
    globalAnimate.state.lastFrameTime = nowFrame;

    const state = globalAnimate.state;
    const sheet = document.querySelector(".sheet.active");
    if (!sheet) {
        requestAnimationFrame(globalAnimate);
        return;
    }

    const sheetId = sheet.dataset.id;
    const sheetData = SHEETS_DATA.find((s) => s.id === sheetId);
    if (!sheetData) {
        requestAnimationFrame(globalAnimate);
        return;
    }

    // ============================================================
    // TERMOMETRO: oscila suavemente durante el ciclo (sin tope, con 2 senos combinados)
    // ============================================================
    // Base = temp de la hoja, oscila ±10% con 2 ondas combinadas para no parecer regular
    const baseTemp = sheetData.temp;
    const slow = Math.sin(now * 0.0006 + state.tempPhase) * 6;
    const fast = Math.sin(now * 0.0014 + state.tempPhase * 1.7) * 3;
    const temp = Math.max(20, Math.min(95, Math.round(baseTemp + slow + fast)));

    // Actualizar visualmente: thermo-fill (height) y thermo-value (texto)
    const thermoFill = sheet.querySelector(".thermo-fill");
    const thermoValue = sheet.querySelector(".thermo-value");
    if (thermoFill) thermoFill.style.height = temp + "%";
    if (thermoValue) {
        // Si la hoja es mini/minor el formato es '72°C', si es major/grand es '88%' (segun como esta)
        const currentText = thermoValue.textContent.trim();
        const hasC = currentText.includes("°C") || currentText.includes("C");
        if (hasC) {
            thermoValue.textContent = temp + "°C";
        } else {
            thermoValue.textContent = temp + "%";
        }
    }

    // ============================================================
    // KPIs MINI/MINOR: actualizar cada 2-3 segundos con valores aleatorios suaves
    // ============================================================
    if (sheetId === "mini" || sheetId === "minor") {
        const sinceLastKpi = now - state.lastKpiUpdate;
        if (sinceLastKpi > 2000) {
            // 2 segundos entre cambios (sutil)
            state.lastKpiUpdate = now;

            // Inicializar valores actuales si no existen
            if (!state.kpiValues[sheetId]) {
                state.kpiValues[sheetId] = {
                    gear: sheetId === "mini" ? 4 : 5,
                    kmh: sheetId === "mini" ? 178 : 220,
                };
            }
            const kv = state.kpiValues[sheetId];

            // Oscilar SUTILMENTE +/- 2 sobre el valor actual (no muy lejos del original)
            const baseGear = sheetId === "mini" ? 4 : 5;
            const baseKmh = sheetId === "mini" ? 178 : 220;

            // Mover hacia un valor random pequeño, pero gravitando al base
            const gearDelta = Math.round((Math.random() - 0.5) * 2); // -1, 0, 1
            const kmhDelta = Math.round((Math.random() - 0.5) * 4); // -2, -1, 0, 1, 2

            kv.gear = Math.max(1, Math.min(6, kv.gear + gearDelta));
            kv.kmh = Math.max(50, kv.kmh + kmhDelta);

            // Tirar lentamente de regreso al valor base (cada actualizacion 30% hacia base)
            kv.gear = Math.round(kv.gear * 0.7 + baseGear * 0.3);
            kv.kmh = Math.round(kv.kmh * 0.7 + baseKmh * 0.3);

            const cells = sheet.querySelectorAll(".chain-cell .stat-value");
            if (cells.length === 4) {
                cells[0].textContent = "⚙ " + kv.gear;
                cells[1].textContent = kv.kmh;
                cells[2].textContent = temp + "°C";
            }
        }
    }

    // ============================================================
    // ODOMETRO MINI/MINOR: contador decimal incrementa lento
    // ============================================================
    // ODOMETRO MINI/MINOR:
    // - useTestData=true: incremento automatico continuo
    // - useTestData=false: interpolacion suave hacia targetValue (recibido del API)
    // ============================================================
    // Helper: actualizar HOME y modal con el mismo valor (en centavos) del sheet
    // Asi los 3 odometros (sheet, home, modal) muestran SIEMPRE el mismo numero.
    if (!window.syncHomeAndModalOdometer) {
        window.syncHomeAndModalOdometer = function (sId, cents) {
            // Convertir centavos a "XXX,XXX.XX" (tope 999,999.99 = 6 digitos enteros)
            const intPart = Math.floor(cents / 100);
            const centPart = cents % 100;
            const intStr = String(intPart).padStart(6, "0");
            const centStr = String(centPart).padStart(2, "0");
            // 10 posiciones visuales: [0][1][2] , [4][5][6] . [8][9]
            const digitChars = [intStr[0], intStr[1], intStr[2], ",", intStr[3], intStr[4], intStr[5], ".", centStr[0], centStr[1]];

            // Cuantos cuadros enteros mostrar (sin ceros a la izquierda, minimo 1).
            // La coma de miles solo aparece a partir de 4 digitos enteros (>= 1000).
            const nInt = String(intPart).length; // 1=unidades ... 6=centenas de mil
            const intSlots = [6, 5, 4, 2, 1, 0]; // posiciones enteras, de menor a mayor
            const visibles = new Set(intSlots.slice(0, nInt)); // cuadros enteros que se ven
            visibles.add(7);
            visibles.add(8);
            visibles.add(9); // punto y 2 decimales: siempre
            if (nInt >= 4) visibles.add(3); // coma de miles

            // 1) HOME
            const homePot = document.getElementById("home-pot-" + sId);
            if (homePot) {
                const homeDigits = homePot.querySelectorAll(".home-digit");
                if (homeDigits.length === 10) {
                    for (let i = 0; i < 10; i++) {
                        const ch = digitChars[i];
                        // el texto va en el <span> interno (acabado metalico del numero)
                        const destino = homeDigits[i].firstElementChild || homeDigits[i];
                        if (destino.textContent !== ch) destino.textContent = ch;
                        homeDigits[i].classList.toggle("home-digit-hidden", !visibles.has(i));
                    }
                }
            }

            // 2) Modal: mostrar SIEMPRE el monto GANADO (congelado), nunca el valor
            // vivo del estado. Asi un reinicio/update durante el modal no lo cambia.
            const modal = document.getElementById("winnerModal");
            if (modal && modal.classList.contains("showing") && modal.dataset.sheet === sId) {
                const txt = document.getElementById("winnerAmountText");
                if (txt) {
                    const wonCents = parseInt(modal.dataset.wonCents || "0", 10);
                    const amountStr =
                        "S/ " +
                        (wonCents / 100).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        });
                    if (txt.textContent !== amountStr) txt.textContent = amountStr;
                }
            }
        };
    }

    // ODOMETRO MINI/MINOR: control 100% por JS
    if (!state.lastOdoUpdateMM) state.lastOdoUpdateMM = 0;
    const intervalMsMM = 100 / (window.CASINO_CONFIG.kpiSpeed || 1.0);

    if (now - state.lastOdoUpdateMM > intervalMsMM) {
        state.lastOdoUpdateMM = now;

        if (!state.miniMinorOdo) state.miniMinorOdo = { mini: 0, minor: 0 };
        if (!state.miniMinorTarget) state.miniMinorTarget = {};

        // Lista dinamica: mini/minor siempre; grand/major solo si tienen sprite-off
        const sIds = ["mini", "minor"];
        if (window.SPRITE_CONFIG && window.SPRITE_CONFIG.grand === false) sIds.push("grand");
        if (window.SPRITE_CONFIG && window.SPRITE_CONFIG.major === false) sIds.push("major");

        sIds.forEach((sId) => {
            if (state.miniMinorOdo[sId] === undefined) state.miniMinorOdo[sId] = 0;

            // Siempre interpolar hacia target (en prueba o produccion).
            // Si no hay target, se queda en 0. Cuando llega casinoUpdate,
            // anima desde el valor actual hasta el nuevo target.
            {
                const target = state.miniMinorTarget[sId];
                if (target !== undefined && target !== state.miniMinorOdo[sId]) {
                    const current = state.miniMinorOdo[sId];
                    const diff = target - current;
                    const absDiff = Math.abs(diff);
                    // Animacion con duracion fija (~1.5s) => step proporcional a la diferencia.
                    // Tick = 100ms => 15 ticks por animacion. step = diff / 15 (minimo 1 centavo).
                    // Diferencias grandes => pasos grandes (cuenta rapido).
                    // Diferencias chicas => pasos chicos (cuenta suave).
                    const TICKS_OBJETIVO = 15;
                    let step = Math.sign(diff) * Math.max(1, Math.ceil(absDiff / TICKS_OBJETIVO));
                    const next = current + step;
                    if ((diff > 0 && next >= target) || (diff < 0 && next <= target)) {
                        state.miniMinorOdo[sId] = target;
                    } else {
                        state.miniMinorOdo[sId] = next;
                    }
                }
            }

            // Actualizar visual de la hoja correspondiente
            const targetSheet = document.querySelector('.sheet[data-id="' + sId + '"]');
            if (!targetSheet) return;
            const reels = targetSheet.querySelectorAll(".reel-strip");
            if (reels.length === 0) return;

            // Calcular numero a mostrar (centavos del estado animado)
            const displayNum = state.miniMinorOdo[sId];

            const numStr = displayNum.toString().padStart(8, "0"); // 6 enteros + 2 decimales

            // Aplicar transform a cada reel
            reels.forEach((reel, idx) => {
                const digit = parseInt(numStr[idx], 10);
                // Solo actualizar si cambio (optimizacion)
                if (reel.dataset.digit !== String(digit)) {
                    reel.dataset.digit = digit;
                    reel.style.transform = "translateY(" + -digit * 16 + "cqh)";
                }
            });

            // Ocultar ceros a la izquierda y la coma cuando no se usan.
            // reels[0..5] = enteros (10^5..10^0); reels[6..7] = decimales (siempre).
            // La coma aparece a partir de 4 digitos enteros (>= 1000).
            const nIntR = String(Math.floor(displayNum / 100)).length; // 1..6
            for (let k = 0; k < 6; k++) {
                const box = reels[k].parentElement; // el .reel-digit
                if (box) box.classList.toggle("reel-hidden", k < 6 - nIntR);
            }
            const commaSep = targetSheet.querySelector(".reel-sep.comma");
            if (commaSep) commaSep.classList.toggle("reel-hidden", nIntR < 4);

            // Sincronizar tambien el HOME y el modal con el MISMO valor (en centavos)
            // displayNum esta en centavos. Lo convertimos a "S/. XX,XXX.XX"
            syncHomeAndModalOdometer(sId, displayNum);
        });
    }

    // ============================================================
    // KM TOTAL (GRAND): incrementa +1 cada 200ms
    // ============================================================
    if (sheetId === "grand") {
        const sinceLastOdo = now - state.lastOdoUpdate;
        if (sinceLastOdo > 200) {
            state.lastOdoUpdate = now;
            state.odometerOffset += 1;

            const odoEl = sheet.querySelector('[data-role="odo-value"]');
            if (odoEl) {
                const total = sheetData.odometer + state.odometerOffset;
                odoEl.textContent = total.toLocaleString("en-US");
            }
        }
    }

    // ============================================================
    // TORNILLOS: rotar con CSS transition (suave, sin depender de FPS de JS).
    // updateProgressLoop setea dataset.spinStart cuando el vehiculo pasa cerca.
    // Aqui solo seteamos el angulo destino UNA vez por disparo, y el navegador
    // interpola suave en GPU (no consume frames JS).
    // ============================================================
    const SPIN_DURATION = 700;

    if (!state._cache) state._cache = {};
    if (!state._cache.screws) {
        state._cache.screws = document.querySelectorAll(".corner-screw");
        state._cache.crossesById = {};
        state._cache.screws.forEach((screw) => {
            const screwIdx = screw.id.replace("screw-", "");
            state._cache.crossesById[screwIdx] = document.querySelectorAll('.screw-cross[data-screw="' + screwIdx + '"]');
        });
    }

    state._cache.screws.forEach((screw) => {
        const spinStart = parseFloat(screw.dataset.spinStart || "0");
        if (spinStart <= 0) return;
        // Solo procesamos cuando hay un disparo nuevo (no procesado aun)
        if (screw.dataset.spinHandled === String(spinStart)) {
            // Despues de la duracion, limpiar transform para dejarlo en 0
            if (now - spinStart >= SPIN_DURATION && screw.style.transform) {
                const screwIdx = screw.id.replace("screw-", "");
                const crosses = state._cache.crossesById[screwIdx];
                screw.style.transition = "none";
                screw.style.transform = "";
                if (crosses)
                    crosses.forEach((c) => {
                        c.style.transition = "none";
                        c.style.transform = "";
                    });
            }
            return;
        }
        screw.dataset.spinHandled = String(spinStart);

        const screwIdx = screw.id.replace("screw-", "");
        const crosses = state._cache.crossesById[screwIdx];
        if (!crosses) return;

        const cx = screw.getAttribute("cx");
        const cy = screw.getAttribute("cy");

        // Resetear a 0 sin transicion, luego aplicar transicion para ir a 360
        screw.style.transition = "none";
        screw.style.transformOrigin = cx + "px " + cy + "px";
        screw.style.transform = "rotate(0deg)";
        crosses.forEach((c) => {
            c.style.transition = "none";
            c.style.transformOrigin = cx + "px " + cy + "px";
            c.style.transform = "rotate(0deg)";
        });
        // Forzar reflow REAL (offsetWidth no funciona en SVG, getBoundingClientRect si)
        screw.getBoundingClientRect();
        // Aplicar transicion linear hasta 360 (suave, en GPU)
        screw.style.transition = "transform " + SPIN_DURATION + "ms linear";
        screw.style.transform = "rotate(360deg)";
        crosses.forEach((c) => {
            c.style.transition = "transform " + SPIN_DURATION + "ms linear";
            c.style.transform = "rotate(360deg)";
        });
    });

    requestAnimationFrame(globalAnimate);
}

// =================================================================
// ANIMACION DE ILUMINADO DE MARCAS: lee el angulo actual de cada aguja
// y enciende las marcas que esten "antes" de el (las que ya barrió)
// =================================================================
function illuminateGaugeMarks() {
    if (!telemetriaVisible()) {
        requestAnimationFrame(illuminateGaugeMarks);
        return;
    }
    // Recorrer cada aguja
    document.querySelectorAll(".gauge-needle").forEach((needle) => {
        // Obtener el angulo actual desde el computed style transform
        const transform = window.getComputedStyle(needle).transform;
        let currentAngle = -130; // default

        // El transform es matrix(a, b, c, d, tx, ty). El angulo = atan2(b, a)
        if (transform && transform !== "none") {
            const match = transform.match(/matrix\(([^)]+)\)/);
            if (match) {
                const values = match[1].split(",").map((v) => parseFloat(v.trim()));
                // values[0] = cos(theta), values[1] = sin(theta)
                currentAngle = (Math.atan2(values[1], values[0]) * 180) / Math.PI;
            }
        }

        // Buscar las marcas del MISMO svg que la aguja
        const svg = needle.closest("svg");
        if (!svg) return;

        svg.querySelectorAll(".gauge-mark").forEach((mark) => {
            const markAngle = parseFloat(mark.dataset.angle);
            const onColor = mark.dataset.onColor;
            const offColor = mark.dataset.offColor;

            // Si la aguja ya pasó por esta marca (angulo de la aguja >= angulo de la marca), encender
            if (currentAngle >= markAngle) {
                mark.setAttribute("stroke", onColor);
                mark.setAttribute("opacity", "1");
                if (mark.classList.contains("gauge-mark-major")) {
                    mark.style.filter = `drop-shadow(0 0 4px ${onColor})`;
                }
            } else {
                mark.setAttribute("stroke", offColor);
                mark.setAttribute("opacity", mark.classList.contains("gauge-mark-minor") ? "0.5" : "1");
                mark.style.filter = "";
            }
        });
    });

    requestAnimationFrame(illuminateGaugeMarks);
}

function buildAllSheets() {
    const wrapper = document.getElementById("sheetsWrapper");
    wrapper.innerHTML = "";

    // Limpiar cache de DOM lookups (las referencias antiguas ya no son validas)
    if (typeof globalAnimate !== "undefined" && globalAnimate.state) {
        globalAnimate.state._cache = {};
    }
    SHEETS_DATA.forEach((data, idx) => {
        const sheet = buildSheet(data);
        if (idx === currentSheetIdx) {
            sheet.classList.add("active");
        } else {
            sheet.classList.add("enter-from-back");
        }
        wrapper.appendChild(sheet);
    });

    // Aplicar SPRITE_CONFIG ahora que las hojas existen en el DOM
    if (typeof applyAllSpriteConfig === "function") {
        applyAllSpriteConfig();
    }
}

function switchToSheet(newIdx) {
    if (newIdx === currentSheetIdx) return;

    const sheets = document.querySelectorAll(".sheet");
    const oldSheet = sheets[currentSheetIdx];
    const newSheet = sheets[newIdx];

    // 1) Posicionar la nueva hoja DETRAS (pequeña e invisible) sin transicion
    newSheet.style.transition = "none";
    newSheet.classList.remove("active", "exit-front");
    newSheet.classList.add("enter-from-back");
    // Asegurar visible (por si quedó con display:none de un cambio anterior)
    if (newSheet.style.display === "none") newSheet.style.display = "";

    // Forzar reflow para que el navegador "vea" el estado inicial
    void newSheet.offsetWidth;

    // 2) Reactivar transicion y mover ambas:
    //    - La vieja: scale 1 -> 2.5 (viene hacia adelante) + fade
    //    - La nueva: scale 0.3 -> 1 (viene desde atras) + aparece
    newSheet.style.transition = "";
    oldSheet.classList.remove("active");
    oldSheet.classList.add("exit-front");
    newSheet.classList.remove("enter-from-back");
    newSheet.classList.add("active");

    // 2b) Despues de que termine la transicion, ocultar completamente la hoja vieja
    //     (con display:none) para que no se solape visualmente
    setTimeout(() => {
        if (oldSheet.classList.contains("exit-front") && !oldSheet.classList.contains("active")) {
            oldSheet.style.display = "none";
        }
    }, 1100);

    // 3) Reconstruir el escudo con el theme de la nueva hoja
    //    Se hace a la mitad del tiempo para que el cambio de color sea durante la transicion
    setTimeout(() => {
        buildShield(SHEETS_DATA[newIdx]);
        // OPTIMIZACION: invalidar cache del progressLoop porque buildShield
        // reconstruye los elementos SVG (las refs viejas quedan invalidas)
        if (typeof updateProgressLoop !== "undefined") updateProgressLoop.cache = {};
        // Tambien invalidar el cache de globalAnimate (mismas refs invalidas)
        if (typeof globalAnimate !== "undefined" && globalAnimate.state) {
            globalAnimate.state._cache = {};
        }
    }, 400);

    // 4) Cambiar el video de fondo (cross-fade entre videos)

    // 5) Resetear cache de valores numericos (para no llevar valores de la hoja anterior)
    if (simulateRace.shown) simulateRace.shown = { rpm: 800, speed: 0, fuel: 100, battery: 100 };
    if (simulateRace.lastDisplay) simulateRace.lastDisplay = {};
    if (globalAnimate.state) {
        globalAnimate.state.odometerOffset = 0;
        globalAnimate.state.lastKpiUpdate = 0;
        globalAnimate.state.lastOdoUpdate = 0;
        // Resetear estado de los tornillos: el sheet nuevo tiene tornillos
        // distintos (recien creados, apagados). El triggeredAt y lastIsOn
        // del sheet anterior no aplican aqui.
        globalAnimate.state.screwTriggers = {};
        globalAnimate.state._cache = {};
    }

    currentSheetIdx = newIdx;
    nextChangeTime = performance.now() + getDurationForSheet(newIdx);

    // HOME: posicionar pozos con coordenadas reales (sin pista ni runner loop)
    const newData = SHEETS_DATA[newIdx];
    if (newData && newData.id === "home") {
        setTimeout(() => {
            if (typeof homePositionPots === "function") homePositionPots();
        }, 500);
    }
}

// =================================================================
// LOOP DE PROGRESO Y AUTO-CAMBIO
// =================================================================
function updateProgressLoop(now) {
    // OPTIMIZACION: throttle a 20 fps (suficiente para barra de progreso)
    if (!updateProgressLoop.lastFrame) updateProgressLoop.lastFrame = 0;
    if (now - updateProgressLoop.lastFrame < 50) {
        requestAnimationFrame(updateProgressLoop);
        return;
    }
    updateProgressLoop.lastFrame = now;

    // OPTIMIZACION: cache de referencias DOM (se invalida en switchToSheet)
    if (!updateProgressLoop.cache) updateProgressLoop.cache = {};
    const cache = updateProgressLoop.cache;
    if (!cache.glow) {
        cache.glow = document.getElementById("progressBarGlow");
        cache.head = document.getElementById("progressBarHead");
        cache.moto = document.getElementById("motoRunner");
        cache.pathDef = document.getElementById("progressPathDef");
        cache.screws = document.querySelectorAll(".corner-screw");
        if (cache.pathDef) cache.totalLen = cache.pathDef.getTotalLength();
    }

    if (progressBarPath && nextChangeTime > 0) {
        const curDuration = getDurationForSheet(currentSheetIdx);
        const remaining = nextChangeTime - now;
        const elapsed = curDuration - remaining;
        const progress = Math.max(0, Math.min(1, elapsed / curDuration));
        const offset = (1 - progress).toFixed(4);

        // Moto runner: posicionar en el path segun el progreso.
        // En HOME el sheet dura 60s pero queremos que la moto se mueva
        // a la MISMA VELOCIDAD que en los sheets (8s por vuelta).
        // Solucion: la moto usa su propio "progress" que da varias vueltas
        // mientras la barra grande sigue avanzando solo una vez.
        let motoProgress = progress;
        const isHome = SHEETS_DATA[currentSheetIdx] && SHEETS_DATA[currentSheetIdx].id === "home";
        if (isHome) {
            const vueltas = HOME_DURATION / SHEET_DURATION; // ej: 60000/8000 = 7.5
            motoProgress = (progress * vueltas) % 1;
        }

        // RACE: en HOME calcular dos progresos distintos (moto y auto) que oscilan
        // de forma independiente para parecer una competencia. La velocidad media
        // de ambos es la misma, pero a veces uno va mas rapido que el otro.
        let motoRaceProgress = motoProgress;
        let autoRaceProgress = motoProgress;
        if (isHome) {
            const t = now / 1000; // tiempo en segundos para los senos
            // Variaciones aleatorias suaves (suma de senos con frecuencias distintas)
            const motoVar = (Math.sin(t * 1.7) + Math.sin(t * 0.9 + 1.3)) * 0.012;
            const autoVar = (Math.sin(t * 1.3 + 2.1) + Math.sin(t * 2.1 + 0.7)) * 0.012;
            motoRaceProgress = (motoProgress + motoVar + 1) % 1;
            autoRaceProgress = (motoProgress + autoVar + 1) % 1;
        }

        // HAZ DE LUZ: se llena segun motoProgress (igual que en major/grand,
        // donde el haz y el vehiculo van juntos). En HOME motoProgress da
        // varias vueltas, asi que el haz se llena y vuelve a 0 con la moto.
        const motoOffset = (1 - motoRaceProgress).toFixed(4);
        progressBarPath.style.strokeDashoffset = motoOffset;
        if (cache.glow) cache.glow.style.strokeDashoffset = motoOffset;
        if (cache.head) cache.head.style.strokeDashoffset = motoOffset;

        // HOME: aplicar el offset del AUTO (su propia carrera) al haz interior
        if (!cache.autoBar) cache.autoBar = document.getElementById("autoBar");
        if (!cache.autoGlow) cache.autoGlow = document.getElementById("autoBarGlow");
        if (!cache.autoPathDef) cache.autoPathDef = document.getElementById("autoPathDef");
        const autoOffset = (1 - autoRaceProgress).toFixed(4);
        if (cache.autoBar) cache.autoBar.style.strokeDashoffset = autoOffset;
        if (cache.autoGlow) cache.autoGlow.style.strokeDashoffset = autoOffset;

        let runnerPoint = null;
        if (cache.pathDef) {
            try {
                const totalLen = cache.totalLen;
                runnerPoint = cache.pathDef.getPointAtLength(motoRaceProgress * totalLen);
                if (cache.moto) {
                    const aheadLen = Math.min(motoRaceProgress * totalLen + 5, totalLen);
                    const aheadPoint = cache.pathDef.getPointAtLength(aheadLen);
                    const dx = aheadPoint.x - runnerPoint.x;
                    const dy = aheadPoint.y - runnerPoint.y;
                    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

                    const motoAheadLen = Math.min(motoRaceProgress * totalLen + 35, totalLen);
                    const motoPoint = cache.pathDef.getPointAtLength(motoAheadLen);

                    cache.moto.setAttribute("transform", `translate(${motoPoint.x},${motoPoint.y}) rotate(${angle.toFixed(1)})`);
                }

                // AUTO (solo HOME): usa el inner path (autoPathDef) y su propio progress
                if (!cache.auto && isHome) cache.auto = document.getElementById("autoRunner");
                if (isHome && cache.auto && cache.autoPathDef) {
                    const autoLen = cache.autoPathDef.getTotalLength();
                    const autoP = cache.autoPathDef.getPointAtLength(autoRaceProgress * autoLen);
                    const autoAhead = cache.autoPathDef.getPointAtLength(Math.min(autoRaceProgress * autoLen + 5, autoLen));
                    const adx = autoAhead.x - autoP.x;
                    const ady = autoAhead.y - autoP.y;
                    const aangle = (Math.atan2(ady, adx) * 180) / Math.PI;
                    cache.auto.setAttribute("transform", `translate(${autoP.x.toFixed(1)},${autoP.y.toFixed(1)}) rotate(${aangle.toFixed(1)})`);
                }
            } catch (e) {
                /* ignorar */
            }
        }

        // ============================================================
        // ENCENDER TORNILLOS DE LAS ESQUINAS cuando el VEHICULO los pasa
        // - Se encienden cuando el vehiculo esta cerca (zona de paso).
        // - Se apagan cuando el vehiculo se aleja.
        // - Asi rotan cada vez que el vehiculo pasa por ahi (cada vuelta).
        // ============================================================
        if (runnerPoint && cache.pathDef) {
            const sheetData = SHEETS_DATA[currentSheetIdx];
            const accent = sheetData.accent;
            const motoPx = runnerPoint;
            const RADIO_PIX = 25;

            cache.screws.forEach((screw) => {
                const sx = parseFloat(screw.dataset.cx);
                const sy = parseFloat(screw.dataset.cy);
                const dist = Math.hypot(motoPx.x - sx, motoPx.y - sy);

                const wasOn = screw.dataset.isOn === "1";
                const nowOn = dist < RADIO_PIX;

                if (nowOn && !wasOn) {
                    screw.setAttribute("fill", accent);
                    screw.setAttribute("stroke", accent);
                    screw.style.filter = `drop-shadow(0 0 8px ${accent}) drop-shadow(0 0 16px ${accent})`;
                    screw.dataset.isOn = "1";
                    screw.dataset.spinStart = String(performance.now());
                } else if (!nowOn && wasOn) {
                    screw.setAttribute("fill", "#1a0000");
                    screw.setAttribute("stroke", "url(#goldStroke)");
                    screw.style.filter = "";
                    screw.dataset.isOn = "0";
                }
            });
        }
    }

    if (now >= nextChangeTime && nextChangeTime > 0) {
        const nextIdx = (currentSheetIdx + 1) % SHEETS_DATA.length;
        switchToSheet(nextIdx);
    }

    requestAnimationFrame(updateProgressLoop);
}

// =================================================================
// PRELOADER
// =================================================================
(function () {
    const preloader = document.getElementById("preloader");
    const preloaderText = document.getElementById("preloaderText");
    const dashboard = document.getElementById("dashboard");

    let videosReady = false;
    let fontsReady = false;
    let domReady = false;

    // Ya no hay video de fondo: marcar como listo de inmediato
    const allVideos = [];
    videosReady = true;

    function checkAllReady() {
        if (videosReady && fontsReady && domReady) {
            preloaderText.textContent = "LISTO";
            setTimeout(() => {
                // Construir todo
                buildAllSheets();
                buildShield(SHEETS_DATA[currentSheetIdx]);
                nextChangeTime = performance.now() + getDurationForSheet(currentSheetIdx);

                // Si arrancamos en HOME (índice 0), posicionar pozos
                if (SHEETS_DATA[currentSheetIdx] && SHEETS_DATA[currentSheetIdx].id === "home") {
                    setTimeout(() => {
                        if (typeof homePositionPots === "function") homePositionPots();
                    }, 100);
                }
                requestAnimationFrame(updateProgressLoop);
                requestAnimationFrame(illuminateGaugeMarks); // arrancar ilum dinamica
                requestAnimationFrame(simulateRace); // arrancar simulacion
                requestAnimationFrame(globalAnimate); // termo + kpis + odometro + tornillos

                dashboard.classList.add("ready");
                preloader.classList.add("hide");

                setTimeout(() => preloader.remove(), 600);
            }, 200);
        }
    }

    // Esperar a que TODOS los videos esten listos
    let videosLoadedCount = 0;
    function onVideoReady() {
        videosLoadedCount++;
        if (videosLoadedCount >= allVideos.length) {
            videosReady = true;
            preloaderText.textContent = "CARGANDO FUENTES...";
            checkAllReady();
        }
    }

    allVideos.forEach((v) => {
        if (v.readyState >= 2) {
            // HAVE_CURRENT_DATA es suficiente
            onVideoReady();
        } else {
            // loadeddata es mas rapido que canplaythrough
            v.addEventListener("loadeddata", onVideoReady, { once: true });
            v.addEventListener("canplay", onVideoReady, { once: true });
            v.addEventListener("error", onVideoReady, { once: true });
        }
    });

    // Fallback REDUCIDO: si despues de 3s no cargaron todos, asumir que estan listos
    setTimeout(() => {
        if (!videosReady) {
            console.warn("[VIDEO] Timeout 3s alcanzado, forzando videosReady=true");
            videosReady = true;
            checkAllReady();
        }
    }, 3000);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            fontsReady = true;
            preloaderText.textContent = "CARGANDO VIDEO...";
            checkAllReady();
        });
    } else {
        fontsReady = true;
    }

    if (document.readyState === "complete") {
        domReady = true;
    } else {
        window.addEventListener("load", () => {
            domReady = true;
            checkAllReady();
        });
    }

    checkAllReady();
})();

// =================================================================
// REDIMENSIONAR
// =================================================================
let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        buildShield(SHEETS_DATA[currentSheetIdx]);
        // buildShield reconstruye los elementos SVG (barra, moto, tornillos):
        // invalidar los caches que guardan las refs viejas y el largo del path,
        // igual que en switchToSheet. Sin esto la moto y la barra quedan congeladas.
        if (typeof updateProgressLoop !== "undefined") updateProgressLoop.cache = {};
        if (typeof globalAnimate !== "undefined" && globalAnimate.state) {
            globalAnimate.state._cache = {};
            globalAnimate.state.screwTriggers = {};
        }
        if (typeof homePositionPots === "function") homePositionPots();
    }, 150);
});

// ============================================================
// JAVASCRIPT DE LA VISTA HOME
// ============================================================

// ============================================================
// CONSTRUIR ESCUDO (idéntico al de los sheets del dashboard)
// ============================================================
function homeBuildShield() {
    const svg = document.getElementById("homeShieldSvg");
    const w = window.innerWidth;
    const h = window.innerHeight;
    const screenRatio = w / h;

    const VBH = 620;
    let VBW;
    if (screenRatio > 1.13) {
        VBW = Math.round(VBH * screenRatio);
    } else {
        VBW = 700;
    }

    svg.setAttribute("viewBox", `0 0 ${VBW} ${VBH}`);

    const CX = VBW / 2;
    const SH_HALF = 80;
    const SH_OUTER = 110;
    const SH_TOP = 18;
    const FLAT_TOP = 40;
    const SX0 = 60;
    const SX1 = VBW - 60;
    const ST = FLAT_TOP;
    const SY_TOP = SH_TOP;
    const TL_SH_END = CX - SH_HALF - SH_OUTER;
    const TL_SH_TOP_LEFT = CX - SH_HALF;
    const TL_SH_TOP_RIGHT = CX + SH_HALF;
    const TL_SH_END_RIGHT = CX + SH_HALF + SH_OUTER;
    const BB_OUT_L = CX - 130;
    const BB_IN_L = CX - 110;
    const BB_IN_R = CX + 110;
    const BB_OUT_R = CX + 130;

    const mainPath = `M ${SX0},${ST} L ${TL_SH_END},${ST} L ${TL_SH_TOP_LEFT},${SY_TOP} L ${TL_SH_TOP_RIGHT},${SY_TOP} L ${TL_SH_END_RIGHT},${ST} L ${SX1},${ST} Q ${SX1 + 20},${ST} ${SX1 + 20},${ST + 20} L ${SX1 + 20},${VBH - ST - 20} Q ${SX1 + 20},${VBH - ST} ${SX1},${VBH - ST} L ${BB_OUT_R},${VBH - ST} L ${BB_IN_R},${VBH - 20} L ${BB_IN_L},${VBH - 20} L ${BB_OUT_L},${VBH - ST} L ${SX0},${VBH - ST} Q ${SX0 - 20},${VBH - ST} ${SX0 - 20},${VBH - ST - 20} L ${SX0 - 20},${ST + 20} Q ${SX0 - 20},${ST} ${SX0},${ST} Z`;
    const goldPath = `M ${SX0 + 18},${ST + 18} L ${TL_SH_END + 10},${ST + 18} L ${TL_SH_TOP_LEFT + 10},${SY_TOP + 18} L ${TL_SH_TOP_RIGHT - 10},${SY_TOP + 18} L ${TL_SH_END_RIGHT - 10},${ST + 18} L ${SX1 - 18},${ST + 18} Q ${SX1 + 2},${ST + 18} ${SX1 + 2},${ST + 38} L ${SX1 + 2},${VBH - ST - 38} Q ${SX1 + 2},${VBH - ST - 18} ${SX1 - 18},${VBH - ST - 18} L ${BB_OUT_R - 12},${VBH - ST - 18} L ${BB_IN_R - 12},${VBH - 38} L ${BB_IN_L + 12},${VBH - 38} L ${BB_OUT_L + 12},${VBH - ST - 18} L ${SX0 + 18},${VBH - ST - 18} Q ${SX0 - 2},${VBH - ST - 18} ${SX0 - 2},${VBH - ST - 38} L ${SX0 - 2},${ST + 38} Q ${SX0 - 2},${ST + 18} ${SX0 + 18},${ST + 18} Z`;
    const innerPath = `M ${SX0 + 31},${ST + 31} L ${TL_SH_END + 14},${ST + 31} L ${TL_SH_TOP_LEFT + 14},${SY_TOP + 31} L ${TL_SH_TOP_RIGHT - 14},${SY_TOP + 31} L ${TL_SH_END_RIGHT - 14},${ST + 31} L ${SX1 - 31},${ST + 31} Q ${SX1 - 11},${ST + 31} ${SX1 - 11},${ST + 51} L ${SX1 - 11},${VBH - ST - 51} Q ${SX1 - 11},${VBH - ST - 31} ${SX1 - 31},${VBH - ST - 31} L ${BB_OUT_R - 26},${VBH - ST - 31} L ${BB_IN_R - 26},${VBH - 51} L ${BB_IN_L + 26},${VBH - 51} L ${BB_OUT_L + 26},${VBH - ST - 31} L ${SX0 + 31},${VBH - ST - 31} Q ${SX0 + 11},${VBH - ST - 31} ${SX0 + 11},${VBH - ST - 51} L ${SX0 + 11},${ST + 51} Q ${SX0 + 11},${ST + 31} ${SX0 + 31},${ST + 31} Z`;

    // BOMBILLAS
    const bulbSpacing = 40;
    const bulbs = [];
    for (let x = SX0 + 40; x < TL_SH_END - 10; x += bulbSpacing) bulbs.push({ cx: x, cy: ST, delay: ((x % 100) * 0.01).toFixed(2) });
    for (let x = TL_SH_TOP_LEFT + 15; x < TL_SH_TOP_RIGHT - 10; x += bulbSpacing) bulbs.push({ cx: x, cy: SY_TOP, delay: ((x % 100) * 0.012).toFixed(2) });
    bulbs.push({ cx: (TL_SH_END + TL_SH_TOP_LEFT) / 2, cy: (ST + SY_TOP) / 2, delay: "0.15" });
    bulbs.push({ cx: (TL_SH_TOP_RIGHT + TL_SH_END_RIGHT) / 2, cy: (SY_TOP + ST) / 2, delay: "0.25" });
    for (let x = TL_SH_END_RIGHT + 30; x < SX1 - 10; x += bulbSpacing) bulbs.push({ cx: x, cy: ST, delay: ((x % 100) * 0.011).toFixed(2) });
    for (let y = ST + 50; y < VBH - ST - 30; y += 50) bulbs.push({ cx: SX0 - 20, cy: y, delay: ((y % 100) * 0.008).toFixed(2) });
    for (let y = ST + 50; y < VBH - ST - 30; y += 50) bulbs.push({ cx: SX1 + 20, cy: y, delay: ((y % 100) * 0.009).toFixed(2) });
    for (let x = SX0 + 40; x < BB_OUT_L - 5; x += bulbSpacing) bulbs.push({ cx: x, cy: VBH - ST, delay: ((x % 100) * 0.013).toFixed(2) });
    bulbs.push({ cx: (BB_OUT_L + BB_IN_L) / 2, cy: (VBH - ST + VBH - 20) / 2, delay: "0.4" });
    bulbs.push({ cx: (BB_IN_R + BB_OUT_R) / 2, cy: (VBH - ST + VBH - 20) / 2, delay: "0.5" });
    for (let x = BB_IN_L + 15; x < BB_IN_R - 10; x += bulbSpacing) bulbs.push({ cx: x, cy: VBH - 20, delay: ((x % 100) * 0.014).toFixed(2) });
    for (let x = BB_OUT_R + 20; x < SX1 - 10; x += bulbSpacing) bulbs.push({ cx: x, cy: VBH - ST, delay: ((x % 100) * 0.015).toFixed(2) });

    let bulbsHtml = "";
    bulbs.forEach((b, i) => {
        const blinkType = i % 3 === 0 ? "blinkA" : i % 3 === 1 ? "blinkB" : "blinkC";
        bulbsHtml += `<circle cx="${b.cx}" cy="${b.cy}" r="14" fill="url(#bulbHalo)" filter="url(#bigGlow)" style="animation:${blinkType} 1.4s infinite;animation-delay:${b.delay}s"/>`;
        bulbsHtml += `<circle cx="${b.cx}" cy="${b.cy}" r="6" fill="url(#bigBulb)" style="animation:${blinkType} 1.4s infinite;animation-delay:${b.delay}s"/>`;
    });

    // TORNILLOS en las 4 esquinas
    const screwOff = 20;
    const screws = [
        { cx: SX0 + screwOff, cy: ST + screwOff + 18 },
        { cx: SX1 - screwOff, cy: ST + screwOff + 18 },
        { cx: SX0 + screwOff, cy: VBH - ST - screwOff - 18 },
        { cx: SX1 - screwOff, cy: VBH - ST - screwOff - 18 },
    ];
    let screwsHtml = "";
    screws.forEach((s, idx) => {
        screwsHtml += `<circle id="home-screw-${idx}" class="corner-screw" cx="${s.cx}" cy="${s.cy}" r="6" fill="#1a0000" stroke="url(#goldStroke)" stroke-width="1.5"/>`;
        // Grupo con las 2 lineas de la cruz; rota como un solo elemento
        screwsHtml += `<g id="home-screw-cross-${idx}" class="screw-cross-group" style="transform-origin: ${s.cx}px ${s.cy}px;">`;
        screwsHtml += `<line x1="${s.cx - 4}" y1="${s.cy}" x2="${s.cx + 4}" y2="${s.cy}" stroke="#ffaa00" stroke-width="1.2"/>`;
        screwsHtml += `<line x1="${s.cx}" y1="${s.cy - 4}" x2="${s.cx}" y2="${s.cy + 4}" stroke="#ffaa00" stroke-width="1.2"/>`;
        screwsHtml += `</g>`;
    });
    // Guardar posiciones de tornillos globalmente para deteccion de proximidad
    window._screws = screws;

    svg.innerHTML = `
    <defs>
      <linearGradient id="redLine" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c43a4e"/>
        <stop offset="25%" stop-color="#9e1f2f"/>
        <stop offset="50%" stop-color="#7a0016"/>
        <stop offset="75%" stop-color="#56000e"/>
        <stop offset="100%" stop-color="#380007"/>
      </linearGradient>
      <linearGradient id="redSheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="22%" stop-color="#ffd6de" stop-opacity="0.55"/>
        <stop offset="45%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="goldStroke" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd600"/>
        <stop offset="40%" stop-color="#ff8800"/>
        <stop offset="60%" stop-color="#b8860b"/>
        <stop offset="100%" stop-color="#ffd600"/>
      </linearGradient>
      <radialGradient id="bigBulb" cx="40%" cy="35%" r="50%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="20%" stop-color="#fff8c0"/>
        <stop offset="45%" stop-color="#ffd700"/>
        <stop offset="75%" stop-color="#ff8800"/>
        <stop offset="100%" stop-color="#cc4400"/>
      </radialGradient>
      <radialGradient id="bulbHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffd700" stop-opacity="0.9"/>
        <stop offset="40%" stop-color="#ff8800" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#ff8800" stop-opacity="0"/>
      </radialGradient>
      <filter id="bigGlow"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <path d="${mainPath}" fill="none" stroke="url(#redLine)" stroke-width="13" stroke-linejoin="round" filter="drop-shadow(0 2px 0 rgba(120,20,35,0.9)) drop-shadow(0 4px 0 rgba(60,0,12,0.95)) drop-shadow(0 7px 7px rgba(0,0,0,0.6))"/>
    <path d="${goldPath}" fill="none" stroke="url(#goldStroke)" stroke-width="2"/>
    <path id="shieldInner" d="${innerPath}" fill="none" stroke="rgba(255,0,51,0.7)" stroke-width="1"/>
    ${bulbsHtml}
    ${screwsHtml}
  `;
}

// ============================================================
// CONSTRUIR PISTA - circuito serpenteante con horquillas
// como el de la imagen de referencia
// ============================================================
function homeBuildTrack() {
    const trackSvg = document.getElementById("homeTrackSvg");
    const shieldSvg = document.getElementById("shieldSvg");
    const basePath = document.getElementById("progressPathDef");
    if (!trackSvg || !shieldSvg || !basePath) return;

    const shieldVB = shieldSvg.getAttribute("viewBox");
    trackSvg.setAttribute("viewBox", shieldVB);
    trackSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const [vbX, vbY, vbW, vbH] = shieldVB.split(" ").map(Number);
    const cx = vbX + vbW / 2;
    const cy = vbY + vbH / 2;
    const d = basePath.getAttribute("d");

    // AUTO: segundo camino interno, pegado por dentro de la linea amarilla/recorrido existente.
    // No dibuja pista nueva y no toca los sprites, timers, odometros ni contador.
    const AUTO_SCALE_X = (vbW - 68) / vbW;
    const AUTO_SCALE_Y = (vbH - 68) / vbH;

    trackSvg.innerHTML = `
    <g id="homeAutoInnerLayer" transform="translate(${cx} ${cy}) scale(${AUTO_SCALE_X} ${AUTO_SCALE_Y}) translate(${-cx} ${-cy})">
      <path id="homeAutoGlow" d="${d}" fill="none" stroke="#ff9000" stroke-width="6" stroke-linecap="round"
        pathLength="1"
        style="filter: blur(4px) drop-shadow(0 0 8px #ff9000); opacity: 0.55; stroke-dasharray: 1; stroke-dashoffset: 1;"/>
      <path id="homeAutoBar" d="${d}" fill="none" stroke="#ffcc33" stroke-width="2.2" stroke-linecap="round"
        pathLength="1"
        style="filter: drop-shadow(0 0 5px #ff9000) drop-shadow(0 0 10px #ff9000); stroke-dasharray: 1; stroke-dashoffset: 1;"/>
      <g id="homeAutoRunner">
        ${typeof iconoPremioSvg === "function" ? iconoPremioSvg("grand", -28, -12, 56, 24) : '<image href="img/auto.png" x="-28" y="-12" width="56" height="24"/>'}
      </g>
    </g>
  `;

    homeStartRunnerLoop();
}

let homeRunnerLoopId = null;
function homeStartRunnerLoop() {
    if (homeRunnerLoopId) cancelAnimationFrame(homeRunnerLoopId);

    const autoBar = document.getElementById("homeAutoBar");
    const autoGlow = document.getElementById("homeAutoGlow");
    const autoRunner = document.getElementById("homeAutoRunner");
    if (!autoBar || !autoRunner) return;

    const totalLen = autoBar.getTotalLength();
    const AUTO_DUR = 8; // misma sensacion de velocidad que los sheets
    const AUTO_OFFSET = 0.18; // va por dentro intentando alcanzar a la moto
    const t0 = performance.now() / 1000;

    function frame() {
        const active = SHEETS_DATA[currentSheetIdx] && SHEETS_DATA[currentSheetIdx].id === "home";
        if (!active) {
            homeRunnerLoopId = requestAnimationFrame(frame);
            return;
        }

        const now = performance.now() / 1000 - t0;
        const progress = (now / AUTO_DUR + AUTO_OFFSET) % 1;
        const offset = 1 - progress;

        autoBar.style.strokeDashoffset = offset;
        if (autoGlow) autoGlow.style.strokeDashoffset = offset;

        const len = progress * totalLen;
        const pt = autoBar.getPointAtLength(len);
        const ahead = autoBar.getPointAtLength(Math.min(len + 5, totalLen));
        const angle = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
        autoRunner.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${angle.toFixed(1)})`);

        homeRunnerLoopId = requestAnimationFrame(frame);
    }

    homeRunnerLoopId = requestAnimationFrame(frame);
}

// ============================================================
// POSICIONAR LOS POZOS dentro del area negra central
// (dentro del carril interno de la pista, sin tocar la pista)
// ============================================================
function homePositionPots() {
    // Layout del diseno "riel de oro": letrero arriba, 4 cards en 2x2 que llenan el interior
    // del riel, rombo en el cruce y POZO ACTIVO / EN JUEGO sobre el borde inferior de cada card.
    // Medidas en proporcion del tamano de la hoja (sin transform), asi sirve para cualquier pantalla.
    const sheet = document.querySelector(".sheet.home-sheet");
    if (!sheet) return;
    const W = sheet.clientWidth;
    const H = sheet.clientHeight;
    if (!W || !H) return;

    const ladoX = W * 0.034; // margen lateral (deja libre el riel)
    const colGap = W * 0.02; // separacion entre columnas (cabe el canto 3D)

    const util = W - ladoX * 2; // ancho libre entre los costados del riel
    const arriba = H * 0.192; // debajo del letrero
    const alto = H * 0.936 - arriba; // hasta el riel de abajo
    const gapY = H * 0.03;

    function place(id, x, y, w, h) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.style.width = w + "px";
        el.style.height = h + "px";
    }

    // Distribucion elegida en Ctrl+Shift+T > Apariencia (css/variantes/dashboard.css ajusta el interior de cada card)
    const dist = document.body.dataset.dHome || "cuadricula";
    const rects = {};
    if (dist === "filas") {
        // 4 franjas a todo lo ancho, una debajo de otra
        const h = (alto - gapY * 3) / 4;
        ["grand", "major", "minor", "mini"].forEach((id, i) => (rects[id] = [ladoX, arriba + i * (h + gapY), util, h]));
    } else if (dist === "destacado") {
        // GRAND grande a la izquierda, los otros 3 apilados a la derecha
        const wG = util * 0.56;
        const wD = util - wG - colGap;
        const h = (alto - gapY * 2) / 3;
        rects.grand = [ladoX, arriba, wG, alto];
        ["major", "minor", "mini"].forEach((id, i) => (rects[id] = [ladoX + wG + colGap, arriba + i * (h + gapY), wD, h]));
    } else if (dist === "podio") {
        // GRAND arriba a todo lo ancho, los otros 3 en fila abajo
        const hG = alto * 0.46;
        const w = (util - colGap * 2) / 3;
        rects.grand = [ladoX, arriba, util, hG];
        ["major", "minor", "mini"].forEach((id, i) => (rects[id] = [ladoX + i * (w + colGap), arriba + hG + gapY, w, alto - hG - gapY]));
    } else if (dist === "jerarquia") {
        // GRAND arriba a todo lo ancho y los demas en franjas debajo; si MAJOR muestra la moto,
        // GRAND y MAJOR van arriba lado a lado (en una franja baja la moto no se ve)
        const majorVehiculo = !document.getElementById("home-pot-major")?.classList.contains("sprite-off");
        const franjas = majorVehiculo ? ["minor", "mini"] : ["major", "minor", "mini"];
        const hG = alto * (majorVehiculo ? 0.5 : 0.42);
        const h = (alto - hG - gapY * franjas.length) / franjas.length;
        if (majorVehiculo) {
            const w = (util - colGap) / 2;
            rects.grand = [ladoX, arriba, w, hG];
            rects.major = [ladoX + w + colGap, arriba, w, hG];
        } else {
            rects.grand = [ladoX, arriba, util, hG];
        }
        franjas.forEach((id, i) => (rects[id] = [ladoX, arriba + hG + gapY + i * (h + gapY), util, h]));
    } else {
        // cuadricula 2x2 (la de siempre)
        const w = (util - colGap) / 2;
        const h1 = H * 0.37;
        const y2 = H * 0.592;
        rects.grand = [ladoX, arriba, w, h1];
        rects.major = [ladoX + w + colGap, arriba, w, h1];
        rects.minor = [ladoX, y2, w, H * 0.344];
        rects.mini = [ladoX + w + colGap, y2, w, H * 0.344];
    }
    Object.entries(rects).forEach(([id, r]) => place("home-pot-" + id, ...r));
    // halo del latido: mismo rectangulo que su card, detras de ella (solo cambia de opacidad)
    ["grand", "major", "minor", "mini"].forEach((id) => {
        const pot = document.getElementById("home-pot-" + id);
        if (!pot) return;
        let halo = document.getElementById("home-halo-" + id);
        if (!halo) {
            halo = document.createElement("i");
            halo.className = "home-halo";
            halo.id = "home-halo-" + id;
            pot.parentNode.insertBefore(halo, pot);
        }
        halo.style.setProperty("--pot-c", "var(--c-" + id + ")");
        ["left", "top", "width", "height"].forEach((k) => (halo.style[k] = pot.style[k]));
        halo.classList.toggle("en-foco", pot.classList.contains("en-foco"));
    });
    // Card en foco (window.homeFoco: 0 grand, 1 major, 2 minor, 3 mini; -1 ninguna).
    // El efecto lo pone css/home-diseno.css segun la clase en-foco (el tamano no cambia).
    const foco = typeof window.homeFoco === "number" ? window.homeFoco : -1;
    ["grand", "major", "minor", "mini"].forEach((id, i) => {
        const pot = document.getElementById("home-pot-" + id);
        if (pot) pot.classList.toggle("en-foco", i === foco);
        const est = document.getElementById("home-estado-" + id);
        if (est) est.classList.toggle("en-foco", i === foco);
    });
    const homeSheet = document.querySelector(".sheet.home-sheet");
    if (homeSheet) homeSheet.classList.toggle("con-foco", foco >= 0);

    // Estado montado sobre el borde inferior de cada card
    const estado = (id, x, y) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.left = x + W * 0.022 + "px";
        el.style.top = y + "px";
    };
    Object.entries(rects).forEach(([id, r]) => estado("home-estado-" + id, r[0], r[1] + r[3]));

    // Rombo en el cruce de las 4 cards (solo en la cuadricula)
    const rombo = document.getElementById("homeRombo");
    if (rombo) {
        rombo.style.display = dist === "cuadricula" ? "" : "none";
        rombo.style.left = W / 2 + "px";
        rombo.style.top = (rects.grand[1] + rects.grand[3] + rects.minor[1]) / 2 + "px";
    }

    if (typeof homeDibujarRiel === "function") homeDibujarRiel(sheet);
    if (typeof homeAjustarOdometros === "function") requestAnimationFrame(homeAjustarOdometros);
}

// Construir todo - solo una vez al inicio
function homeRebuildAll() {
    homeBuildShield();
    requestAnimationFrame(() => {
        homeBuildTrack();
        requestAnimationFrame(homePositionPots);
    });
}

// ============================================================
// TERMOMETRO: cuenta regresiva configurable por HOME_DURATION del dashboard
// ============================================================
let homeThermoRafId = null;
let homeThermoStartTime = 0;

function homeStartThermo() {
    homeThermoStartTime = performance.now();
    if (homeThermoRafId) cancelAnimationFrame(homeThermoRafId);

    function tick() {
        const thermoFill = document.getElementById("homeThermoFill");
        const countdown = document.getElementById("homeCountdown");
        if (!thermoFill || !countdown) return;

        const durationMs = typeof HOME_DURATION !== "undefined" ? HOME_DURATION : 60000;
        const elapsed = performance.now() - homeThermoStartTime;
        const remaining = Math.max(0, durationMs - elapsed);
        const progress = Math.min(1, elapsed / durationMs);

        thermoFill.style.width = progress * 100 + "%";
        countdown.textContent = Math.ceil(remaining / 1000) + "s";

        if (remaining > 0) {
            homeThermoRafId = requestAnimationFrame(tick);
        }
    }
    requestAnimationFrame(tick);
}

function homeStopThermo() {
    if (homeThermoRafId) {
        cancelAnimationFrame(homeThermoRafId);
        homeThermoRafId = null;
    }
}

function homeStopRunnerLoop() {
    if (typeof homeRunnerLoopId !== "undefined" && homeRunnerLoopId) {
        cancelAnimationFrame(homeRunnerLoopId);
        homeRunnerLoopId = null;
    }
}
