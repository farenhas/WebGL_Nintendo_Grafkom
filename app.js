"use strict";

document.addEventListener('DOMContentLoaded', () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? window.devicePixelRatio : 2);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    const rectLight = new THREE.RectAreaLight(0xffffff, 1, 5, 5);
    rectLight.position.set(0, 10, 10);
    rectLight.lookAt(0, 0, 0);
    scene.add(rectLight);

    const loader = new THREE.GLTFLoader();
    let model = null; 
    loader.load('./models/nintendo_switch.glb', (gltf) => {
        model = gltf.scene;
        model.scale.set(8, 8, 8);
        model.position.set(0, 0, 0);

        model.traverse((child) => {
            if (child.isMesh && child.name === 'Screen') { // Pastikan nama mesh layar adalah 'Screen'
                screenMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                        lightColor: { value: new THREE.Color(0xffffff) }
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        uniform vec2 resolution;
                        uniform vec3 lightColor;

                        varying vec2 vUv;

                        void main() {
                            float glow = abs(sin(time + vUv.x * 10.0)); // Efek kilauan berbasis waktu dan UV
                            vec3 color = mix(vec3(0.1, 0.1, 0.1), lightColor, glow);
                            gl_FragColor = vec4(color, 1.0);
                        }
                    `,
                });
                child.material = screenMaterial;
            }
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
        camera.position.set(center.x, center.y, cameraZ * 1.5);
        camera.lookAt(center);

        scene.add(model);
    });

    const composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);

    const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(fxaaPass);

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    renderer.domElement.addEventListener('mousedown', () => {
        isDragging = true;
    });

    renderer.domElement.addEventListener('mouseup', () => {
        isDragging = false;
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (isDragging && model) {
            const deltaMove = {
                x: event.offsetX - previousMousePosition.x,
                y: event.offsetY - previousMousePosition.y
            };

            model.rotation.y += deltaMove.x * 0.005; 
            model.rotation.x += deltaMove.y * 0.005; 
        }

        previousMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
    });

    renderer.domElement.addEventListener('wheel', (event) => {
        const zoomSpeed = 0.1;
        const zoomDelta = event.deltaY * zoomSpeed;

        camera.position.z = Math.max(10, Math.min(100, camera.position.z + zoomDelta));
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
        fxaaPass.uniforms['resolution'].value.set(
            1 / window.devicePixelRatio / window.innerWidth,
            1 / window.devicePixelRatio / window.innerHeight
        );
    });

    function animate() {
        requestAnimationFrame(animate);

        composer.render();
    }

    animate();
});

