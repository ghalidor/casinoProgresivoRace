(function () {
    // 36 frames en grid 6x6
    const FRAMES = 36;
    const COLS = 6;
    const ROWS = 6;

    function getFramePosition(frame) {
        const col = frame % COLS;
        const row = Math.floor(frame / COLS);
        // Porcentajes: cada paso = 100/(N-1) %
        // col 0 = 0%, col 5 = 100%
        const xPct = (col / (COLS - 1)) * 100;
        const yPct = (row / (ROWS - 1)) * 100;
        return xPct + "% " + yPct + "%";
    }

    let motoFrame = 0;
    let autoFrame = 0;

    function animate() {
        const activeSheet = document.querySelector(".sheet.active");
        if (!activeSheet) {
            setTimeout(animate, 500);
            return;
        }

        const sheetId = activeSheet.dataset.id;

        if (sheetId === "major") {
            const sprite = document.getElementById("motoSprite");
            if (sprite) {
                motoFrame = (motoFrame + 1) % FRAMES;
                sprite.style.backgroundPosition = getFramePosition(motoFrame);
            }
        } else if (sheetId === "grand") {
            const sprite = document.getElementById("autoSprite");
            if (sprite) {
                autoFrame = (autoFrame + 1) % FRAMES;
                sprite.style.backgroundPosition = getFramePosition(autoFrame);
            }
        }

        // Si no es major/grand, dormir mas tiempo (no hace nada)
        if (sheetId === "major" || sheetId === "grand") {
            // ~12fps (cada 80ms) - suficiente para rotacion fluida, casi 0% GPU
            setTimeout(animate, 80);
        } else {
            setTimeout(animate, 500);
        }
    }

    // Verificar que las imagenes existen antes de animar
    function checkSprites() {
        const motoImg = new Image();
        motoImg.onload = () => console.log("[SPRITES] OK moto_sprite.png cargo:", motoImg.width + "x" + motoImg.height);
        motoImg.onerror = () => console.error("[SPRITES] FALLO cargar moto_sprite.png - verificar que el archivo este en la carpeta img/");
        motoImg.src = "img/moto_sprite.png";

        const autoImg = new Image();
        autoImg.onload = () => console.log("[SPRITES] OK auto_sprite.png cargo:", autoImg.width + "x" + autoImg.height);
        autoImg.onerror = () => console.error("[SPRITES] FALLO cargar auto_sprite.png");
        autoImg.src = "img/auto_sprite.png";

        // Tambien verificar que los divs existen
        const motoDiv = document.getElementById("motoSprite");
        const autoDiv = document.getElementById("autoSprite");
        console.log("[SPRITES] motoDiv existe:", !!motoDiv);
        console.log("[SPRITES] autoDiv existe:", !!autoDiv);

        if (motoDiv) {
            const cs = window.getComputedStyle(motoDiv);
            console.log("[SPRITES] motoDiv computed:");
            console.log("  width:", cs.width, "height:", cs.height);
            console.log("  background-image:", cs.backgroundImage);
            console.log("  background-size:", cs.backgroundSize);
            console.log("  display:", cs.display);
        }
    }

    setTimeout(checkSprites, 1000);
    setTimeout(animate, 1500);
    console.log("[SPRITES] Animador iniciado");
})();
