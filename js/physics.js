/**
 * TORQUEGUARD 3D - Electro-Mechanical & Thermal Physics Engine
 * Simulates 24V DC motor differential equations, inrush transient, back-EMF,
 * optical encoder quadrature pulses, and lumped capacitance thermal model.
 */

class MotorPhysicsEngine {
    constructor() {
        this.reset();
    }

    reset() {
        // Electrical state
        this.voltage = 0.0;            // Applied armature voltage (V)
        this.current = 0.0;            // Armature current (A)
        this.rawCurrent = 0.0;         // Unfiltered sensor reading (A)
        this.pwmDuty = 0.0;            // Commanded PWM (-1.0 to +1.0)
        this.inrushTimer = 0.0;        // Inrush transient timer (s)
        this.isPowered = false;

        // Mechanical state
        this.rpm = 0.0;                // Actual output roller speed (RPM)
        this.targetRpm = 0.0;          // Commanded setpoint (RPM)
        this.angularVelocity = 0.0;    // rad/s
        this.motorTorque = 0.0;        // Electromagnetic torque (Nm)
        this.loadTorque = 0.35;        // Applied load torque (Nm)
        this.isJammed = false;         // Mechanical jam flag
        this.jamSeverity = 1.0;        // 1.0 = hard wedge
        this.loadMode = 'normal';      // 'normal' or 'heavy'

        // Thermal state
        this.temperature = CONFIG.THERMAL.AMBIENT_TEMP; // °C
        this.heatDissipation = 0.0;

        // Optical Rotary Encoder state
        this.totalPulses = 0;
        this.pulsesThisWindow = 0;
        this.encoderSampleTimer = 0.0;
        this.encoderVelocityRpm = 0.0;
        this.positionErrorPct = 0.0;
        this.linearTravelMeters = 0.0;

        // Quadrature channels (A & B boolean states for visualizer)
        this.channelA = false;
        this.channelB = false;
        this.encoderAngle = 0.0;       // Radians

        // History rolling buffers for charts
        this.history = {
            time: [],
            current: [],
            temperature: [],
            rpm: [],
            error: []
        };
        this.simTime = 0.0;
    }

    setPower(state) {
        this.isPowered = state;
        if (!state) {
            this.pwmDuty = 0.0;
            this.voltage = 0.0;
            this.inrushTimer = 0.0;
        }
    }

    setCommandedRpm(target) {
        this.targetRpm = target;
        if (target !== 0) {
            this.pwmDuty = target / CONFIG.CONVEYOR.NORMAL_RPM;
        } else {
            this.pwmDuty = 0.0;
        }
    }

    setLoadMode(mode) {
        this.loadMode = mode;
        if (mode === 'heavy') {
            this.loadTorque = 1.15; // Increased drag for 45kg load
        } else {
            this.loadTorque = 0.35; // Nominal drag
        }
    }

    setJam(isJammed, severity = 1.0) {
        this.isJammed = isJammed;
        this.jamSeverity = severity;
        if (isJammed && window.audioEngine) {
            window.audioEngine.playJamImpactSound();
        }
    }

