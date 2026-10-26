(function () {
    function initPedestal3D(canvasId, color, emissive) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            setTimeout(() => initPedestal3D(canvasId, color, emissive), 300);
            return;
        }

        const w = canvas.width;
        const h = canvas.height;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        camera.position.set(0, 0.8, 3.5); // mas cerca y un poco mas arriba
        camera.lookAt(0, -0.45, 0); // mira al pedestal (estaba en -0.4)

        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
            powerPreference: "default",
        });
        renderer.setSize(w, h, false);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // hasta retina x2 para mejor calidad
        renderer.setClearColor(0x000000, 0);

        // Luces (iguales que en el generador)
        scene.add(new THREE.AmbientLight(0xffffff, 2.0));
        const keyL = new THREE.DirectionalLight(0xffffff, 2.5);
        keyL.position.set(3, 6, 4);
        scene.add(keyL);
        const fillL = new THREE.DirectionalLight(0xffffff, 1.8);
        fillL.position.set(-4, 2, 2);
        scene.add(fillL);

        // Grupo del pedestal (gira)
        const pedestalGroup = new THREE.Group();

        // 1. Disco principal gris (CylinderGeometry 1.2/1.25/0.03 - REPLICA EXACTA)
        const pedestalMain = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, 0.03, 48), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 }));
        pedestalMain.position.y = -0.46;
        pedestalGroup.add(pedestalMain);

        // 2. Anillo dorado/turquesa (TorusGeometry 1.2/0.025 - REPLICA EXACTA)
        const pedestalRing = new THREE.Mesh(
            new THREE.TorusGeometry(1.2, 0.025, 10, 48),
            new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.95,
                roughness: 0.15,
                emissive: emissive,
                emissiveIntensity: 0.3,
            }),
        );
        pedestalRing.position.y = -0.44;
        pedestalRing.rotation.x = Math.PI / 2;
        pedestalGroup.add(pedestalRing);

        // 3. Anillo interior brillante (RingGeometry 0.7/0.85 - REPLICA EXACTA)
        const pedestalInnerRing = new THREE.Mesh(
            new THREE.RingGeometry(0.7, 0.85, 48),
            new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide,
            }),
        );
        pedestalInnerRing.position.y = -0.42;
        pedestalInnerRing.rotation.x = -Math.PI / 2;
        pedestalGroup.add(pedestalInnerRing);

        // 4. Disco superior oscuro brillante (CylinderGeometry 1.15/1.15/0.015 - REPLICA EXACTA)
        const pedestalTop = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.015, 48), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }));
        pedestalTop.position.y = -0.43;
        pedestalGroup.add(pedestalTop);

        scene.add(pedestalGroup);

        console.log("[PEDESTAL 3D] Iniciado:", canvasId);

        // Loop - DORMIR cuando no es activo (ahorra GPU)
        function animate() {
            const targetId = canvasId === "motoPedestal3D" ? "major" : "grand";
            const activeSheet = document.querySelector(".sheet.active");
            const isActive = activeSheet && activeSheet.dataset.id === targetId;

            if (!isActive) {
                // Dormir 500ms cuando no es activo
                setTimeout(animate, 500);
                return;
            }

            // Activo: rotar pedestal lentamente a 30fps
            pedestalGroup.rotation.y += 0.008;
            renderer.render(scene, camera);

            setTimeout(() => requestAnimationFrame(animate), 33);
        }

        animate();
    }

    // Iniciar ambos pedestales con delay
    setTimeout(() => {
        initPedestal3D("motoPedestal3D", 0xffaa00, 0x442200); // dorado
        initPedestal3D("autoPedestal3D", 0x00e5d4, 0x004442); // turquesa
    }, 2500); // delay para que arranque DESPUES de cargar todo lo demas
})();
