/**
 * TORQUEGUARD 3D - Three.js Digital Twin Scene Architecture
 * Procedurally generates realistic industrial conveyor cell with DC motor, cooling fins,
 * gearbox, optical encoder, ACS712 current transducer, PT100 RTD temp sensor,
 * stack light, parcels, jam wedge, and thermal infrared FLIR mode.
 */

class ConveyorDigitalTwinScene {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;

        // 3D Animated Components
        this.beltMesh = null;
        this.beltTexture = null;
        this.driveRoller = null;
        this.tailRoller = null;
        this.motorBody = null;
        this.motorShaft = null;
        this.motorFan = null;
        this.gearboxShaft = null;
        this.encoderDisc = null;
        this.encoderLed = null;
        this.currentSensorLed = null;
        this.tempSensorProbe = null;
        this.jamObstruction = null;

        // Andon Stack Light Lenses
        this.lightGreen = null;
        this.lightAmber = null;
        this.lightRed = null;

        // Boxes on conveyor
        this.boxes = [];
        this.jammedBox = null;

        // Smoke / steam particles for dangerous overheat
        this.smokeParticles = null;

        // Thermal FLIR Mode
        this.isThermalMode = false;
        this.originalMaterials = new Map();

        // 3D Callout annotations
        this.callouts = [];
        this.showCallouts = true;

        // Camera Animation
        this.targetCameraPos = null;
        this.targetLookAt = null;

