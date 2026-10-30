/**
 * TORQUEGUARD 3D - Intelligent State Machine & Fault Management
 * Implements 5-factor stall detection logic, debounce against startup inrush,
 * multi-attempt automated safe recovery, and emergency lockout protection.
 */

class TorqueGuardStateMachine {
    constructor() {
        this.reset();
    }

    reset() {
        this.state = 'NORMAL';          // 'NORMAL', 'SUSPECT', 'STALL', 'RECOVERY', 'LOCKOUT', 'ESTOP'
        this.previousState = 'NORMAL';

        // 5-Criteria Boolean Evaluation State
        this.criteria = {
            currentHigh: false,         // Current > 6.0A
            rpmLow: false,              // Motor RPM < 5.0
            encoderZero: false,         // Encoder position change == 0
            positionErrorHigh: false,   // Position Error > 25%
            persistenceMet: false       // Persists for 3.0 seconds
        };

        // Timing & debouncing
        this.persistenceTimer = 0.0;    // Counts time (0 to 3.0s) while all 4 preconditions hold
        this.stateTimer = 0.0;          // Time in current state
        this.recoveryPhase = 0;         // Step 1 to Step 5
        this.recoveryAttempts = 0;      // Counter 0 to 3
        this.recoveryTimer = 0.0;       // Phase timer within recovery
        this.isRecoverySuccess = false;

        // Health Score (0 - 100%)
        this.healthScore = 100.0;

        // Callbacks / Event Listeners
        this.onStateChangeCallbacks = [];
        this.onEventLogCallbacks = [];
    }

    onStateChange(cb) {
        this.onStateChangeCallbacks.push(cb);
    }

    onEventLog(cb) {
        this.onEventLogCallbacks.push(cb);
    }

    logEvent(level, message) {
        const timestamp = new Date().toISOString().substring(11, 23);
        const eventObj = { timestamp, level, message, state: this.state };
        this.onEventLogCallbacks.forEach(cb => cb(eventObj));
    }

    setState(newState) {
        if (this.state === newState) return;
        this.previousState = this.state;
        this.state = newState;
        this.stateTimer = 0.0;

        // Industrial Audio & Tower Light synchronization
        if (window.audioEngine) {
            window.audioEngine.setAlarmState(newState);
            if (newState === 'RECOVERY' || newState === 'NORMAL') {
                window.audioEngine.playRelayClick();
            }
        }

        // Notify subscribers
        this.onStateChangeCallbacks.forEach(cb => cb(newState, this.previousState));
    }

    /**
     * Primary State Machine Cycle (Run at dt ~ 20ms)
     */
    update(dt, physics) {
        this.stateTimer += dt;

        // Emergency Stop overrides everything
        if (this.state === 'ESTOP') {
            physics.setPower(false);
            physics.setCommandedRpm(0);
            this.healthScore = 10.0;
            return;
        }

        // Lockout state persists until manual reset
        if (this.state === 'LOCKOUT') {
            physics.setPower(false);
            physics.setCommandedRpm(0);
            this.healthScore = 15.0;
            return;
        }

        // -------------------------------------------------------------
        // Multi-Factor Stall Detection Gate Evaluation
        // -------------------------------------------------------------
        const currentA = physics.rawCurrent;
        const rpm = Math.abs(physics.rpm);
        const encoderVelocity = Math.abs(physics.encoderVelocityRpm);
        const positionError = physics.positionErrorPct;

        // Criterion 1: Current > 6.0A
        this.criteria.currentHigh = currentA > CONFIG.STALL_DETECTION.CURRENT_THRESHOLD;

        // Criterion 2: Motor RPM < 5.0
        this.criteria.rpmLow = rpm < CONFIG.STALL_DETECTION.RPM_THRESHOLD;

        // Criterion 3: Encoder position change == 0 (velocity < 1.0)
        this.criteria.encoderZero = encoderVelocity < 1.0;

        // Criterion 4: Position Error > 25%
        this.criteria.positionErrorHigh = positionError > CONFIG.STALL_DETECTION.POSITION_ERROR_MIN;

        // Instantaneous Stall Preconditions Satisfied?
        const instantaneousStall = this.criteria.currentHigh &&
                                   this.criteria.rpmLow &&
                                   this.criteria.encoderZero &&
                                   this.criteria.positionErrorHigh;

        // Debounce / Persistence Timer Logic (Criterion 5)
        if (instantaneousStall && (this.state === 'NORMAL' || this.state === 'SUSPECT')) {
            this.persistenceTimer += dt;
            if (this.persistenceTimer >= CONFIG.STALL_DETECTION.PERSISTENCE_TIME_SEC) {
                this.criteria.persistenceMet = true;
            }
        } else if (this.state !== 'RECOVERY' && this.state !== 'STALL') {
            // Decay persistence timer if conditions clear (e.g. startup inrush ends within 0.3s)
            this.persistenceTimer = Math.max(0.0, this.persistenceTimer - dt * 2.0);
            this.criteria.persistenceMet = false;
        }

        // -------------------------------------------------------------
        // State Machine Transition Logic
        // -------------------------------------------------------------
        switch (this.state) {
            case 'NORMAL':
                // Check if approaching suspect zone
                if (instantaneousStall || (currentA > 5.5 && positionError > 15.0)) {
                    this.setState('SUSPECT');
                    this.logEvent('WARNING', `Motor under mechanical strain. Current: ${currentA.toFixed(2)}A, RPM: ${rpm.toFixed(1)}. Anti-Inrush Debounce initiated.`);
                }
                break;

            case 'SUSPECT':
                // Check if all 5 criteria are verified (3-second persistence elapsed)
                if (this.criteria.persistenceMet) {
                    this.setState('STALL');
                    this.logEvent('CRITICAL', `STALL CONFIRMED! All 5 criteria satisfied (Current: ${currentA.toFixed(2)}A > 6A, RPM: 0, Encoder Delta: 0, Persistence: 3.0s). Triggering Protective Recovery.`);
                } else if (!instantaneousStall && currentA < 5.0) {
                    // Safe recovery back to NORMAL (transient cleared)
                    this.setState('NORMAL');
                    this.persistenceTimer = 0.0;
                    this.logEvent('INFO', `Transient cleared. System returned to NORMAL (Current: ${currentA.toFixed(2)}A, RPM: ${rpm.toFixed(1)}).`);
                }
                break;

            case 'STALL':
                // Transition immediately into safe recovery sequence
                this.executeRecoverySequence(dt, physics);
                break;

            case 'RECOVERY':
                this.executeRecoverySequence(dt, physics);
                break;
        }

        // Compute dynamic System Health Score
        this.updateHealthScore(physics);
    }

