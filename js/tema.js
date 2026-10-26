// =================================================================
// TEMA: textos editables que se ven en pantalla (nombre del progresivo,
// nombre y subtitulos de cada pozo, mensajes). Se guardan en tema.json
// (userData) y se leen de GET /tema. aplicarTema() los pone en el HOME,
// las hojas de cada pozo, la promo y el modal de ganador.
// =================================================================
window.TEMA = window.TEMA || null;

// Subtitulo de un pozo segun si muestra el vehiculo o el monto en efectivo
function temaSubtitulo(id, conVehiculo) {
    const p = window.TEMA && window.TEMA.pozos && window.TEMA.pozos[id];
    if (!p) return null;
    return conVehiculo && p.subtituloPremio ? p.subtituloPremio : p.subtituloEfectivo;
}

function temaNombre(id) {
    const p = window.TEMA && window.TEMA.pozos && window.TEMA.pozos[id];
    return p ? p.nombre : null;
}

// Cambiar la distribucion (o un estilo que cambia el tamano del letrero o del contenedor)
// obliga a recolocar las cards y redibujar el riel/escudo (el resize del dashboard hace las dos cosas)
function ponerDistribucion(clave, valor) {
    if (document.body.dataset[clave] === valor) return;
    document.body.dataset[clave] = valor;
    dispatchEvent(new Event("resize"));
}

function aplicarTema(tema) {
    if (tema) window.TEMA = tema;
    const t = window.TEMA;
    if (!t) return;
    const poner = (sel, txt, raiz = document) => raiz.querySelectorAll(sel).forEach((el) => {
        if (txt && el.textContent !== txt) el.textContent = txt;
    });

    // Variante de diseno de cada vista (css/variantes/)
    const v = t.variantes || {};
    ponerDistribucion("vHome", v.home || "oro");
    ponerDistribucion("vHojas", v.hojas || "oro");
    document.body.dataset.vPromo = v.promo || "destacado";
    document.body.dataset.vGanador = v.ganador || "clasico";
    ponerDistribucion("dHome", v.homeDist || "cuadricula");
    ponerDistribucion("dHojas", v.hojasDist || "centrado");

    // Nombre del progresivo
    poner(".home-marquee-title h1", t.nombre);
    poner("#promoMarca span", t.nombre);
    if (typeof SHEETS_DATA !== "undefined") {
        const home = SHEETS_DATA.find((s) => s.id === "home");
        if (home) home.title = t.nombre;
    }

    // Pozos: nombre (titulo) y subtitulo en HOME, hojas y promo
    ["grand", "major", "minor", "mini"].forEach((id) => {
        const nombre = temaNombre(id);
        const conVehiculo = (id === "grand" || id === "major") && !(window.SPRITE_CONFIG && window.SPRITE_CONFIG[id] === false);
        const sub = temaSubtitulo(id, conVehiculo);
        const homePot = document.getElementById("home-pot-" + id);
        if (homePot) {
            poner(".home-pot-title", nombre, homePot);
            poner(".home-pot-subtitle", sub, homePot);
        }
        const hoja = document.querySelector('.sheet[data-id="' + id + '"]');
        if (hoja) {
            poner(".sheet-title", nombre, hoja);
            poner(".sheet-subtitle", sub, hoja);
        }
        const placa = document.querySelector('.promo-placa[data-pozo="' + id + '"]');
        if (placa) {
            poner(".promo-placa-titulo", nombre, placa);
            poner(".promo-placa-premio", temaSubtitulo(id, true), placa);
        }
        if (typeof SHEETS_DATA !== "undefined") {
            const d = SHEETS_DATA.find((s) => s.id === id);
            if (d) {
                d.title = nombre;
                d.subtitle = sub;
            }
        }
    });

    // Mensajes
    const m = t.mensajes || {};
    poner('.hoja-placa[data-placa="crece"] .hoja-txt', m.pozoCreciendo);
    poner(".hoja-placa[data-placa='hora'] .hoja-marco:first-child small", m.hora);
    poner(".hoja-placa[data-placa='hora'] .hoja-marco:last-child small", m.fecha);
    poner(".home-estado .home-pot-tag", m.pozoActivo);
    poner(".home-estado .home-estado-txt", m.enJuego);
    const sig = document.getElementById("nextPromoText");
    if (sig && m.siguienteVideo && !sig.textContent.startsWith(m.siguienteVideo)) {
        sig.textContent = sig.textContent.replace(/^[^:]*/, m.siguienteVideo);
    }
}

// Cargar el tema al iniciar. Las vistas se arman en distintos momentos de la carga,
// por eso se vuelve a aplicar unas veces hasta que todo existe.
(function cargarTema(intentos) {
    if (!window.CASINO_API) return setTimeout(() => cargarTema(intentos), 300);
    fetch(window.CASINO_API + "/tema")
        .then((r) => r.json())
        .then((tema) => {
            aplicarTema(tema);
            [1000, 3000, 6000, 10000].forEach((ms) => setTimeout(aplicarTema, ms));
        })
        .catch(() => {
            if (intentos > 0) setTimeout(() => cargarTema(intentos - 1), 1000);
        });
})(10);
