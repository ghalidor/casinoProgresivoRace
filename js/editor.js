// =================================================================
// EDITORES EN PANTALLA
// - Icono "?"       : muestra las combinaciones de teclas (tambien Ctrl+Shift+H).
// - Icono de sonido : silencia / activa todo el sonido (se recuerda en este equipo).
// - Ctrl+Shift+T    : editar el tema (nombre del progresivo, nombres y subtitulos
//                     de los pozos, mensajes). Se guarda en tema.json.
// - Ctrl+Shift+P    : editar los parametros de config. Se guardan en
//                     config-local.json y la pantalla se recarga para aplicarlos.
// Los dos editores piden el PIN del panel (el mismo de Ctrl+Shift+C).
// Usa los estilos del panel admin (css/panel-admin.css) y css/editor.css.
// =================================================================
(function () {
    const ATAJOS = [
        ["Ctrl + Shift + T", "Editar el tema: nombre, pozos, subtítulos y mensajes"],
        ["Ctrl + Shift + P", "Editar los parámetros de configuración"],
        ["Ctrl + Shift + C", "Panel: vehículo en pantalla y log de ganadores"],
        ["Ctrl + Shift + H", "Mostrar esta ayuda"],
        ["Ctrl + Shift + K", "Cambiar entre pantalla completa y ventana"],
        ["Ctrl + Shift + R", "Recargar la pantalla"],
        ["Ctrl + Shift + Q", "Cerrar la aplicación"],
        ["Esc", "Cerrar el panel abierto"],
    ];

    // Textos de los parametros de config (los que no esten aqui se muestran con su nombre)
    const PARAMETROS = {
        windowMode: ["Modo de ventana (window / kiosk)", true],
        homeViewDurationSec: ["Duración del dashboard inicial (s)"],
        promoIntervalSec: ["Tiempo entre videos (s)"],
        promoDurationSec: ["Duración de cada video (s)"],
        kpiSpeed: ["Velocidad de los indicadores"],
        useTestData: ["Usar datos de prueba"],
        winnerDelaySec: ["Espera antes de mostrar un ganador (s)"],
        winnerModalDurationSec: ["Tiempo del ganador en pantalla (s)"],
        modalVideoVolume: ["Volumen de videos y ganador (0 a 1)"],
        bgMusicVolume: ["Volumen de la música de fondo (0 a 1)"],
        httpPort: ["Puerto HTTP", true],
        cleanupIntervalMin: ["Limpieza de datos cada (min)"],
        memoryReloadMB: ["Recargar si la memoria pasa de (MB)"],
        reloadCheckIntervalSec: ["Revisar la memoria cada (s)"],
        iasEnabled: ["Enviar ganadores al IAS"],
        iasBaseUrl: ["Dirección del servidor IAS"],
        iasRetryIntervalSec: ["Reintentar envíos al IAS cada (s)"],
        confirmMinDisplaySec: ["Tiempo mínimo del mensaje de confirmación (s)"],
        msgAcreditadoOk: ["Mensaje: acreditado correctamente"],
        msgAcreditadoError: ["Mensaje: error al acreditar"],
        msgSinConfirmacion: ["Mensaje: sin confirmación"],
        detalleAcreditadoTimeout: ["Detalle IAS: sin confirmación"],
        detalleAcreditadoAuto: ["Detalle IAS: acreditación automática"],
    };

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

    function api(ruta, cuerpo) {
        if (!window.CASINO_API) return Promise.reject(new Error("API no disponible"));
        const op = cuerpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) } : {};
        return fetch(window.CASINO_API + ruta, op).then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(new Error(j.error || r.status)))));
    }

    // ---------- paneles (misma estructura que el panel admin) ----------
    function crearPanel(id, titulo, cuerpoHtml) {
        document.body.insertAdjacentHTML(
            "beforeend",
            `<div id="${id}" class="panel-admin ed-panel">
        <div class="pa-caja">
          <div class="pa-cabecera"><span>${titulo}</span><button class="ed-cerrar" title="Cerrar (Esc)">&#10005;</button></div>
          <div class="pa-cuerpo">${cuerpoHtml}</div>
        </div>
      </div>`,
        );
        const panel = document.getElementById(id);
        panel.querySelector(".ed-cerrar").addEventListener("click", () => panel.classList.remove("abierto"));
        return panel;
    }

    const PIN_HTML = `<div class="ed-paso-pin pa-pin">
      <label>PIN</label><input class="ed-pin" type="password" autocomplete="off" />
      <button class="pa-boton ed-entrar">Entrar</button><div class="pa-error ed-pin-error"></div></div>`;

    // Pide el PIN; si es correcto llama a alEntrar(pin)
    function prepararPin(panel, alEntrar) {
        const caja = panel.querySelector(".ed-paso-pin");
        const input = panel.querySelector(".ed-pin");
        const error = panel.querySelector(".ed-pin-error");
        const entrar = () => {
            error.textContent = "";
            api("/admin/pin", { pin: input.value })
                .then((r) => {
                    if (!r.ok) {
                        error.textContent = "PIN incorrecto";
                        input.select();
                        return;
                    }
                    caja.style.display = "none";
                    alEntrar(input.value);
                })
                .catch((e) => (error.textContent = "Error: " + e.message));
        };
        panel.querySelector(".ed-entrar").addEventListener("click", entrar);
        input.addEventListener("keydown", (e) => e.key === "Enter" && entrar());
        return () => {
            caja.style.display = "";
            input.value = "";
            error.textContent = "";
            setTimeout(() => input.focus(), 50);
        };
    }

    // ---------- AYUDA ----------
    const ayuda = crearPanel(
        "edAyuda",
        "Combinaciones de teclas",
        `<table class="ed-atajos">${ATAJOS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join("")}</table>`,
    );

    // ---------- VARIANTES DE DISENO (css/variantes/) ----------
    const VARIANTES = {
        home: {
            titulo: "Dashboard inicial - estilo",
            opciones: [
                ["oro", "Oro", "Riel y marcos dorados con LEDs (actual)"],
                ["neon", "Neón", "Tubos de neón, vidrio negro y escaneo"],
                ["cromo", "Cromo", "Acero cromado con destellos"],
                ["rubi", "Rubí", "Terciopelo rojo, oro y joyas que titilan"],
                ["marquesina", "Marquesina", "Cards con bombillas de casino que se encienden alternadas"],
                ["deco", "Art Déco", "Negro laca, abanico y marcos de oro escalonados"],
                ["fichas", "Fichas", "Paño verde y cards como fichas de casino"],
            ],
        },
        hojas: {
            titulo: "Vistas de cada pozo - estilo",
            opciones: [
                ["oro", "Oro", "Letrero y contenedor del color del pozo (actual)"],
                ["neon", "Neón", "Neón que parpadea y barrido de luz"],
                ["cromo", "Cromo", "Cromo y plata con destello"],
                ["rubi", "Rubí", "Rubí y oro con destellos de joya"],
                ["rodillos", "Rodillos", "Frente de tragamonedas: bombillas, ventana cromada y línea de pago"],
                ["lluvia", "Lluvia de oro", "Monedas doradas que caen detrás del monto"],
                ["deco", "Abanico Déco", "Rayos que giran y marcos de oro art déco"],
            ],
        },
        homeDist: {
            titulo: "Dashboard inicial - distribución",
            opciones: [
                ["cuadricula", "Cuadrícula", "Los 4 pozos en 2 x 2 (actual)"],
                ["destacado", "Destacado", "GRAND grande y los otros 3 a la derecha"],
                ["filas", "Filas", "4 franjas a todo lo ancho"],
                ["podio", "Podio", "GRAND arriba y los otros 3 en fila"],
                ["jerarquia", "Jerarquía", "GRAND arriba a todo lo ancho y los otros en franjas (con moto, GRAND y MAJOR arriba)"],
            ],
        },
        hojasDist: {
            titulo: "Vistas de cada pozo - distribución",
            opciones: [
                ["centrado", "Centrado", "Título, monto y mensaje al centro (actual)"],
                ["gigante", "Gigante", "Monto enorme, sin mensaje abajo"],
                ["columnas", "Columnas", "Monto a la izquierda y mensajes a la derecha"],
                ["inferior", "Inferior", "Mensaje arriba y monto grande abajo"],
            ],
        },
        promo: {
            titulo: "Video",
            opciones: [
                ["destacado", "Destacado", "Una placa que rota los 4 pozos (actual)"],
                ["cinta", "Cinta", "Los 4 pozos en una cinta abajo"],
                ["esquinas", "Esquinas", "Un pozo en cada esquina"],
                ["ventana", "Ventana", "Video en marco y pozos en columna"],
                ["ticker", "Ticker", "Los 4 pozos pasan en una banda abajo"],
                ["marcoL", "Marco L", "Video en la esquina, nombre al costado y monto gigante abajo"],
                ["vitrina", "Vitrina", "Cartel con bombillas que da la vuelta en cada pozo"],
            ],
        },
        ganador: {
            titulo: "Modal ganador",
            opciones: [
                ["clasico", "Clásico", "Todo en columna al centro (actual)"],
                ["marquesina", "Marquesina", "Bombillas de casino, corona de oro y cartel luminoso del color del pozo"],
                ["deco", "Art Déco", "Negro laca, abanico dorado, medallón y marcos de oro"],
                ["tesoro", "Tesoro", "Paño verde, monedas que caen, cofre y lingote de oro"],
            ],
        },
    };
    const DATASET = { home: "vHome", hojas: "vHojas", promo: "vPromo", homeDist: "dHome", hojasDist: "dHojas", ganador: "vGanador" };
    let variantesSel = { home: "oro", hojas: "oro", promo: "destacado", homeDist: "cuadricula", hojasDist: "centrado", ganador: "clasico" };
    // poner una variante en pantalla; se vuelve a medir todo porque algunos estilos cambian
    // el tamano del letrero o del contenedor (el camino neon y el odometro dependen de eso)
    function ponerVariante(vista, v) {
        if (document.body.dataset[DATASET[vista]] === v) return;
        document.body.dataset[DATASET[vista]] = v;
        dispatchEvent(new Event("resize"));
    }
    const htmlVariantes = Object.entries(VARIANTES)
        .map(
            ([vista, def]) =>
                `<div class="ed-var-grupo"><span class="ed-var-titulo">${def.titulo}</span><div class="ed-var-ops">${def.opciones
                    .map(([v, nombre, desc]) => `<button class="ed-var" data-vista="${vista}" data-v="${v}"><img class="ed-var-mini" src="img/variantes/${vista}-${v}.jpg" alt="" loading="lazy" onerror="this.remove()"><b>${nombre}</b><small>${desc}</small></button>`)
                    .join("")}</div></div>`,
        )
        .join("");

    // ---------- TEMA ----------
    const POZOS = [
        ["grand", true],
        ["major", true],
        ["minor", false],
        ["mini", false],
    ];
    const campo = (clave, etiqueta) => `<label class="ed-campo"><span>${etiqueta}</span><input data-k="${clave}" type="text" maxlength="60" /></label>`;
    const tema = crearPanel(
        "edTema",
        "Editar tema",
        `${PIN_HTML}
    <div class="ed-paso-datos" style="display:none">
      <div class="pa-seccion"><h3>Apariencia</h3>
        <p class="pa-nota">Toca una opción para verla en pantalla. Se guarda con el botón Guardar.</p>${htmlVariantes}</div>
      <div class="pa-seccion"><h3>Premio de GRAND y MAJOR</h3>
        <p class="pa-nota">Elige si cada pozo muestra su imagen o su monto, y sube la imagen del premio.
          Sprite 3D: una hoja de 6 x 6 cuadros que gira (como el auto y la moto actuales). Imagen fija: un PNG o WebP que se muestra entero.
          Estos cambios se aplican al momento (no hace falta Guardar).</p>
        ${["grand", "major"].map((pozo) => `<div class="ed-premio" data-pozo="${pozo}">
          <div class="ed-premio-vista"></div>
          <div class="ed-premio-datos">
            <b class="ed-premio-titulo">${pozo.toUpperCase()}</b>
            <div class="ed-premio-fila"><span>Se muestra:</span>
              <button class="ed-var ed-premio-modo" data-show="1"><b>Imagen</b></button>
              <button class="ed-var ed-premio-modo" data-show="0"><b>Monto</b></button></div>
            <div class="ed-premio-actual"></div>
            <div class="ed-premio-fila">
              <label class="pa-boton secundario ed-premio-elegir">Elegir imagen<input type="file" accept="image/png,image/webp" hidden /></label>
              <button class="pa-boton secundario ed-premio-original">Volver a la original</button></div>
            <div class="ed-premio-nueva" hidden>
              <div class="ed-premio-fila"><span>Tipo:</span>
                <button class="ed-var ed-premio-tipo" data-tipo="sprite"><b>Sprite 3D</b></button>
                <button class="ed-var ed-premio-tipo" data-tipo="imagen"><b>Imagen fija</b></button></div>
              <div class="ed-premio-aviso pa-nota"></div>
              <button class="pa-boton ed-premio-subir">Subir esta imagen</button></div>
            <div class="pa-msg ed-premio-estado"></div>
          </div></div>`).join("")}
      </div>
      <div class="pa-seccion"><h3>Progresivo</h3>${campo("nombre", "Nombre del progresivo")}</div>
      ${POZOS.map(
          ([id, premio]) => `<div class="pa-seccion"><h3>Pozo ${id.toUpperCase()}</h3>
          ${campo("pozos." + id + ".nombre", "Nombre (título de la vista)")}
          ${premio ? campo("pozos." + id + ".subtituloPremio", "Subtítulo con vehículo") : ""}
          ${campo("pozos." + id + ".subtituloEfectivo", "Subtítulo en efectivo")}</div>`,
      ).join("")}
      <div class="pa-seccion"><h3>Mensajes</h3>
        ${campo("mensajes.pozoCreciendo", "Mensaje bajo el monto")}
        ${campo("mensajes.pozoActivo", "Etiqueta del pozo")}
        ${campo("mensajes.enJuego", "Placa del pozo")}
        ${campo("mensajes.siguienteVideo", "Texto antes del contador de video")}
        ${campo("mensajes.hora", "Rótulo de la hora")}
        ${campo("mensajes.fecha", "Rótulo de la fecha")}
      </div>
      <div class="ed-acciones"><button class="pa-boton ed-guardar">Guardar</button><span class="pa-msg ed-estado"></span></div>
    </div>`,
    );
    let pinTema = "";

    // ---------- PREMIO de GRAND y MAJOR: monto o imagen, y subir la imagen ----------
    // "Se muestra" usa el mismo /sprite-config que el sistema externo (un solo valor).
    // La imagen se sube a /admin/premio (con PIN) y queda en la carpeta de datos del equipo.
    const premios = { grand: {}, major: {} }; // por pozo: { nueva: { datos, nombre, url, ancho, alto }, tipo }
    function vistaPremio(caja, url, tipo) {
        const v = caja.querySelector(".ed-premio-vista");
        v.style.backgroundImage = url ? `url("${url}")` : "";
        v.dataset.tipo = tipo;
    }
    function pintarPremio(pozo, info, cfg) {
        const caja = tema.querySelector(`.ed-premio[data-pozo="${pozo}"]`);
        const x = info[pozo] || { tipo: "original" };
        const original = pozo === "grand" ? "img/auto_sprite.png" : "img/moto_sprite.png";
        const url = x.tipo === "original" ? original : window.CASINO_API + "/premio-img/" + pozo + "?v=" + x.version;
        vistaPremio(caja, url, x.tipo === "imagen" ? "imagen" : "sprite");
        caja.querySelector(".ed-premio-actual").textContent =
            x.tipo === "original"
                ? "Imagen actual: la original (" + (pozo === "grand" ? "auto" : "moto") + ")"
                : "Imagen actual: " + x.nombre + (x.tipo === "sprite" ? " (sprite 3D)" : " (imagen fija)");
        caja.querySelector(".ed-premio-original").disabled = x.tipo === "original";
        if (cfg) caja.querySelectorAll(".ed-premio-modo").forEach((b) => b.classList.toggle("sel", (b.dataset.show === "1") === !!cfg[pozo]));
        caja.querySelector(".ed-premio-nueva").hidden = true;
        premios[pozo] = {};
    }
    function cargarSeccionPremios() {
        Promise.all([api("/premios"), api("/sprite-config")]).then(([info, cfg]) => ["grand", "major"].forEach((p) => pintarPremio(p, info, cfg)));
    }
    function estadoPremio(caja, txt, error) {
        const e = caja.querySelector(".ed-premio-estado");
        e.className = "pa-msg ed-premio-estado" + (error ? " error" : txt ? " ok" : "");
        e.textContent = txt || "";
    }
    function marcarTipo(caja, pozo, tipo) {
        premios[pozo].tipo = tipo;
        caja.querySelectorAll(".ed-premio-tipo").forEach((b) => b.classList.toggle("sel", b.dataset.tipo === tipo));
        const n = premios[pozo].nueva;
        vistaPremio(caja, n.url, tipo);
        const esGrilla = n.ancho === n.alto && n.ancho % 6 === 0;
        caja.querySelector(".ed-premio-aviso").textContent =
            tipo === "sprite" && !esGrilla
                ? "Ojo: esta imagen no parece una hoja de 6 x 6 cuadros (" + n.ancho + " x " + n.alto + "). Si no lo es, se verá cortada: elige Imagen fija."
                : tipo === "sprite"
                  ? "Se ve girando como en la vista previa."
                  : "Se muestra entera, flotando suave.";
    }
    function trasCambio(caja, pozo, r, mensaje) {
        if (typeof window.aplicarPremios === "function") window.aplicarPremios(r.premios);
        return api("/sprite-config").then((cfg) => {
            pintarPremio(pozo, r.premios, cfg);
            estadoPremio(caja, mensaje);
        });
    }
    tema.querySelectorAll(".ed-premio").forEach((caja) => {
        const pozo = caja.dataset.pozo;
        caja.querySelectorAll(".ed-premio-modo").forEach((b) =>
            b.addEventListener("click", () => {
                const show = b.dataset.show === "1";
                api("/sprite-config", { sheet: pozo, show })
                    .then(() => {
                        caja.querySelectorAll(".ed-premio-modo").forEach((x) => x.classList.toggle("sel", x === b));
                        estadoPremio(caja, show ? "Ahora muestra la imagen (al ganar se acredita solo)" : "Ahora muestra el monto (al ganar espera confirmación)");
                    })
                    .catch((e) => estadoPremio(caja, "No se pudo cambiar: " + e.message, true));
            }),
        );
        caja.querySelector("input[type=file]").addEventListener("change", (ev) => {
            const f = ev.target.files[0];
            ev.target.value = "";
            if (!f) return;
            if (f.size > 8 * 1024 * 1024) return estadoPremio(caja, "La imagen pesa más de 8 MB", true);
            const lector = new FileReader();
            lector.onload = () => {
                const img = new Image();
                img.onload = () => {
                    premios[pozo] = { nueva: { datos: String(lector.result).split(",")[1], nombre: f.name, url: lector.result, ancho: img.naturalWidth, alto: img.naturalHeight } };
                    caja.querySelector(".ed-premio-nueva").hidden = false;
                    // sugerencia: cuadrada y divisible en 6 x 6 -> sprite; si no, imagen fija
                    marcarTipo(caja, pozo, img.naturalWidth === img.naturalHeight && img.naturalWidth % 6 === 0 ? "sprite" : "imagen");
                    estadoPremio(caja, "Vista previa: " + f.name + ". Revisa el tipo y toca Subir.");
                };
                img.onerror = () => estadoPremio(caja, "No se pudo leer la imagen (usa PNG o WebP)", true);
                img.src = lector.result;
            };
            lector.readAsDataURL(f);
        });
        caja.querySelectorAll(".ed-premio-tipo").forEach((b) => b.addEventListener("click", () => marcarTipo(caja, pozo, b.dataset.tipo)));
        caja.querySelector(".ed-premio-subir").addEventListener("click", () => {
            const n = premios[pozo].nueva;
            if (!n) return;
            estadoPremio(caja, "Subiendo...");
            api("/admin/premio", { pin: pinTema, pozo, tipo: premios[pozo].tipo, nombre: n.nombre, datos: n.datos })
                .then((r) => trasCambio(caja, pozo, r, "Imagen guardada y aplicada"))
                .catch((e) => estadoPremio(caja, "No se pudo subir: " + e.message, true));
        });
        caja.querySelector(".ed-premio-original").addEventListener("click", () => {
            api("/admin/premio/quitar", { pin: pinTema, pozo })
                .then((r) => trasCambio(caja, pozo, r, "Volvió a la imagen original"))
                .catch((e) => estadoPremio(caja, "No se pudo: " + e.message, true));
        });
    });
    const leerRuta = (obj, ruta) => ruta.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
    const ponerRuta = (obj, ruta, v) => {
        const ks = ruta.split(".");
        let o = obj;
        ks.slice(0, -1).forEach((k) => (o = o[k] = o[k] || {}));
        o[ks[ks.length - 1]] = v;
    };
    const pedirPinTema = prepararPin(tema, (pin) => {
        pinTema = pin;
        api("/tema").then((t) => {
            tema.querySelectorAll("input[data-k]").forEach((i) => (i.value = leerRuta(t, i.dataset.k) || ""));
            variantesSel = Object.assign({}, variantesSel, t.variantes || {});
            marcarVariantes();
            tema.querySelector(".ed-paso-datos").style.display = "";
            cargarSeccionPremios();
            tema.querySelector("input[data-k]").focus();
        });
    });
    tema.querySelector(".ed-guardar").addEventListener("click", () => {
        const estado = tema.querySelector(".ed-estado");
        const nuevo = {};
        tema.querySelectorAll("input[data-k]").forEach((i) => ponerRuta(nuevo, i.dataset.k, i.value));
        nuevo.variantes = Object.assign({}, variantesSel);
        estado.className = "pa-msg ed-estado";
        estado.textContent = "Guardando...";
        api("/admin/tema", { pin: pinTema, tema: nuevo })
            .then((r) => {
                if (typeof aplicarTema === "function") aplicarTema(r.tema);
                if (typeof applyAllSpriteConfig === "function") applyAllSpriteConfig();
                estado.className = "pa-msg ed-estado ok";
                estado.textContent = "Guardado. Ya se ve en pantalla.";
            })
            .catch((e) => {
                estado.className = "pa-msg ed-estado error";
                estado.textContent = "No se guardó: " + e.message;
            });
    });

    // ---------- PARAMETROS (config) ----------
    const config = crearPanel(
        "edConfig",
        "Parámetros de configuración",
        `${PIN_HTML}
    <div class="ed-paso-datos" style="display:none">
      <p class="pa-nota">Al guardar, la pantalla se recarga para aplicar los cambios.
        Los marcados con <b>(reinicio)</b> se aplican al volver a abrir la aplicación.
        Los valores originales de config.json no se modifican.</p>
      <div class="ed-campos"></div>
      <div class="ed-acciones"><button class="pa-boton ed-guardar">Guardar y aplicar</button>
        <button class="pa-boton secundario ed-original">Volver a los originales</button><span class="pa-msg ed-estado"></span></div>
    </div>`,
    );
    let pinConfig = "";
    let baseConfig = {};
    function dibujarConfig(datos) {
        baseConfig = datos.base;
        const caja = config.querySelector(".ed-campos");
        caja.innerHTML = Object.keys(datos.base)
            .filter((k) => ["number", "boolean", "string"].includes(typeof datos.base[k]))
            .map((k) => {
                const [texto, reinicio] = PARAMETROS[k] || [k];
                const v = datos.config[k];
                const cambiado = k in datos.local && datos.local[k] !== datos.base[k];
                const etiqueta = `<span>${esc(texto)}${reinicio ? " <b>(reinicio)</b>" : ""}${cambiado ? ' <i class="ed-cambiado">editado</i>' : ""}</span>`;
                if (typeof datos.base[k] === "boolean") {
                    return `<label class="ed-campo ed-check">${etiqueta}<input data-k="${k}" type="checkbox" ${v ? "checked" : ""} /></label>`;
                }
                if (k === "windowMode") {
                    return `<label class="ed-campo">${etiqueta}<select data-k="${k}">${["window", "kiosk"].map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
                }
                const tipo = typeof datos.base[k] === "number" ? 'type="number" step="any"' : 'type="text"';
                return `<label class="ed-campo">${etiqueta}<input data-k="${k}" ${tipo} value="${esc(v)}" /></label>`;
            })
            .join("");
    }
    const pedirPinConfig = prepararPin(config, (pin) => {
        pinConfig = pin;
        api("/admin/config/leer", { pin }).then((d) => {
            dibujarConfig(d);
            config.querySelector(".ed-paso-datos").style.display = "";
        });
    });
    function guardarConfig(cambios) {
        const estado = config.querySelector(".ed-estado");
        estado.className = "pa-msg ed-estado";
        estado.textContent = "Guardando...";
        api("/admin/config", { pin: pinConfig, cambios })
            .then((r) => {
                estado.className = "pa-msg ed-estado ok";
                estado.textContent = r.recargado ? "Guardado. La pantalla se recarga..." : "Guardado. Se aplica al terminar el ganador en curso (o con Ctrl+Shift+R).";
            })
            .catch((e) => {
                estado.className = "pa-msg ed-estado error";
                estado.textContent = "No se guardó: " + e.message;
            });
    }
    config.querySelector(".ed-guardar").addEventListener("click", () => {
        const cambios = {};
        config.querySelectorAll("[data-k]").forEach((i) => (cambios[i.dataset.k] = i.type === "checkbox" ? i.checked : i.value));
        guardarConfig(cambios);
    });
    config.querySelector(".ed-original").addEventListener("click", () => guardarConfig(Object.assign({}, baseConfig)));

    // ---------- abrir / cerrar ----------
    function abrir(panel, alAbrir) {
        document.querySelectorAll(".ed-panel.abierto").forEach((p) => p !== panel && p.classList.remove("abierto"));
        if (panel.classList.contains("abierto")) return panel.classList.remove("abierto");
        panel.querySelectorAll(".ed-paso-datos").forEach((d) => (d.style.display = "none"));
        panel.querySelectorAll(".ed-estado").forEach((s) => (s.textContent = ""));
        panel.classList.add("abierto");
        if (alAbrir) alAbrir();
    }
    window.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyT") {
            e.preventDefault();
            abrir(tema, pedirPinTema);
        } else if (e.ctrlKey && e.shiftKey && e.code === "KeyP") {
            e.preventDefault();
            abrir(config, pedirPinConfig);
        } else if (e.ctrlKey && e.shiftKey && e.code === "KeyH") {
            e.preventDefault();
            abrir(ayuda);
        } else if (e.key === "Escape") {
            if (previa) return terminarPrevia(false);
            if (tema.classList.contains("abierto") && typeof aplicarTema === "function") aplicarTema();
            document.querySelectorAll(".ed-panel.abierto").forEach((p) => p.classList.remove("abierto"));
        }
    });

    // ---------- vista previa de una variante ----------
    function marcarVariantes() {
        tema.querySelectorAll(".ed-var").forEach((b) => b.classList.toggle("sel", variantesSel[b.dataset.vista] === b.dataset.v));
    }
    document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="edPrevia" class="ed-previa"><span class="ed-previa-txt"></span>
      <button class="pa-boton ed-previa-usar">Usar esta</button><button class="pa-boton secundario ed-previa-volver">Volver</button></div>`,
    );
    const barraPrevia = document.getElementById("edPrevia");
    let previa = null; // { vista, v }

    function irAVista(vista) {
        if (typeof switchToSheet !== "function" || typeof SHEETS_DATA === "undefined") return;
        if (vista === "promo") {
            if (typeof window.mostrarPromoAhora === "function") window.mostrarPromoAhora();
            return;
        }
        if (vista === "ganador") {
            if (typeof window.mostrarGanadorDePrueba === "function") window.mostrarGanadorDePrueba();
            return;
        }
        const id = vista.startsWith("home") ? "home" : "minor";
        const idx = SHEETS_DATA.findIndex((s) => s.id === id);
        if (idx >= 0 && idx !== currentSheetIdx) switchToSheet(idx);
        nextChangeTime = performance.now() + 10 * 60 * 1000; // que no cambie de vista mientras se mira
    }
    function terminarPrevia(usar) {
        if (!previa) return;
        if (usar) variantesSel[previa.vista] = previa.v;
        ponerVariante(previa.vista, variantesSel[previa.vista]);
        previa = null;
        barraPrevia.classList.remove("abierto");
        if (typeof window.cerrarGanadorDePrueba === "function") window.cerrarGanadorDePrueba();
        if (typeof getDurationForSheet === "function") nextChangeTime = performance.now() + getDurationForSheet(currentSheetIdx);
        marcarVariantes();
        tema.classList.add("abierto");
    }
    tema.querySelectorAll(".ed-var").forEach((b) =>
        b.addEventListener("click", () => {
            const { vista, v } = b.dataset;
            previa = { vista, v };
            ponerVariante(vista, v);
            const op = VARIANTES[vista].opciones.find((o) => o[0] === v);
            barraPrevia.querySelector(".ed-previa-txt").textContent = "Vista previa: " + VARIANTES[vista].titulo + " - " + op[1];
            tema.classList.remove("abierto");
            barraPrevia.classList.add("abierto");
            irAVista(vista);
        }),
    );
    barraPrevia.querySelector(".ed-previa-usar").addEventListener("click", () => terminarPrevia(true));
    barraPrevia.querySelector(".ed-previa-volver").addEventListener("click", () => terminarPrevia(false));
    // al cerrar el editor sin guardar, vuelve la apariencia guardada
    tema.querySelector(".ed-cerrar").addEventListener("click", () => typeof aplicarTema === "function" && aplicarTema());

    // ---------- iconos: ayuda y sonido ----------
    document.body.insertAdjacentHTML(
        "beforeend",
        `<div class="ed-iconos">
      <button class="ed-icono" id="edBtnAyuda" title="Combinaciones de teclas">?</button>
      <button class="ed-icono" id="edBtnSonido" title="Sonido"></button>
    </div>`,
    );
    document.getElementById("edBtnAyuda").addEventListener("click", () => abrir(ayuda));

    const ICONO_SONIDO =
        '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const ICONO_SILENCIO =
        '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const btnSonido = document.getElementById("edBtnSonido");

    // El silencio se recuerda en este equipo (si el almacenamiento no esta disponible, arranca con sonido)
    try {
        window.SONIDO_SILENCIADO = localStorage.getItem("sonidoSilenciado") === "1";
    } catch (e) {
        window.SONIDO_SILENCIADO = false;
    }
    function aplicarSonido() {
        document.querySelectorAll("audio, video").forEach((m) => {
            // los videos de promo ocultos ya estan silenciados por promos.js: solo se silencia, no se activa
            if (window.SONIDO_SILENCIADO) m.muted = true;
            else if (m.tagName === "AUDIO" || m.classList.contains("showing")) m.muted = false;
        });
        btnSonido.innerHTML = window.SONIDO_SILENCIADO ? ICONO_SILENCIO : ICONO_SONIDO;
        btnSonido.classList.toggle("apagado", window.SONIDO_SILENCIADO);
        btnSonido.title = window.SONIDO_SILENCIADO ? "Activar sonido" : "Silenciar";
    }
    btnSonido.addEventListener("click", () => {
        window.SONIDO_SILENCIADO = !window.SONIDO_SILENCIADO;
        try {
            localStorage.setItem("sonidoSilenciado", window.SONIDO_SILENCIADO ? "1" : "0");
        } catch (e) {}
        aplicarSonido();
    });
    aplicarSonido();
})();