    /**
     * Recovery Strategy (5-Step Industrial Protocol)
     * Step 1: Stop PWM immediately
     * Step 2: Wait 2 seconds (cooldown)
     * Step 3: Reverse motor for 1 second (-30 RPM) to dislodge jam
     * Step 4: Restart conveyor forward
     * Step 5: Check encoder movement -> if success return NORMAL, else repeat (max 3)
     */
    executeRecoverySequence(dt, physics) {
        if (this.state !== 'RECOVERY') {
            this.setState('RECOVERY');
            this.recoveryPhase = 1;
            this.recoveryTimer = 0.0;
            this.recoveryAttempts++;
            this.logEvent('RECOVERY', `--- Recovery Routine Initiated (Attempt ${this.recoveryAttempts} of ${CONFIG.RECOVERY.MAX_ATTEMPTS}) ---`);
        }

        this.recoveryTimer += dt;

        switch (this.recoveryPhase) {
            case 1:
                // Step 1: Stop PWM immediately
                physics.setPower(false);
                physics.setCommandedRpm(0);
                this.logEvent('RECOVERY', `Step 1/5: Cutting motor PWM. Contactor opened to halt thermal runaway.`);
                this.recoveryPhase = 2;
                this.recoveryTimer = 0.0;
                break;

            case 2:
                // Step 2: Wait 2.0 seconds cooldown & inductive decay
                physics.setPower(false);
                physics.setCommandedRpm(0);
                if (this.recoveryTimer >= CONFIG.RECOVERY.STEP2_WAIT_COOLDOWN) {
                    this.logEvent('RECOVERY', `Step 2/5: Cooldown wait (2.0s) completed. Reversing H-Bridge polarity.`);
                    this.recoveryPhase = 3;
                    this.recoveryTimer = 0.0;
                }
                break;

            case 3:
                // Step 3: Reverse motor for 1.0 second (-30 RPM)
                physics.setPower(true);
                physics.setCommandedRpm(CONFIG.RECOVERY.STEP3_REVERSE_RPM); // Reverse -30 RPM

                // Check if jam can be dislodged during reverse
                if (physics.isJammed && this.recoveryTimer > 0.4) {
                    if (this.canJamBeDislodged()) {
                        physics.setJam(false);
                        this.logEvent('INFO', `Obstruction successfully ejected by reverse torque action!`);
                    }
                }

                if (this.recoveryTimer >= CONFIG.RECOVERY.STEP3_REVERSE_DURATION) {
                    this.logEvent('RECOVERY', `Step 3/5: Reversal complete. Preparing forward restart.`);
                    this.recoveryPhase = 4;
                    this.recoveryTimer = 0.0;
                }
                break;

            case 4:
                // Step 4: Restart conveyor forward
                physics.setPower(true);
                physics.setCommandedRpm(CONFIG.CONVEYOR.NORMAL_RPM); // +100 RPM
                if (this.recoveryTimer >= CONFIG.RECOVERY.STEP4_RESTART_DURATION) {
                    this.logEvent('RECOVERY', `Step 4/5: Motor restarted forward. Verifying optical encoder motion.`);
                    this.recoveryPhase = 5;
                    this.recoveryTimer = 0.0;
                }
                break;

            case 5:
                // Step 5: Check optical encoder feedback
                if (this.recoveryTimer >= CONFIG.RECOVERY.STEP5_VERIFY_WINDOW) {
                    const encoderMoving = Math.abs(physics.encoderVelocityRpm) > 40.0;
                    const currentSafe = physics.rawCurrent < CONFIG.MOTOR.MAX_SAFE_CURRENT;

                    if (encoderMoving && currentSafe && !physics.isJammed) {
                        // RECOVERY SUCCESSFUL!
                        this.logEvent('INFO', `Step 5/5: SUCCESS! Encoder feedback verified (${physics.encoderVelocityRpm.toFixed(1)} RPM). Restoring NORMAL state.`);
                        if (window.audioEngine) {
                            window.audioEngine.playSuccessChime();
                        }
                        this.recoveryAttempts = 0;
                        this.persistenceTimer = 0.0;
                        this.setState('NORMAL');
                    } else {
                        // RECOVERY FAILED THIS ATTEMPT
                        this.logEvent('WARNING', `Step 5/5: Motion check failed! Attempt ${this.recoveryAttempts}/${CONFIG.RECOVERY.MAX_ATTEMPTS} unsuccessful.`);

                        if (this.recoveryAttempts >= CONFIG.RECOVERY.MAX_ATTEMPTS) {
                            // 3 ATTEMPTS EXHAUSTED -> LOCKOUT!
                            this.setState('LOCKOUT');
                            this.logEvent('CRITICAL', `EMERGENCY LOCKOUT ACTIVATED! Maximum recovery attempts (3) exceeded. Motor power locked out. Manual technician reset required.`);
                        } else {
                            // Retry next attempt
                            this.recoveryPhase = 1;
                            this.recoveryTimer = 0.0;
                            this.recoveryAttempts++;
                            this.logEvent('RECOVERY', `--- Retrying Recovery Routine (Attempt ${this.recoveryAttempts} of ${CONFIG.RECOVERY.MAX_ATTEMPTS}) ---`);
                        }
                    }
                }
                break;
        }
    }

