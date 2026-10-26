// =================================================================
// IMAGEN DEL PREMIO de GRAND y MAJOR (subida desde Ctrl+Shift+T).
// Si el pozo tiene una imagen subida se usa en el HOME, en su vista,
// en el modal ganador y en el icono que corre por el camino neon.
//   tipo "sprite": hoja de 6x6 cuadros que gira (igual que la original)
//   tipo "imagen": imagen fija, se muestra entera y flota suave
// Sin imagen subida queda la de siempre (img/auto_sprite.png, img/moto_sprite.png).
// El estilo lo pone css/premios.css a partir de body[data-premio-grand|major]
// y las variables --premio-grand / --premio-major.
// =================================================================
(function () {
    window.PREMIOS = {}; // { grand: { tipo, url }, major: {...} } solo los subidos

    // Icono chico del camino neon. Para un sprite se muestra solo el primer cuadro.
    window.iconoPremioSvg = function (pozo, x, y, w, h) {
        const p = window.PREMIOS[pozo];
        const original = pozo === "grand" ? "img/auto.png" : "img/moto.png";
        if (!p) return `<image href="${original}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
        if (p.tipo === "sprite") {
            return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 1 1" overflow="hidden">
        <image href="${p.url}" width="6" height="6" preserveAspectRatio="none"/></svg>`;
        }
        return `<image href="${p.url}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    };

    // info: respuesta de GET /premios ({ grand: { tipo, version }, ... })
    window.aplicarPremios = function (info) {
        const api = window.CASINO_API || (typeof API_BASE !== "undefined" ? API_BASE : "");
        const antes = JSON.stringify(window.PREMIOS);
        window.PREMIOS = {};
        ["grand", "major"].forEach((pozo) => {
            const x = info && info[pozo];
            const clave = pozo === "grand" ? "premioGrand" : "premioMajor";
            if (x && (x.tipo === "sprite" || x.tipo === "imagen")) {
                const url = api + "/premio-img/" + pozo + "?v=" + x.version;
                window.PREMIOS[pozo] = { tipo: x.tipo, url };
                document.body.style.setProperty("--premio-" + pozo, `url("${url}")`);
                document.body.dataset[clave] = x.tipo;
            } else {
                document.body.style.removeProperty("--premio-" + pozo);
                delete document.body.dataset[clave];
            }
        });
        // el camino neon se dibuja con el icono: si cambio, se redibuja
        if (JSON.stringify(window.PREMIOS) !== antes) dispatchEvent(new Event("resize"));
    };

    window.cargarPremios = function () {
        const api = window.CASINO_API || (typeof API_BASE !== "undefined" ? API_BASE : "");
        if (!api) return setTimeout(window.cargarPremios, 500);
        fetch(api + "/premios")
            .then((r) => (r.ok ? r.json() : null))
            .then((info) => info && window.aplicarPremios(info))
            .catch(() => setTimeout(window.cargarPremios, 3000));
    };
    window.cargarPremios();
})();