    /**
     * Primary Physics Step (Run at dt ~ 20ms)
     */
    step(dt) {
        this.simTime += dt;

        // 1. Target voltage determination
        if (this.isPowered && Math.abs(this.pwmDuty) > 0.01) {
            this.voltage = this.pwmDuty * CONFIG.MOTOR.RATED_VOLTAGE;
        } else {
            this.voltage = 0.0;
        }

        // 2. Electro-mechanical ODE simulation
        const Ra = CONFIG.MOTOR.ARMATURE_RESISTANCE;
        const Ke = CONFIG.MOTOR.BACK_EMF_KE;
        const Kt = CONFIG.MOTOR.TORQUE_CONSTANT_KT;
        const Gr = CONFIG.MOTOR.GEARBOX_RATIO;
        const J = CONFIG.MOTOR.ROTOR_INERTIA;
        const b = CONFIG.MOTOR.VISCOUS_FRICTION;

        // Check startup transient (inrush current)
        const isStartingUp = (Math.abs(this.voltage) > 1.0) && (Math.abs(this.rpm) < 15.0);
        if (isStartingUp && !this.isJammed) {
            this.inrushTimer += dt;
        } else if (Math.abs(this.rpm) > 30.0) {
            this.inrushTimer = Math.max(0.0, this.inrushTimer - dt * 2.0);
        }

        if (this.isJammed) {
            // Hard mechanical lock: rotor cannot turn (omega = 0)
            // Back-EMF is zero! Armature current spikes to locked-rotor stall current:
            // I_stall = V / Ra with slight supply sag
            this.angularVelocity = 0.0;
            this.rpm = 0.0;
            const targetCurrent = Math.abs(this.voltage) / (Ra * 2.65); // Realistic ~7.4A at 24V
            // Fast first-order current response (L/R time constant)
            this.current += (targetCurrent - this.current) * Math.min(1.0, dt * 18.0);
        } else if (Math.abs(this.voltage) > 0.5) {
            // Motor is powered and free to rotate
            const motorOmega = (this.rpm * (2 * Math.PI / 60)) * Gr;
            const backEmf = Ke * motorOmega;
            const effectiveV = this.voltage - backEmf;

            // Base current from Ohm's law with back-EMF
            let theoreticalI = effectiveV / Ra;

            // Add transient inrush spike if in startup phase (first 0.3s)
            if (this.inrushTimer > 0 && this.inrushTimer < CONFIG.MOTOR.INRUSH_DECAY_TIME) {
                const inrushDecay = Math.exp(-this.inrushTimer / 0.12);
                theoreticalI += 5.2 * inrushDecay; // Peak inrush ~7.5A
            }

            // Lowpass filtering to model armature inductance (L/R)
            this.current += (Math.abs(theoreticalI) - this.current) * Math.min(1.0, dt * 22.0);

            // Compute motor torque
            this.motorTorque = Kt * this.current * Math.sign(this.voltage);

            // Output speed dynamics: J * domega/dt = tau_motor - tau_load - b * omega
            let netTorque = (this.motorTorque * Gr) - (this.loadTorque * Math.sign(this.motorTorque)) - (b * this.angularVelocity);

            // Acceleration
            const dOmega = (netTorque / J) * dt;
            this.angularVelocity += dOmega;

            // Target steady state speed scaling based on load
            let targetSpeed = this.targetRpm;
            if (this.loadMode === 'heavy') {
                targetSpeed = CONFIG.CONVEYOR.HEAVY_LOAD_RPM * Math.sign(this.targetRpm);
            }
            // Smoothly approach steady state speed
            this.rpm += (targetSpeed - this.rpm) * Math.min(1.0, dt * 3.5);

            // Reconcile current under steady running
            if (Math.abs(this.rpm) > 20.0 && this.inrushTimer >= CONFIG.MOTOR.INRUSH_DECAY_TIME) {
                let nominalRunningCurrent = CONFIG.MOTOR.RATED_CURRENT; // ~2.4A
                if (this.loadMode === 'heavy') {
                    nominalRunningCurrent = 4.2; // 4.2A under 45kg heavy load
                }
                this.current += (nominalRunningCurrent - this.current) * Math.min(1.0, dt * 4.0);
            }
        } else {
            // Unpowered: spin down naturally
            this.current += (0.0 - this.current) * Math.min(1.0, dt * 8.0);
            this.rpm += (0.0 - this.rpm) * Math.min(1.0, dt * 2.5);
            this.angularVelocity = (this.rpm * (2 * Math.PI / 60));
        }

        // Add realistic ADC sensor noise (+/- 0.04A)
        const sensorNoise = (Math.random() - 0.5) * 0.08;
        this.rawCurrent = Math.max(0.0, this.current + (this.current > 0.1 ? sensorNoise : 0.0));

        // 3. Lumped Capacitance Thermal Model (ODE)
        // dT/dt = (I^2 * R) / C_th - (T - T_amb) / (R_th * C_th)
        const currentPower = Math.pow(this.current, 2) * Ra; // Joule heating watts (I^2 * R)
        const Tamb = CONFIG.THERMAL.AMBIENT_TEMP;
        let Rth = CONFIG.THERMAL.THERMAL_RESISTANCE;

        // When motor rotates, fan actively forces convective cooling
        if (Math.abs(this.rpm) > 20.0) {
            Rth *= (1.0 - CONFIG.THERMAL.FAN_COOLING_FACTOR * (Math.abs(this.rpm) / CONFIG.CONVEYOR.NORMAL_RPM));
        }

        const Cth = CONFIG.THERMAL.THERMAL_CAPACITANCE;
        const heatIn = currentPower / Cth;
        const heatOut = (this.temperature - Tamb) / (Rth * Cth);
        const dTemp = (heatIn - heatOut) * dt * 1.5; // slight speedup for demonstration responsiveness

        this.temperature = Math.max(Tamb, this.temperature + dTemp);

        // 4. Optical Rotary Encoder Emulation
        this.updateEncoder(dt);

        // 5. Update audio acoustics
        if (window.audioEngine) {
            window.audioEngine.updateMotorSound(this.rpm, this.current, this.isJammed);
        }

        // 6. Record history buffers
        this.recordHistory();
    }