        this.init();
    }

    init() {
        // 1. Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e1726); // Industrial dark slate
        this.scene.fog = new THREE.FogExp2(0x0e1726, 0.035);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.set(4.2, 3.2, 5.0);

        // 3. Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // 4. OrbitControls
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below floor
            this.controls.minDistance = 1.2;
            this.controls.maxDistance = 12.0;
            this.controls.target.set(0, 0.8, 0);
        }

        // 5. Lighting
        this.setupLighting();

        // 6. Build Factory Environment
        this.buildFloorGrid();

        // 7. Build Conveyor Assembly & Actuator Cell
        this.buildConveyorChassis();
        this.buildRollers();
        this.buildConveyorBelt();
        this.buildMotorAndGearbox();
        this.buildOpticalEncoder();
        this.buildCurrentTransducer();
        this.buildTemperatureSensor();
        this.buildElectricalCabinet();
        this.buildCargoBoxes();
        this.buildJamObstruction();
        this.buildSmokeSystem();

        // 8. Resize Listener
        window.addEventListener('resize', () => this.onResize());

        console.log("[Scene] 3D Digital Twin Conveyor Actuator Cell Loaded");
    }

    setupLighting() {
        // Ambient shop floor illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);

        // Key industrial overhead worklight
        const mainWorkLight = new THREE.DirectionalLight(0xfff8ee, 0.95);
        mainWorkLight.position.set(5, 7, 4);
        mainWorkLight.castShadow = true;
        mainWorkLight.shadow.mapSize.width = 2048;
        mainWorkLight.shadow.mapSize.height = 2048;
        mainWorkLight.shadow.camera.near = 0.5;
        mainWorkLight.shadow.camera.far = 18;
        mainWorkLight.shadow.camera.left = -4;
        mainWorkLight.shadow.camera.right = 4;
        mainWorkLight.shadow.camera.top = 4;
        mainWorkLight.shadow.camera.bottom = -4;
        mainWorkLight.shadow.bias = -0.0005;
        this.scene.add(mainWorkLight);

        // Cyan accent rim light from opposite angle
        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
        rimLight.position.set(-5, 4, -4);
        this.scene.add(rimLight);

        // Motor inspection spotlight
        const motorSpot = new THREE.PointLight(0x60a5fa, 0.8, 4.5);
        motorSpot.position.set(-2.0, 1.4, 0.9);
        this.scene.add(motorSpot);
    }

    buildFloorGrid() {
        // Industrial concrete floor with epoxy coating
        const floorGeo = new THREE.PlaneGeometry(24, 24);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.65,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Technical SCADA grid overlay
        const grid = new THREE.GridHelper(20, 40, 0x0284c7, 0x1e293b);
        grid.position.y = 0.005;
        this.scene.add(grid);

        // Floor safety yellow perimeter markings
        this.createSafetyZoneMarkings();
    }

    createSafetyZoneMarkings() {
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const createStripe = (w, h, x, z) => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(x, 0.008, z);
            this.scene.add(mesh);
        };
        // Safety border around conveyor cell
        createStripe(4.4, 0.06, 0, 1.4);
        createStripe(4.4, 0.06, 0, -1.4);
        createStripe(0.06, 2.8, -2.2, 0);
        createStripe(0.06, 2.8, 2.2, 0);
    }

    buildConveyorChassis() {
        const frameGroup = new THREE.Group();

        // Material for anodized aluminum profile
        const alumMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            metalness: 0.8,
            roughness: 0.35
        });

        const darkMetalMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.9,
            roughness: 0.4
        });

        // 1. Longitudinal Aluminum T-Slot Beams (Side Extrusions)
        const beamGeo = new THREE.BoxGeometry(3.6, 0.12, 0.06);
        const frontBeam = new THREE.Mesh(beamGeo, alumMat);
        frontBeam.position.set(0, 0.85, 0.35);
        frontBeam.castShadow = true;
        frontBeam.receiveShadow = true;
        frameGroup.add(frontBeam);

        const rearBeam = new THREE.Mesh(beamGeo, alumMat);
        rearBeam.position.set(0, 0.85, -0.35);
        rearBeam.castShadow = true;
        rearBeam.receiveShadow = true;
        frameGroup.add(rearBeam);

        // Hazard chevron side tape on side beams
        const hazardCanvas = document.createElement('canvas');
        hazardCanvas.width = 512;
        hazardCanvas.height = 32;
        const hctx = hazardCanvas.getContext('2d');
        hctx.fillStyle = '#facc15';
        hctx.fillRect(0, 0, 512, 32);
        hctx.fillStyle = '#18181b';
        for (let i = 0; i < 512; i += 32) {
            hctx.beginPath();
            hctx.moveTo(i, 0);
            hctx.lineTo(i + 16, 0);
            hctx.lineTo(i, 32);
            hctx.fill();
        }
        const hazardTex = new THREE.CanvasTexture(hazardCanvas);
        hazardTex.wrapS = THREE.RepeatWrapping;
        hazardTex.repeat.set(4, 1);
        const hazardMat = new THREE.MeshBasicMaterial({ map: hazardTex });

        const hazardStripeFront = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 0.08), hazardMat);
        hazardStripeFront.position.set(0, 0.85, 0.385);
        frameGroup.add(hazardStripeFront);

        // 2. Stainless Steel Slider Deck (under belt)
        const deckGeo = new THREE.BoxGeometry(3.2, 0.02, 0.64);
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
        const deck = new THREE.Mesh(deckGeo, deckMat);
        deck.position.set(0, 0.89, 0);
        deck.receiveShadow = true;
        frameGroup.add(deck);

        // 3. Side Guide Rails (prevents boxes slipping off)
        const railGeo = new THREE.BoxGeometry(3.4, 0.08, 0.02);
        const frontRail = new THREE.Mesh(railGeo, darkMetalMat);
        frontRail.position.set(0, 0.97, 0.33);
        frameGroup.add(frontRail);

        const rearRail = new THREE.Mesh(railGeo, darkMetalMat);
        rearRail.position.set(0, 0.97, -0.33);
        frameGroup.add(rearRail);

        // 4. Support Legs with Foot Plates
        const legPositions = [
            [-1.5, 0.42, 0.32],
            [-1.5, 0.42, -0.32],
            [0, 0.42, 0.32],
            [0, 0.42, -0.32],
            [1.5, 0.42, 0.32],
            [1.5, 0.42, -0.32]
        ];

        const legGeo = new THREE.BoxGeometry(0.08, 0.84, 0.08);
        const footGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.03, 16);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, alumMat);
            leg.position.set(pos[0], pos[1], pos[2]);
            leg.castShadow = true;
            frameGroup.add(leg);

            const foot = new THREE.Mesh(footGeo, footMat);
            foot.position.set(pos[0], 0.015, pos[2]);
            frameGroup.add(foot);
        });

        // 5. Cross Braces
        [-1.5, 0, 1.5].forEach(x => {
            const brace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), alumMat);
            brace.position.set(x, 0.3, 0);
            frameGroup.add(brace);
        });

        this.scene.add(frameGroup);
    }

    buildRollers() {
        const rollerMat = new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            metalness: 0.9,
            roughness: 0.25
        });

        const bearingMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.7,
            roughness: 0.5
        });

        // Drive Roller (Head Pulley at Left: x = -1.6)
        const rollerGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.66, 32);
        this.driveRoller = new THREE.Mesh(rollerGeo, rollerMat);
        this.driveRoller.rotation.x = Math.PI / 2;
        this.driveRoller.position.set(-1.6, 0.88, 0);
        this.driveRoller.castShadow = true;
        this.scene.add(this.driveRoller);

        // Pillow block bearing housings for Drive Roller
        [-0.37, 0.37].forEach(z => {
            const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), bearingMat);
            bearing.position.set(-1.6, 0.88, z);
            this.scene.add(bearing);
        });

        // Tail Roller (Idler Pulley at Right: x = 1.6)
        this.tailRoller = new THREE.Mesh(rollerGeo, rollerMat);
        this.tailRoller.rotation.x = Math.PI / 2;
        this.tailRoller.position.set(1.6, 0.88, 0);
        this.tailRoller.castShadow = true;
        this.scene.add(this.tailRoller);

        // Pillow block bearings for Tail Roller
        [-0.37, 0.37].forEach(z => {
            const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), bearingMat);
            bearing.position.set(1.6, 0.88, z);
            this.scene.add(bearing);
        });

        // Intermediate underside return snub rollers
        [-0.8, 0.8].forEach(x => {
            const snubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.64, 16);
            const snub = new THREE.Mesh(snubGeo, rollerMat);
            snub.rotation.x = Math.PI / 2;
            snub.position.set(x, 0.76, 0);
            this.scene.add(snub);
        });
    }

    buildConveyorBelt() {
        // High-resolution procedural canvas texture for conveyor rubber belt
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Dark matte rubber base
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, 1024, 512);

        // Grip texture lines
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 4;
        for (let x = 0; x < 1024; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 512);
            ctx.stroke();
        }

        // Heavy industrial center tracking seam & chevron marks
        ctx.strokeStyle = '#44403c';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 240, 1024, 32);

        // Warning tracking tick marks on border
        ctx.fillStyle = '#eab308';
        for (let x = 0; x < 1024; x += 64) {
            ctx.fillRect(x, 15, 12, 8);
            ctx.fillRect(x, 489, 12, 8);
        }

        this.beltTexture = new THREE.CanvasTexture(canvas);
        this.beltTexture.wrapS = THREE.RepeatWrapping;
        this.beltTexture.wrapT = THREE.RepeatWrapping;
        this.beltTexture.repeat.set(3, 1);

        const beltMat = new THREE.MeshStandardMaterial({
            map: this.beltTexture,
            roughness: 0.8,
            metalness: 0.1
        });

        // Top belt flight (carrying surface)
        const topBeltGeo = new THREE.PlaneGeometry(3.2, 0.64);
        const topBelt = new THREE.Mesh(topBeltGeo, beltMat);
        topBelt.rotation.x = -Math.PI / 2;
        topBelt.position.set(0, 0.982, 0);
        topBelt.receiveShadow = true;
        this.scene.add(topBelt);

        // Bottom return belt flight
        const botBelt = new THREE.Mesh(topBeltGeo, beltMat);
        botBelt.rotation.x = Math.PI / 2;
        botBelt.position.set(0, 0.778, 0);
        this.scene.add(botBelt);

        // Curved end caps around rollers
        const curveGeo = new THREE.CylinderGeometry(0.102, 0.102, 0.64, 32, 1, true, 0, Math.PI);
        const leftCurve = new THREE.Mesh(curveGeo, beltMat);
        leftCurve.rotation.z = Math.PI / 2;
        leftCurve.position.set(-1.6, 0.88, 0);
        this.scene.add(leftCurve);

        const rightCurve = new THREE.Mesh(curveGeo, beltMat);
        rightCurve.rotation.z = -Math.PI / 2;
        rightCurve.position.set(1.6, 0.88, 0);
        this.scene.add(rightCurve);

        this.beltMesh = topBelt; // primary reference for texture animation
    }

    buildMotorAndGearbox() {
        const driveGroup = new THREE.Group();
        driveGroup.position.set(-1.6, 0.88, 0.72); // Mounted beside drive roller

        // 1. Heavy Reduction Gearbox Housing (15:1 Planetary/Worm)
        const gearboxGeo = new THREE.BoxGeometry(0.32, 0.32, 0.28);
        const gearboxMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.8,
            roughness: 0.4
        });
        const gearbox = new THREE.Mesh(gearboxGeo, gearboxMat);
        gearbox.position.set(0, 0, -0.22);
        gearbox.castShadow = true;
        driveGroup.add(gearbox);

        // Output Shaft connecting gearbox to drive roller
        const outShaftGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.26, 24);
        const shaftMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
        this.gearboxShaft = new THREE.Mesh(outShaftGeo, shaftMat);
        this.gearboxShaft.rotation.x = Math.PI / 2;
        this.gearboxShaft.position.set(0, 0, -0.42);
        driveGroup.add(this.gearboxShaft);

        // Flexible Spider / Jaw Coupling
        const couplingGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.08, 20);
        const couplingMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6, roughness: 0.3 });
        const coupling = new THREE.Mesh(couplingGeo, couplingMat);
        coupling.rotation.x = Math.PI / 2;
        coupling.position.set(0, 0, -0.42);
        driveGroup.add(coupling);

        // 2. 24V DC Industrial Motor Body
        // Stator cylindrical core
        const motorStatorGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.38, 32);
        this.motorThermalMat = new THREE.MeshStandardMaterial({
            color: 0x1e3a5f, // Industrial motor blue
            metalness: 0.6,
            roughness: 0.45,
            emissive: 0x000000,
            emissiveIntensity: 0.0
        });
        this.motorBody = new THREE.Mesh(motorStatorGeo, this.motorThermalMat);
        this.motorBody.rotation.x = Math.PI / 2;
        this.motorBody.position.set(0, 0, 0.14);
        this.motorBody.castShadow = true;
        driveGroup.add(this.motorBody);

        // Longitudinal Stator Heat Dissipation Fins (12 radial fins)
        const finGeo = new THREE.BoxGeometry(0.015, 0.035, 0.36);
        const finMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.35 });
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.position.set(Math.cos(angle) * 0.142, Math.sin(angle) * 0.142, 0.14);
            fin.rotation.z = angle;
            driveGroup.add(fin);
        }

        // Terminal Conduit Junction Box on top of motor
        const jboxGeo = new THREE.BoxGeometry(0.12, 0.09, 0.14);
        const jboxMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 });
        const jbox = new THREE.Mesh(jboxGeo, jboxMat);
        jbox.position.set(0, 0.17, 0.14);
        driveGroup.add(jbox);

        // Industrial cable gland & conduit
        const glandGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.05, 12);
        const glandMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        const gland = new THREE.Mesh(glandGeo, glandMat);
        gland.rotation.z = Math.PI / 2;
        gland.position.set(0.07, 0.17, 0.14);
        driveGroup.add(gland);

        // Rear Fan Shroud Cowl with ventilation slots
        const fanCowlGeo = new THREE.CylinderGeometry(0.132, 0.132, 0.1, 32);
        const fanCowlMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.5 });
        const fanCowl = new THREE.Mesh(fanCowlGeo, fanCowlMat);
        fanCowl.rotation.x = Math.PI / 2;
        fanCowl.position.set(0, 0, 0.38);
        driveGroup.add(fanCowl);

        // Internal Cooling Fan Blades (rotates inside cowl)
        const fanGroup = new THREE.Group();
        fanGroup.position.set(0, 0, 0.38);
        const bladeGeo = new THREE.BoxGeometry(0.11, 0.02, 0.01);
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
        for (let b = 0; b < 6; b++) {
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            blade.rotation.z = (b / 6) * Math.PI * 2;
            fanGroup.add(blade);
        }
        this.motorFan = fanGroup;
        driveGroup.add(this.motorFan);

        // Motor Mounting Bracket to Conveyor Frame
        const bracketGeo = new THREE.BoxGeometry(0.35, 0.45, 0.04);
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(0, -0.15, -0.05);
        driveGroup.add(bracket);

        this.scene.add(driveGroup);
        this.driveGroup = driveGroup;
    }

    buildOpticalEncoder() {
        // Mounted on rear shaft extension of motor (z = 0.48 relative to motor)
        const encGroup = new THREE.Group();
        encGroup.position.set(-1.6, 0.88, 1.22); // Rear of motor assembly

        // Aluminum Encoder Housing (Omron style)
        const encGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.11, 32);
        const encMat = new THREE.MeshStandardMaterial({
            color: 0x0f766e, // Teal industrial sensor body
            metalness: 0.7,
            roughness: 0.3
        });
        const encHousing = new THREE.Mesh(encGeo, encMat);
        encHousing.rotation.x = Math.PI / 2;
        encGroup.add(encHousing);

        // Transparent inspection window showing slotted disc
        const winGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 24);
        const winMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            roughness: 0.1,
            transmission: 0.8
        });
        const encWin = new THREE.Mesh(winGeo, winMat);
        encWin.rotation.x = Math.PI / 2;
        encWin.position.set(0, 0, 0.058);
        encGroup.add(encWin);

        // Internal Slotted Optical Disc (rotates!)
        const discGeo = new THREE.RingGeometry(0.015, 0.046, 32);
        const discMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide });
        this.encoderDisc = new THREE.Mesh(discGeo, discMat);
        this.encoderDisc.position.set(0, 0, 0.054);
        encGroup.add(this.encoderDisc);

        // Encoder Diagnostic Status LED (Pulses with ticks)
        const ledGeo = new THREE.SphereGeometry(0.01, 16, 16);
        this.encoderLedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        this.encoderLed = new THREE.Mesh(ledGeo, this.encoderLedMat);
        this.encoderLed.position.set(0.04, 0.04, 0.056);
        encGroup.add(this.encoderLed);

        // Shielded signal cable to cabinet
        const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.45, 12);
        const cableMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.set(0.04, -0.15, 0);
        encGroup.add(cable);

        this.scene.add(encGroup);
        this.encGroup = encGroup;
    }

    buildCurrentTransducer() {
        // Hall-Effect ACS712 Current Sensor Enclosure
        const sensorGroup = new THREE.Group();
        sensorGroup.position.set(-1.3, 0.75, 0.5);

        // DIN-rail clear polycarbonate mounting box
        const boxGeo = new THREE.BoxGeometry(0.18, 0.12, 0.09);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.4,
            roughness: 0.6
        });
        const box = new THREE.Mesh(boxGeo, boxMat);
        sensorGroup.add(box);

        // Heavy copper screw terminal blocks (In / Out busbars)
        const lugMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.9, roughness: 0.2 });
        [-0.06, 0.06].forEach(x => {
            const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.04, 16), lugMat);
            lug.position.set(x, 0.065, 0);
            sensorGroup.add(lug);
        });

        // Current Intensity Glow LED (brighter when current spikes)
        const ledGeo = new THREE.SphereGeometry(0.012, 16, 16);
        this.currentLedMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        this.currentSensorLed = new THREE.Mesh(ledGeo, this.currentLedMat);
        this.currentSensorLed.position.set(0, 0.04, 0.047);
        sensorGroup.add(this.currentSensorLed);

        // Sensor point light
        this.currentPointLight = new THREE.PointLight(0x06b6d4, 0.2, 0.8);
        this.currentPointLight.position.set(0, 0.05, 0.06);
        sensorGroup.add(this.currentPointLight);

        this.scene.add(sensorGroup);
    }

    buildTemperatureSensor() {
        // PT100 RTD Stainless Steel Thermowell screwed into motor stator
        const tempGroup = new THREE.Group();
        tempGroup.position.set(-1.6, 1.05, 0.86); // Directly on motor top

        // Threaded hex fitting & probe shank
        const probeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.08, 16);
        const probeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
        this.tempSensorProbe = new THREE.Mesh(probeGeo, probeMat);
        tempGroup.add(this.tempSensorProbe);

        // Hex brass collar
        const hexGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6);
        const hexMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 });
        const hex = new THREE.Mesh(hexGeo, hexMat);
        hex.position.set(0, -0.02, 0);
        tempGroup.add(hex);

        // Braided high-temp lead cable
        const wireGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.35, 12);
        const wireMat = new THREE.MeshStandardMaterial({ color: 0xe11d48 }); // High temp silicone red
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.rotation.z = Math.PI / 4;
        wire.position.set(0.12, 0.08, 0);
        tempGroup.add(wire);

        this.scene.add(tempGroup);
    }

    buildElectricalCabinet() {
        const cabGroup = new THREE.Group();
        cabGroup.position.set(-2.0, 0, -1.0); // Placed next to conveyor

        // 1. Rittal-style Enclosure Body (RAL 7035 Light Industrial Gray)
        const cabGeo = new THREE.BoxGeometry(0.65, 1.45, 0.42);
        const cabMat = new THREE.MeshStandardMaterial({
            color: 0xd1d5db,
            metalness: 0.6,
            roughness: 0.4
        });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        cab.position.set(0, 0.725, 0);
        cab.castShadow = true;
        cab.receiveShadow = true;
        cabGroup.add(cab);

        // Black Plinth / Base
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.44), new THREE.MeshStandardMaterial({ color: 0x111827 }));
        plinth.position.set(0, 0.04, 0);
        cabGroup.add(plinth);

        // Rotary Main Disconnect Switch Handle (Red/Yellow Safety Latch)
        const switchBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        switchBase.rotation.x = Math.PI / 2;
        switchBase.position.set(0.18, 1.05, 0.22);
        cabGroup.add(switchBase);

        const switchKnob = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
        switchKnob.position.set(0.18, 1.05, 0.24);
        cabGroup.add(switchKnob);

        // Siemens S7-1200 Style PLC Acrylic Inspection Window
        const winGeo = new THREE.PlaneGeometry(0.42, 0.45);
        const winMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
        const plcWin = new THREE.Mesh(winGeo, winMat);
        plcWin.position.set(-0.06, 0.85, 0.215);
        cabGroup.add(plcWin);

        // Blinking PLC Status LEDs
        this.plcLeds = [];
        for (let i = 0; i < 6; i++) {
            const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 12), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
            led.position.set(-0.2 + i * 0.045, 0.98, 0.22);
            cabGroup.add(led);
            this.plcLeds.push(led);
        }

        // 2. 3-Tier Andon Signal Tower (Stack Light) on top of cabinet
        const towerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
        towerPole.position.set(0, 1.65, 0);
        cabGroup.add(towerPole);

        // Acoustic Buzzer Horn atop tower
        const hornGeo = new THREE.ConeGeometry(0.045, 0.06, 16);
        const horn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a }));
        horn.position.set(0, 2.12, 0);
        cabGroup.add(horn);

        // Lenses: Red (top), Amber (mid), Green (bottom)
        const lensGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.065, 20);

        // Red Lens
        this.lightRedMat = new THREE.MeshStandardMaterial({
            color: 0x450a0a,
            emissive: 0x000000,
            roughness: 0.2,
            metalness: 0.1
        });
        this.lightRed = new THREE.Mesh(lensGeo, this.lightRedMat);
        this.lightRed.position.set(0, 2.03, 0);
        cabGroup.add(this.lightRed);

        // Amber Lens
        this.lightAmberMat = new THREE.MeshStandardMaterial({
            color: 0x451a03,
            emissive: 0x000000,
            roughness: 0.2,
            metalness: 0.1
        });
        this.lightAmber = new THREE.Mesh(lensGeo, this.lightAmberMat);
        this.lightAmber.position.set(0, 1.94, 0);
        cabGroup.add(this.lightAmber);

        // Green Lens (Default ON)
        this.lightGreenMat = new THREE.MeshStandardMaterial({
            color: 0x052e16,
            emissive: 0x22c55e,
            emissiveIntensity: 0.8,
            roughness: 0.2,
            metalness: 0.1
        });
        this.lightGreen = new THREE.Mesh(lensGeo, this.lightGreenMat);
        this.lightGreen.position.set(0, 1.85, 0);
        cabGroup.add(this.lightGreen);

        // Tower point light
        this.towerPointLight = new THREE.PointLight(0x22c55e, 0.8, 3.0);
        this.towerPointLight.position.set(0, 1.95, 0.2);
        cabGroup.add(this.towerPointLight);

        this.scene.add(cabGroup);
    }

    buildCargoBoxes() {
        this.boxesGroup = new THREE.Group();

        // Canvas texture for cardboard packaging box with barcode & shipping label
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#b48a56'; // Kraft cardboard brown
        ctx.fillRect(0, 0, 256, 256);

        // Brown shipping tape across top
        ctx.fillStyle = '#8d6837';
        ctx.fillRect(0, 115, 256, 26);

        // White shipping label with barcode
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(30, 30, 95, 65);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('FRAGILE', 35, 45);
        ctx.fillText('ACTUATOR-X', 35, 57);
        // Barcode lines
        for (let b = 35; b < 115; b += 5) {
            ctx.fillRect(b, 65, Math.random() > 0.4 ? 3 : 1, 20);
        }

        // Heavy parcel symbol
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(170, 35, 45, 45);
        ctx.fillText('THIS WAY UP', 160, 95);

        const boxTex = new THREE.CanvasTexture(canvas);
        const boxMat = new THREE.MeshStandardMaterial({
            map: boxTex,
            roughness: 0.9,
            metalness: 0.05
        });

        // Create 4 moving cargo boxes staggered along conveyor length
        const boxSizes = [
            { w: 0.32, h: 0.26, d: 0.30, x: -1.0 },
            { w: 0.36, h: 0.28, d: 0.32, x: -0.2 },
            { w: 0.28, h: 0.24, d: 0.28, x: 0.6 },
            { w: 0.34, h: 0.27, d: 0.30, x: 1.4 }
        ];

        boxSizes.forEach((cfg, idx) => {
            const geo = new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d);
            const box = new THREE.Mesh(geo, boxMat);
            box.position.set(cfg.x, 0.982 + cfg.h / 2, (Math.random() - 0.5) * 0.08);
            box.castShadow = true;
            box.receiveShadow = true;
            box.userData = {
                initialX: cfg.x,
                speedMultiplier: 1.0,
                heightOffset: cfg.h / 2,
                index: idx
            };
            this.boxesGroup.add(box);
            this.boxes.push(box);
        });

        this.scene.add(this.boxesGroup);
        // Designate box #0 as the one that can jam near the left drive roller
        this.jammedBox = this.boxes[0];
    }

    buildJamObstruction() {
        // Heavy steel mechanical obstruction block / wedge that drops at pinch point (x = -1.35)
        const jamGroup = new THREE.Group();
        jamGroup.position.set(-1.38, 1.05, 0.16);

        // Solid forged steel wedge
        const wedgeGeo = new THREE.BoxGeometry(0.12, 0.16, 0.24);
        const wedgeMat = new THREE.MeshStandardMaterial({
            color: 0xef4444, // Red safety hazard wedge
            metalness: 0.9,
            roughness: 0.2
        });
        const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
        wedge.rotation.y = Math.PI / 6;
        wedge.castShadow = true;
        jamGroup.add(wedge);

        // Warning striped tag
        const tagGeo = new THREE.BoxGeometry(0.04, 0.08, 0.08);
        const tag = new THREE.Mesh(tagGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
        tag.position.set(0, 0.12, 0);
        jamGroup.add(tag);

        this.jamObstruction = jamGroup;
        this.jamObstruction.visible = false; // Hidden in normal state
        this.scene.add(this.jamObstruction);
    }

    buildSmokeSystem() {
        // Particle system for motor overheating smoke puffs
        const particleCount = 40;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3 + 0] = -1.6 + (Math.random() - 0.5) * 0.2;
            positions[i * 3 + 1] = 1.05 + Math.random() * 0.1;
            positions[i * 3 + 2] = 0.88 + (Math.random() - 0.5) * 0.2;

            velocities.push({
                x: (Math.random() - 0.5) * 0.05,
                y: 0.15 + Math.random() * 0.2,
                z: (Math.random() - 0.5) * 0.05,
                life: Math.random()
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0x9ca3af,
            size: 0.12,
            transparent: true,
            opacity: 0.0,
            depthWrite: false
        });

        this.smokeParticles = new THREE.Points(geo, mat);
        this.smokeVelocities = velocities;
        this.scene.add(this.smokeParticles);
    }

    /**
     * Updates Stack Light (Andon Tower) depending on state
     */
    updateStackLight(state) {
        const time = Date.now() * 0.005;

        // Reset lenses
        this.lightGreenMat.emissive.setHex(0x000000);
        this.lightAmberMat.emissive.setHex(0x000000);
        this.lightRedMat.emissive.setHex(0x000000);

        switch (state) {
            case 'NORMAL':
                this.lightGreenMat.emissive.setHex(0x22c55e);
                this.lightGreenMat.emissiveIntensity = 0.9;
                this.towerPointLight.color.setHex(0x22c55e);
                this.towerPointLight.intensity = 0.8;
                break;

            case 'SUSPECT':
                this.lightAmberMat.emissive.setHex(0xf59e0b);
                this.lightAmberMat.emissiveIntensity = 0.9;
                this.towerPointLight.color.setHex(0xf59e0b);
                this.towerPointLight.intensity = 0.8;
                break;

            case 'STALL':
                // Rapid flashing amber/orange
                const stallFlash = Math.sin(time * 3) > 0;
                this.lightAmberMat.emissive.setHex(stallFlash ? 0xf97316 : 0x000000);
                this.lightAmberMat.emissiveIntensity = 1.0;
                this.towerPointLight.color.setHex(0xf97316);
                this.towerPointLight.intensity = stallFlash ? 1.0 : 0.2;
                break;

            case 'RECOVERY':
                // Steady Amber + Green alternating (maintenance/recovery)
                const recFlash = Math.sin(time * 2) > 0;
                if (recFlash) {
                    this.lightAmberMat.emissive.setHex(0x3b82f6); // Blue recovery pulse
                } else {
                    this.lightGreenMat.emissive.setHex(0x22c55e);
                }
                this.towerPointLight.color.setHex(0x3b82f6);
                this.towerPointLight.intensity = 0.8;
                break;

            case 'LOCKOUT':
            case 'ESTOP':
                // Emergency high-intensity red strobe flash
                const redFlash = Math.sin(time * 5) > 0;
                this.lightRedMat.emissive.setHex(redFlash ? 0xef4444 : 0x300000);
                this.lightRedMat.emissiveIntensity = redFlash ? 1.5 : 0.1;
                this.towerPointLight.color.setHex(0xef4444);
                this.towerPointLight.intensity = redFlash ? 1.4 : 0.1;
                break;
        }
    }

    /**
     * Primary Animation Loop (Run every frame)
     */
    animate(dt, physics, stateMachine) {
        const rpm = physics.rpm;
        const current = physics.rawCurrent;
        const temp = physics.temperature;
        const isJammed = physics.isJammed;
        const state = stateMachine.state;

        // 1. Conveyor Belt UV scroll animation based on real RPM
        if (this.beltTexture && Math.abs(rpm) > 0.1) {
            // Negative sign moves parcels toward left drive roller
            const uvDelta = (rpm / 60.0) * dt * 0.45;
            this.beltTexture.offset.x -= uvDelta;
        }

        // 2. Roller Rotation
        if (this.driveRoller && this.tailRoller) {
            const rotDelta = (rpm * (2 * Math.PI / 60.0)) * dt;
            this.driveRoller.rotation.y += rotDelta;
            this.tailRoller.rotation.y += rotDelta;
        }

        // 3. Motor Shaft & Internal Cooling Fan Rotation
        if (this.motorFan && Math.abs(rpm) > 0.1) {
            const motorRotDelta = (rpm * 15.0 * (2 * Math.PI / 60.0)) * dt;
            this.motorFan.rotation.z += motorRotDelta;
        }

        // 4. Optical Encoder Disc & LED
        if (this.encoderDisc && Math.abs(rpm) > 0.1) {
            this.encoderDisc.rotation.z += (rpm * 15.0 * (2 * Math.PI / 60.0)) * dt;
            // Blink encoder LED proportional to ticks
            const isTickOn = physics.channelA;
            this.encoderLedMat.color.setHex(isTickOn ? 0x22c55e : 0x064e3b);
        } else if (this.encoderLedMat) {
            this.encoderLedMat.color.setHex(0x064e3b);
        }

        // 5. Current Sensor LED Intensity
        if (this.currentLedMat && this.currentPointLight) {
            const currentRatio = Math.min(1.0, current / 8.0);
            if (currentRatio > 0.75) {
                this.currentLedMat.color.setHex(0xef4444); // Critical red
                this.currentPointLight.color.setHex(0xef4444);
            } else if (currentRatio > 0.6) {
                this.currentLedMat.color.setHex(0xf59e0b); // Amber
                this.currentPointLight.color.setHex(0xf59e0b);
            } else {
                this.currentLedMat.color.setHex(0x06b6d4); // Cyan nominal
                this.currentPointLight.color.setHex(0x06b6d4);
            }
            this.currentPointLight.intensity = 0.2 + currentRatio * 1.0;
        }

        // 6. Motor Thermal Glow & Vibration
        this.updateMotorThermalVisuals(temp, isJammed, dt);

        // 7. Update Stack Light
        this.updateStackLight(state);

        // 8. Box Cargo Flow & Mechanical Jam Dynamics
        this.updateCargoFlow(dt, rpm, isJammed, state);

        // 9. Overheat Smoke Simulation (> 75°C)
        this.updateSmoke(dt, temp);

        // 10. PLC Status LED Blinking
        if (this.plcLeds) {
            const now = Date.now();
            this.plcLeds.forEach((led, idx) => {
                const blink = Math.sin(now * 0.008 + idx * 1.5) > 0;
                led.material.color.setHex(blink ? 0x22c55e : 0x052e16);
            });
        }

        // 11. OrbitControls & Camera Lerp
        if (this.controls) {
            this.controls.update();
        }

        if (this.targetCameraPos && this.targetLookAt) {
            this.camera.position.lerp(this.targetCameraPos, 0.05);
            this.controls.target.lerp(this.targetLookAt, 0.05);
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.05) {
                this.targetCameraPos = null;
                this.targetLookAt = null;
            }
        }

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    updateMotorThermalVisuals(temp, isJammed, dt) {
        if (!this.motorThermalMat) return;

        if (this.isThermalMode) {
            // False-color FLIR infrared heatmap
            const tNorm = Math.min(1.0, Math.max(0.0, (temp - 35.0) / 50.0));
            // Color ramp: 0.0=Blue, 0.33=Green, 0.66=Yellow, 1.0=White/Red
            const color = new THREE.Color();
            if (tNorm < 0.35) {
                color.setHSL(0.6 - tNorm * 0.7, 1.0, 0.45); // Blue to Green
            } else if (tNorm < 0.75) {
                color.setHSL(0.35 - (tNorm - 0.35) * 0.7, 1.0, 0.5); // Green to Yellow/Orange
            } else {
                color.setHSL(0.05 - (tNorm - 0.75) * 0.2, 1.0, 0.5 + (tNorm - 0.75) * 0.5); // Red to White-hot
            }
            this.motorThermalMat.color.copy(color);
            this.motorThermalMat.emissive.copy(color);
            this.motorThermalMat.emissiveIntensity = 0.6;
        } else {
            // Standard PBR industrial cast-iron texture with thermal glow
            this.motorThermalMat.color.setHex(0x1e3a5f);
            if (temp > CONFIG.THERMAL.WARNING_TEMP) {
                // Glow begins at warning temp (65°C)
                const overheat = (temp - CONFIG.THERMAL.WARNING_TEMP) / (CONFIG.THERMAL.EMERGENCY_TEMP - CONFIG.THERMAL.WARNING_TEMP);
                const glowColor = new THREE.Color(0xef4444);
                this.motorThermalMat.emissive.copy(glowColor);
                this.motorThermalMat.emissiveIntensity = Math.min(1.2, overheat * 1.2);
            } else {
                this.motorThermalMat.emissive.setHex(0x000000);
                this.motorThermalMat.emissiveIntensity = 0.0;
            }
        }

        // Physical Motor Vibration / Jitter when struggling under stall
        if (isJammed && this.driveGroup) {
            const jitterAmount = 0.003;
            this.driveGroup.position.x = -1.6 + (Math.random() - 0.5) * jitterAmount;
            this.driveGroup.position.y = 0.88 + (Math.random() - 0.5) * jitterAmount;
        } else if (this.driveGroup) {
            this.driveGroup.position.set(-1.6, 0.88, 0.72);
        }
    }

    updateCargoFlow(dt, rpm, isJammed, state) {
        const linearSpeedMps = ((rpm / 60.0) * (Math.PI * CONFIG.CONVEYOR.ROLLER_DIAMETER_MM)) / 1000.0;

        // Toggle jam obstruction wedge visibility
        if (this.jamObstruction) {
            this.jamObstruction.visible = isJammed;
        }

        this.boxes.forEach((box, idx) => {
            if (isJammed && box === this.jammedBox) {
                // Jammed box is wedged right against the pinch point at x = -1.35
                box.position.x = -1.35;
                box.position.z = 0.12; // tilted sideways into rail
                box.rotation.y = 0.28;
                box.rotation.z = 0.08; // slightly lifted by roller friction
                return;
            }

            // Normal box advancement
            box.position.x -= linearSpeedMps * dt * 3.2; // Visual scaling
            box.rotation.y = 0;
            box.rotation.z = 0;

            // Loop back when box falls off left end
            if (box.position.x < -1.6) {
                box.position.x = 1.6;
                box.position.z = (Math.random() - 0.5) * 0.08;
            } else if (box.position.x > 1.65) {
                box.position.x = -1.55; // If reversing
            }
        });
    }

    updateSmoke(dt, temp) {
        if (!this.smokeParticles) return;

        if (temp > 70.0) {
            const intensity = Math.min(0.8, (temp - 70.0) / 18.0);
            this.smokeParticles.material.opacity = intensity;

            const pos = this.smokeParticles.geometry.attributes.position.array;
            for (let i = 0; i < this.smokeVelocities.length; i++) {
                const vel = this.smokeVelocities[i];
                pos[i * 3 + 0] += vel.x * dt;
                pos[i * 3 + 1] += vel.y * dt;
                pos[i * 3 + 2] += vel.z * dt;

                vel.life += dt * 0.8;
                if (vel.life > 1.0) {
                    pos[i * 3 + 0] = -1.6 + (Math.random() - 0.5) * 0.2;
                    pos[i * 3 + 1] = 1.05;
                    pos[i * 3 + 2] = 0.88 + (Math.random() - 0.5) * 0.2;
                    vel.life = 0;
                }
            }
            this.smokeParticles.geometry.attributes.position.needsUpdate = true;
        } else {
            this.smokeParticles.material.opacity = 0.0;
        }
    }

    setThermalMode(enabled) {
        this.isThermalMode = enabled;
        console.log(`[Scene] FLIR Thermal Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    setCameraPreset(name) {
        switch (name) {
            case 'iso':
                this.targetCameraPos = new THREE.Vector3(4.2, 3.2, 5.0);
                this.targetLookAt = new THREE.Vector3(0, 0.8, 0);
                break;
            case 'motor':
                this.targetCameraPos = new THREE.Vector3(-1.8, 1.4, 2.2);
                this.targetLookAt = new THREE.Vector3(-1.6, 0.9, 0.8);
                break;
            case 'jam':
                this.targetCameraPos = new THREE.Vector3(-1.4, 1.8, 1.2);
                this.targetLookAt = new THREE.Vector3(-1.35, 1.0, 0.1);
                break;
            case 'cabinet':
                this.targetCameraPos = new THREE.Vector3(-2.8, 1.6, -1.0);
                this.targetLookAt = new THREE.Vector3(-2.0, 1.2, -1.0);
                break;
            case 'top':
                this.targetCameraPos = new THREE.Vector3(0, 5.5, 0.01);
                this.targetLookAt = new THREE.Vector3(0, 0.8, 0);
                break;
        }
    }

    onResize() {
        if (!this.container) return;
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
}

// Global instance
window.ConveyorDigitalTwinScene = ConveyorDigitalTwinScene;
