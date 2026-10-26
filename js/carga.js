// Contador global de carga
(function () {
    let loadedItems = 0;
    let totalItems = 2; // moto + auto F1

    window.__updatePreloader = function () {
        const items = (window.__loadedMoto ? 1 : 0) + (window.__loadedAuto ? 1 : 0);
        const pct = Math.min(100, Math.round((items / totalItems) * 100));

        const txt = document.getElementById("preloaderText");
        const fill = document.getElementById("preloaderProgressFill");
        if (txt) txt.textContent = "CARGANDO... " + pct + "%";
        if (fill) fill.style.width = pct + "%";

        if (pct >= 100) {
            setTimeout(function () {
                const pre = document.getElementById("preloader");
                if (pre) {
                    pre.style.opacity = "0";
                    setTimeout(function () {
                        pre.style.display = "none";
                    }, 500);
                }
            }, 300);
        }
    };

    // Fallback: si el modelo tarda mas de 15s
    setTimeout(function () {
        if (!window.__loadedMoto) {
            window.__loadedMoto = true;
            window.__updatePreloader();
        }
        if (!window.__loadedAuto) {
            window.__loadedAuto = true;
            window.__updatePreloader();
        }
    }, 30000);
})();