    /**
     * Optical Quadrature Incremental Encoder Emulation
     * Updates A/B pulse trains, pulse accumulator, and velocity window
     */
    updateEncoder(dt) {
        const rollerRps = this.rpm / 60.0;
        const pulsesPerSec = Math.abs(rollerRps) * CONFIG.ENCODER.PULSES_PER_REV;
        const pulsesThisDt = pulsesPerSec * dt;

        if (Math.abs(this.rpm) > 0.5) {
            this.totalPulses += Math.round(pulsesThisDt);
            this.pulsesThisWindow += pulsesThisDt;

            // Quadrature phases
            this.encoderAngle += (rollerRps * 2 * Math.PI) * dt * 8; // visual scaling
            this.channelA = Math.sin(this.encoderAngle) > 0;
            this.channelB = Math.cos(this.encoderAngle) > 0;

            // Linear travel in meters (pi * D * revolutions)
            const circumferenceM = (Math.PI * CONFIG.CONVEYOR.ROLLER_DIAMETER_MM) / 1000.0;
            this.linearTravelMeters += (rollerRps * circumferenceM) * dt;
        } else {
            this.channelA = false;
            this.channelB = false;
        }

        // Velocity sampling window (every 50ms, mimicking 20Hz MCU timer interrupt)
        this.encoderSampleTimer += dt;
        if (this.encoderSampleTimer >= (CONFIG.ENCODER.SAMPLE_PERIOD_MS / 1000.0)) {
            // Computed RPM from encoder pulses
            const sampleSec = this.encoderSampleTimer;
            const pps = this.pulsesThisWindow / sampleSec;
            this.encoderVelocityRpm = (pps / CONFIG.ENCODER.PULSES_PER_REV) * 60.0;

            // Compute Position Error %
            const expectedRpm = Math.abs(this.targetRpm);
            if (expectedRpm > 5.0) {
                const speedDeficit = Math.max(0.0, expectedRpm - Math.abs(this.encoderVelocityRpm));
                this.positionErrorPct = (speedDeficit / expectedRpm) * 100.0;
            } else {
                this.positionErrorPct = 0.0;
            }

            // Reset sampling window
            this.encoderSampleTimer = 0.0;
            this.pulsesThisWindow = 0;
        }
    }

    recordHistory() {
        if (this.history.time.length >= CONFIG.SIMULATION.MAX_HISTORY_POINTS) {
            this.history.time.shift();
            this.history.current.shift();
            this.history.temperature.shift();
            this.history.rpm.shift();
            this.history.error.shift();
        }

        this.history.time.push(this.simTime.toFixed(1));
        this.history.current.push(parseFloat(this.rawCurrent.toFixed(2)));
        this.history.temperature.push(parseFloat(this.temperature.toFixed(1)));
        this.history.rpm.push(parseFloat(this.rpm.toFixed(1)));
        this.history.error.push(parseFloat(this.positionErrorPct.toFixed(1)));
    }

    /**
     * Cool down motor manually or during reset
     */
    coolDown() {
        this.temperature = CONFIG.THERMAL.AMBIENT_TEMP;
    }
}

// Global instance
window.physicsEngine = new MotorPhysicsEngine();
