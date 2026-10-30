/**
 * TORQUEGUARD 3D - Master Application Controller
 * Coordinates Three.js 3D Viewport, Physics Engine, State Machine, Audio, and SCADA UI.
 */

class TorqueGuardApp {
    constructor() {
        this.lastTime = performance.now();
        this.isRunning = true;
        this.init();
    }

    init() {
        console.log("[App] Launching TORQUEGUARD 3D Digital Twin...");

        // 1. Initialize 3D Scene
        window.conveyorScene = new ConveyorDigitalTwinScene('canvas-container');

        // 2. Initialize Dashboard
        window.dashboard = new TorqueGuardDashboard();

        // 3. Connect State Machine Event Listeners
        window.stateMachine.onEventLog(eventObj => {
            window.dashboard.addEventLog(eventObj);
        });

        window.stateMachine.onStateChange((newState, oldState) => {
            console.log(`[State Transition] ${oldState} -> ${newState}`);
        });

        // 4. Initial System Power-Up
        window.physicsEngine.setPower(true);
        window.physicsEngine.setCommandedRpm(CONFIG.CONVEYOR.NORMAL_RPM);

        // Initial system event logs
        window.stateMachine.logEvent('INFO', 'TorqueGuard 3D Actuator Digital Twin Online. Embedded Firmware v3.4 Active.');
        window.stateMachine.logEvent('INFO', 'Quadrature Optical Encoder (1024 PPR) synchronized to TIM2 32-bit QEI peripheral.');
        window.stateMachine.logEvent('INFO', 'ACS712 Current Transducer & PT100 RTD calibrated. System in NORMAL state.');

        // 5. Start Animation & Physics Loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    loop(currentTime) {
        requestAnimationFrame(this.loop);

        const deltaMs = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Cap dt to prevent spiral of death during background tab throttling
        const dt = Math.min(0.05, deltaMs / 1000.0) || CONFIG.SIMULATION.TIME_STEP_SEC;

        // 1. Step electro-mechanical and thermal physics
        window.physicsEngine.step(dt);

        // 2. Step 5-factor stall detection state machine
        window.stateMachine.update(dt, window.physicsEngine);

        // 3. Render 3D Three.js digital twin
        window.conveyorScene.animate(dt, window.physicsEngine, window.stateMachine);

        // 4. Update SCADA telemetry & oscilloscope
        window.dashboard.update(window.physicsEngine, window.stateMachine);
    }
}

// Boot on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
    window.torqueGuardApp = new TorqueGuardApp();
});