    /**
     * Determines if jam is temporary or permanent
     */
    canJamBeDislodged() {
        // If jam is marked permanent (e.g. Demo 4), return false
        if (window.isPermanentJam) {
            return false;
        }
        return true;
    }

    updateHealthScore(physics) {
        if (this.state === 'LOCKOUT' || this.state === 'ESTOP') {
            this.healthScore = Math.max(0.0, this.healthScore - 0.5);
            return;
        }

        let score = 100.0;

        // Current penalty
        if (physics.rawCurrent > CONFIG.MOTOR.RATED_CURRENT) {
            const currentOver = physics.rawCurrent - CONFIG.MOTOR.RATED_CURRENT;
            score -= (currentOver / 4.0) * 35.0;
        }

        // Temperature penalty
        if (physics.temperature > CONFIG.THERMAL.NORMAL_MAX_TEMP) {
            const tempOver = physics.temperature - CONFIG.THERMAL.NORMAL_MAX_TEMP;
            score -= (tempOver / 30.0) * 40.0;
        }

        // Position Error penalty
        if (physics.positionErrorPct > 5.0) {
            score -= (physics.positionErrorPct / 100.0) * 25.0;
        }

        this.healthScore = Math.max(0.0, Math.min(100.0, score));
    }

    manualReset(physics) {
        this.logEvent('INFO', 'Technician initiated manual system reset. Clearing faults.');
        this.reset();
        window.isPermanentJam = false;
        physics.setJam(false);
        physics.coolDown();
        physics.setPower(true);
        physics.setCommandedRpm(CONFIG.CONVEYOR.NORMAL_RPM);
        this.setState('NORMAL');
    }

    emergencyStop(physics) {
        this.logEvent('CRITICAL', 'EMERGENCY STOP (E-STOP) ENGAGED BY OPERATOR! Immediate safety cutoff.');
        this.setState('ESTOP');
        physics.setPower(false);
        physics.setCommandedRpm(0);
    }
}

// Global instance
window.stateMachine = new TorqueGuardStateMachine();
