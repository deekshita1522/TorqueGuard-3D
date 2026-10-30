/**
 * TORQUEGUARD 3D - SCADA Industrial Dashboard & Telemetry Visualizer
 * High-performance canvas gauges, real-time multi-trace oscilloscope,
 * 5-condition stall logic gate matrix, FSM visualizer, event logger, and demo sequencer.
 */

class TorqueGuardDashboard {
    constructor() {
        this.chartCanvas = document.getElementById('scada-oscilloscope');
        this.chartCtx = this.chartCanvas ? this.chartCanvas.getContext('2d') : null;
        this.eventLogContainer = document.getElementById('event-log-body');

        // Active oscilloscope channels
        this.channelVisibility = {
            current: true,
            temperature: true,
            rpm: true,
            error: true
        };

        this.initDemoButtons();
        this.initControlButtons();
        this.initVivaModal();
    }

    /**
     * Primary Telemetry Update (Called on every animation frame)
     */
    update(physics, stateMachine) {
        // 1. Digital Gauges & Numbers
        this.updateDigitalDisplays(physics, stateMachine);

        // 2. Multi-Factor Stall Detection Gate Matrix
        this.updateStallGateMatrix(physics, stateMachine);

        // 3. State Machine & Recovery Visualizer
        this.updateStateVisualizer(stateMachine);

        // 4. Encoder Telemetry Card
        this.updateEncoderCard(physics);

        // 5. System Health Bar
        this.updateHealthBar(stateMachine.healthScore);

        // 6. Real-Time Oscilloscope Chart
        this.renderOscilloscope(physics);
    }

    updateDigitalDisplays(physics, stateMachine) {
        // Motor Current
        const curElem = document.getElementById('val-current');
        const curBar = document.getElementById('bar-current');
        if (curElem) {
            curElem.innerText = physics.rawCurrent.toFixed(2);
            // Color based on safety limits
            if (physics.rawCurrent > CONFIG.MOTOR.CRITICAL_CURRENT) {
                curElem.className = 'gauge-value val-critical';
            } else if (physics.rawCurrent > CONFIG.MOTOR.MAX_SAFE_CURRENT) {
                curElem.className = 'gauge-value val-warning';
            } else {
                curElem.className = 'gauge-value val-normal';
            }
        }
        if (curBar) {
            const curPct = Math.min(100, (physics.rawCurrent / 10.0) * 100);
            curBar.style.width = `${curPct}%`;
        }

        // Motor Temperature
        const tempElem = document.getElementById('val-temperature');
        const tempBar = document.getElementById('bar-temperature');
        if (tempElem) {
            tempElem.innerText = physics.temperature.toFixed(1);
            if (physics.temperature > CONFIG.THERMAL.CRITICAL_TEMP) {
                tempElem.className = 'gauge-value val-critical';
            } else if (physics.temperature > CONFIG.THERMAL.WARNING_TEMP) {
                tempElem.className = 'gauge-value val-warning';
            } else {
                tempElem.className = 'gauge-value val-normal';
            }
        }
        if (tempBar) {
            const tempPct = Math.min(100, Math.max(0, ((physics.temperature - 20) / 80) * 100));
            tempBar.style.width = `${tempPct}%`;
        }

        // Conveyor Speed (RPM)
        const rpmElem = document.getElementById('val-rpm');
        const rpmBar = document.getElementById('bar-rpm');
        if (rpmElem) {
            rpmElem.innerText = Math.abs(physics.rpm).toFixed(1);
            if (Math.abs(physics.rpm) < 5.0 && physics.isPowered) {
                rpmElem.className = 'gauge-value val-critical';
            } else {
                rpmElem.className = 'gauge-value val-normal';
            }
        }
        if (rpmBar) {
            const rpmPct = Math.min(100, (Math.abs(physics.rpm) / 120.0) * 100);
            rpmBar.style.width = `${rpmPct}%`;
        }

        // Position Error (%)
        const errElem = document.getElementById('val-error');
        const errBar = document.getElementById('bar-error');
        if (errElem) {
            errElem.innerText = physics.positionErrorPct.toFixed(1);
            if (physics.positionErrorPct > CONFIG.STALL_DETECTION.POSITION_ERROR_MIN) {
                errElem.className = 'gauge-value val-critical';
            } else if (physics.positionErrorPct > 10.0) {
                errElem.className = 'gauge-value val-warning';
            } else {
                errElem.className = 'gauge-value val-normal';
            }
        }
        if (errBar) {
            errBar.style.width = `${Math.min(100, physics.positionErrorPct)}%`;
        }
    }

    /**
     * Updates the 5-Factor Stall Detection Gate Matrix with live boolean checkmarks
     */
    updateStallGateMatrix(physics, stateMachine) {
        const c = stateMachine.criteria;

        // Condition 1: Current > 6.0A
        this.setGateRow('gate-c1', c.currentHigh, `${physics.rawCurrent.toFixed(2)}A > 6.0A`);

        // Condition 2: Motor RPM < 5.0
        this.setGateRow('gate-c2', c.rpmLow, `${Math.abs(physics.rpm).toFixed(1)} < 5.0 RPM`);

        // Condition 3: Encoder delta == 0
        this.setGateRow('gate-c3', c.encoderZero, `${Math.abs(physics.encoderVelocityRpm).toFixed(0)} pulses/s`);

        // Condition 4: Position Error > 25%
        this.setGateRow('gate-c4', c.positionErrorHigh, `${physics.positionErrorPct.toFixed(1)}% > 25%`);

        // Condition 5: Persistence Timer >= 3.0s
        const pSec = stateMachine.persistenceTimer.toFixed(1);
        const pBar = document.getElementById('persistence-progress');
        const pLabel = document.getElementById('persistence-label');
        if (pBar) {
            const pct = Math.min(100, (stateMachine.persistenceTimer / 3.0) * 100);
            pBar.style.width = `${pct}%`;
        }
        if (pLabel) {
            pLabel.innerText = `${pSec}s / 3.0s`;
        }
        this.setGateRow('gate-c5', c.persistenceMet, `${pSec}s / 3.0s Debounced`);

        // Master Logic Status Banner
        const banner = document.getElementById('stall-decision-banner');
        if (banner) {
            if (stateMachine.state === 'LOCKOUT') {
                banner.className = 'decision-banner banner-lockout';
                banner.innerHTML = '<span class="pulse-dot red"></span> EMERGENCY LOCKOUT - 3 RETRIES FAILED';
            } else if (stateMachine.state === 'RECOVERY') {
                banner.className = 'decision-banner banner-recovery';
                banner.innerHTML = `<span class="pulse-dot blue"></span> AUTO-RECOVERY ACTIVE (ATTEMPT ${stateMachine.recoveryAttempts}/3)`;
            } else if (stateMachine.state === 'STALL') {
                banner.className = 'decision-banner banner-stall';
                banner.innerHTML = '<span class="pulse-dot orange"></span> STALL CONFIRMED! INITIATING SAFETY TRIP';
            } else if (stateMachine.state === 'SUSPECT') {
                banner.className = 'decision-banner banner-suspect';
                banner.innerHTML = '<span class="pulse-dot yellow"></span> SUSPECT STRAIN - DEBOUNCE TIMER ACTIVE';
            } else {
                banner.className = 'decision-banner banner-normal';
                banner.innerHTML = '<span class="pulse-dot green"></span> NORMAL OPERATION - INRUSH PROTECTED';
            }
        }
    }

    setGateRow(elemId, isMet, liveText) {
        const row = document.getElementById(elemId);
        if (!row) return;
        const icon = row.querySelector('.gate-icon');
        const val = row.querySelector('.gate-val');
        if (isMet) {
            row.classList.add('gate-met');
            row.classList.remove('gate-unmet');
            if (icon) icon.innerHTML = '&#10004;'; // Checkmark
        } else {
            row.classList.add('gate-unmet');
            row.classList.remove('gate-met');
            if (icon) icon.innerHTML = '&#9675;'; // Empty circle
        }
        if (val) val.innerText = liveText;
    }

    /**
     * Updates State Machine Visualizer Flow Nodes
     */
    updateStateVisualizer(stateMachine) {
        const states = ['NORMAL', 'SUSPECT', 'STALL', 'RECOVERY', 'LOCKOUT'];
        states.forEach(s => {
            const node = document.getElementById(`fsm-${s.toLowerCase()}`);
            if (node) {
                if (stateMachine.state === s) {
                    node.classList.add('fsm-active');
                } else {
                    node.classList.remove('fsm-active');
                }
            }
        });

        // Top Header Status Badge
        const mainStateText = document.getElementById('main-state-text');
        const mainDot = document.getElementById('main-heartbeat-dot');
        if (mainStateText && mainDot) {
            mainStateText.innerText = `CELL STATUS: ${stateMachine.state}`;
            let colorClass = 'green';
            if (stateMachine.state === 'SUSPECT') colorClass = 'yellow';
            else if (stateMachine.state === 'STALL') colorClass = 'orange';
            else if (stateMachine.state === 'RECOVERY') colorClass = 'blue';
            else if (stateMachine.state === 'LOCKOUT' || stateMachine.state === 'ESTOP') colorClass = 'red';
            mainDot.className = `pulse-dot ${colorClass}`;
        }

        // Recovery Step Indicator
        const recContainer = document.getElementById('recovery-steps-card');
        if (recContainer) {
            if (stateMachine.state === 'RECOVERY') {
                recContainer.style.display = 'block';
                const attemptElem = document.getElementById('rec-attempt-num');
                const phaseElem = document.getElementById('rec-phase-desc');
                if (attemptElem) attemptElem.innerText = `Attempt ${stateMachine.recoveryAttempts} of 3`;
                if (phaseElem) {
                    const phases = [
                        'Idle',
                        'Step 1: Immediate PWM Cut (Contactor Tripped)',
                        'Step 2: 2.0s Cooldown & Back-EMF Dissipation',
                        'Step 3: Reversing Motor (-30 RPM) to Eject Obstruction',
                        'Step 4: Restarting Forward (+100 RPM)',
                        'Step 5: Optical Encoder Feedback Verification'
                    ];
                    phaseElem.innerText = phases[stateMachine.recoveryPhase] || 'In Progress';
                }
            } else {
                recContainer.style.display = 'none';
            }
        }
    }

    updateEncoderCard(physics) {
        const pulsesElem = document.getElementById('enc-pulses');
        const freqElem = document.getElementById('enc-freq');
        const distElem = document.getElementById('enc-distance');
        const dirElem = document.getElementById('enc-dir');
        const chAElem = document.getElementById('enc-cha');
        const chBElem = document.getElementById('enc-chb');

        if (pulsesElem) pulsesElem.innerText = physics.totalPulses.toLocaleString();
        if (freqElem) {
            const freq = Math.round(Math.abs(physics.rpm / 60.0) * CONFIG.ENCODER.PULSES_PER_REV);
            freqElem.innerText = `${freq} Hz`;
        }
        if (distElem) distElem.innerText = `${physics.linearTravelMeters.toFixed(2)} m`;
        if (dirElem) {
            if (physics.rpm > 1.0) {
                dirElem.innerText = 'FORWARD';
                dirElem.className = 'enc-dir fwd';
            } else if (physics.rpm < -1.0) {
                dirElem.innerText = 'REVERSE';
                dirElem.className = 'enc-dir rev';
            } else {
                dirElem.innerText = 'STOPPED';
                dirElem.className = 'enc-dir stop';
            }
        }
        if (chAElem) chAElem.className = `phase-led ${physics.channelA ? 'led-on' : 'led-off'}`;
        if (chBElem) chBElem.className = `phase-led ${physics.channelB ? 'led-on' : 'led-off'}`;
    }

    updateHealthBar(score) {
        const scoreElem = document.getElementById('health-score-val');
        const barElem = document.getElementById('health-score-bar');
        if (scoreElem) scoreElem.innerText = `${Math.round(score)}%`;
        if (barElem) {
            barElem.style.width = `${Math.round(score)}%`;
            if (score > 75) {
                barElem.style.backgroundColor = '#10b981';
            } else if (score > 40) {
                barElem.style.backgroundColor = '#f59e0b';
            } else {
                barElem.style.backgroundColor = '#ef4444';
            }
        }
    }

    /**
     * High-performance Canvas Multi-Trace Oscilloscope
     */
    renderOscilloscope(physics) {
        if (!this.chartCtx || !this.chartCanvas) return;
        const ctx = this.chartCtx;
        const w = this.chartCanvas.width;
        const h = this.chartCanvas.height;
        const hist = physics.history;

        // Clear canvas with dark oscilloscope grid
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, w, h);

        // Draw horizontal grid lines & scale markings
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 30) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        for (let x = 0; x < w; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Draw Critical 6.0A Threshold Line (Orange dashed)
        const curThresholdY = h - (6.0 / 10.0) * h;
        ctx.strokeStyle = '#f97316';
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, curThresholdY);
        ctx.lineTo(w, curThresholdY);
        ctx.stroke();
        ctx.fillStyle = '#f97316';
        ctx.font = '10px monospace';
        ctx.fillText('CRITICAL STALL: 6.0A', 8, curThresholdY - 4);

        // Reset dash
        ctx.setLineDash([]);

        if (hist.time.length < 2) return;

        const count = hist.time.length;
        const stepX = w / (CONFIG.SIMULATION.MAX_HISTORY_POINTS - 1);

        // Trace 1: Motor Current (Cyan #06b6d4) - Scaled 0 to 10A
        if (this.channelVisibility.current) {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const x = i * stepX;
                const y = h - (hist.current[i] / 10.0) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Trace 2: Motor Temperature (Red/Pink #f43f5e) - Scaled 20 to 100°C
        if (this.channelVisibility.temperature) {
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const x = i * stepX;
                const tempNorm = (hist.temperature[i] - 20.0) / 80.0;
                const y = h - Math.max(0, Math.min(1.0, tempNorm)) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Trace 3: Conveyor RPM (Green #10b981) - Scaled 0 to 120 RPM
        if (this.channelVisibility.rpm) {
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const x = i * stepX;
                const y = h - (Math.abs(hist.rpm[i]) / 120.0) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        // Trace 4: Position Error (Amber #f59e0b) - Scaled 0 to 100%
        if (this.channelVisibility.error) {
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < count; i++) {
                const x = i * stepX;
                const y = h - (hist.error[i] / 100.0) * h;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    /**
     * Appends an industrial timestamped event to the scrollable SCADA log
     */
    addEventLog(eventObj) {
        if (!this.eventLogContainer) return;

        const row = document.createElement('div');
        row.className = `log-row log-${eventObj.level.toLowerCase()}`;

        let badgeClass = 'badge-info';
        if (eventObj.level === 'WARNING') badgeClass = 'badge-warning';
        if (eventObj.level === 'CRITICAL') badgeClass = 'badge-critical';
        if (eventObj.level === 'RECOVERY') badgeClass = 'badge-recovery';

        row.innerHTML = `
            <span class="log-time">${eventObj.timestamp}</span>
            <span class="log-level ${badgeClass}">${eventObj.level}</span>
            <span class="log-msg">${eventObj.message}</span>
        `;

        this.eventLogContainer.insertBefore(row, this.eventLogContainer.firstChild);

        // Keep at most 60 log entries in DOM
        if (this.eventLogContainer.children.length > 60) {
            this.eventLogContainer.removeChild(this.eventLogContainer.lastChild);
        }
    }

    initControlButtons() {
        // E-STOP Mushroom Button
        const estopBtn = document.getElementById('btn-estop');
        if (estopBtn) {
            estopBtn.addEventListener('click', () => {
                window.stateMachine.emergencyStop(window.physicsEngine);
            });
        }

        // Manual Reset
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                window.stateMachine.manualReset(window.physicsEngine);
            });
        }

        // Inject Jam
        const injectJamBtn = document.getElementById('btn-inject-jam');
        if (injectJamBtn) {
            injectJamBtn.addEventListener('click', () => {
                window.physicsEngine.setJam(true);
                window.stateMachine.logEvent('WARNING', 'Operator manually injected mechanical obstruction at pinch point!');
            });
        }

        // Remove Jam
        const removeJamBtn = document.getElementById('btn-remove-jam');
        if (removeJamBtn) {
            removeJamBtn.addEventListener('click', () => {
                window.physicsEngine.setJam(false);
                window.stateMachine.logEvent('INFO', 'Mechanical obstruction cleared manually by operator.');
            });
        }

        // Load Toggle
        const heavyLoadBtn = document.getElementById('btn-heavy-load');
        const normalLoadBtn = document.getElementById('btn-normal-load');
        if (heavyLoadBtn) {
            heavyLoadBtn.addEventListener('click', () => {
                window.physicsEngine.setLoadMode('heavy');
                window.stateMachine.logEvent('INFO', 'Heavy load applied: 45kg cargo pallet on conveyor.');
                heavyLoadBtn.classList.add('active');
                if (normalLoadBtn) normalLoadBtn.classList.remove('active');
            });
        }
        if (normalLoadBtn) {
            normalLoadBtn.addEventListener('click', () => {
                window.physicsEngine.setLoadMode('normal');
                window.stateMachine.logEvent('INFO', 'Normal load restored: 8kg standard cartons.');
                normalLoadBtn.classList.add('active');
                if (heavyLoadBtn) heavyLoadBtn.classList.remove('active');
            });
        }

        // Audio Mute Toggle
        const audioBtn = document.getElementById('btn-audio-toggle');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => {
                const isMuted = window.audioEngine.toggleMute();
                audioBtn.innerHTML = isMuted ? '&#128263; Audio: OFF' : '&#128266; Audio: ON';
                audioBtn.classList.toggle('muted', isMuted);
            });
        }

        // Thermal FLIR Mode Toggle
        const thermalBtn = document.getElementById('btn-thermal-toggle');
        if (thermalBtn) {
            thermalBtn.addEventListener('click', () => {
                const active = !window.conveyorScene.isThermalMode;
                window.conveyorScene.setThermalMode(active);
                thermalBtn.classList.toggle('active', active);
                thermalBtn.innerHTML = active ? '&#128293; Thermal: ON' : '&#128065; Thermal: OFF';
            });
        }

        // Camera Views
        const cameraPresets = ['iso', 'motor', 'jam', 'cabinet', 'top'];
        cameraPresets.forEach(preset => {
            const btn = document.getElementById(`cam-${preset}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    window.conveyorScene.setCameraPreset(preset);
                    cameraPresets.forEach(p => {
                        const b = document.getElementById(`cam-${p}`);
                        if (b) b.classList.remove('active');
                    });
                    btn.classList.add('active');
                });
            }
        });

        // Export Log CSV
        const exportBtn = document.getElementById('btn-export-log');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogCsv());
        }

        // Clear Log
        const clearBtn = document.getElementById('btn-clear-log');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.eventLogContainer) this.eventLogContainer.innerHTML = '';
            });
        }
    }

    /**
     * Initializes Viva / Project Review 1-Click Demonstration Scenarios
     */
    initDemoButtons() {
        // Demo 1: Normal Operation
        const d1 = document.getElementById('demo-1');
        if (d1) {
            d1.addEventListener('click', () => {
                window.stateMachine.manualReset(window.physicsEngine);
                window.physicsEngine.setLoadMode('normal');
                window.stateMachine.logEvent('INFO', '[DEMO 1] NORMAL OPERATION STARTED. Conveyor moving at 100 RPM, current ~2.4A, startup inrush safely passed.');
            });
        }

        // Demo 2: Heavy Load (No False Alarm)
        const d2 = document.getElementById('demo-2');
        if (d2) {
            d2.addEventListener('click', () => {
                window.stateMachine.manualReset(window.physicsEngine);
                window.physicsEngine.setLoadMode('heavy');
                window.stateMachine.logEvent('INFO', '[DEMO 2] HEAVY LOAD APPLIED (45kg). Current rises to 4.2A, conveyor slows to 70 RPM. Position error ~15%. NO FALSE ALARM generated!');
            });
        }

        // Demo 3: Temporary Jam & Automatic Safe Recovery
        const d3 = document.getElementById('demo-3');
        if (d3) {
            d3.addEventListener('click', () => {
                window.stateMachine.manualReset(window.physicsEngine);
                window.isPermanentJam = false; // Jam can be dislodged in step 3
                window.physicsEngine.setJam(true);
                window.stateMachine.logEvent('WARNING', '[DEMO 3] TEMPORARY JAM INJECTED. Watch 3-second debounce timer count up, declare STALL, cut PWM, reverse to eject jam, and safely restore NORMAL!');
            });
        }

        // Demo 4: Permanent Jam & 3x Retry Lockout
        const d4 = document.getElementById('demo-4');
        if (d4) {
            d4.addEventListener('click', () => {
                window.stateMachine.manualReset(window.physicsEngine);
                window.isPermanentJam = true; // Cannot be dislodged automatically
                window.physicsEngine.setJam(true);
                window.stateMachine.logEvent('CRITICAL', '[DEMO 4] PERMANENT JAM INJECTED. System will execute 3 recovery retries, each failing, then trigger Emergency LOCKOUT with Siren!');
            });
        }
    }

    initVivaModal() {
        const modal = document.getElementById('viva-modal');
        const openBtn = document.getElementById('btn-open-viva');
        const closeBtn = document.getElementById('btn-close-viva');

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => {
                modal.classList.add('modal-visible');
            });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('modal-visible');
            });
        }
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('modal-visible');
            });
        }

        // Viva modal tabs
        const tabs = ['code', 'theory', 'architecture'];
        tabs.forEach(tab => {
            const btn = document.getElementById(`tab-btn-${tab}`);
            const pane = document.getElementById(`tab-pane-${tab}`);
            if (btn && pane) {
                btn.addEventListener('click', () => {
                    tabs.forEach(t => {
                        const b = document.getElementById(`tab-btn-${t}`);
                        const p = document.getElementById(`tab-pane-${t}`);
                        if (b) b.classList.remove('active');
                        if (p) p.classList.remove('active');
                    });
                    btn.classList.add('active');
                    pane.classList.add('active');
                });
            }
        });
    }

    exportLogCsv() {
        if (!this.eventLogContainer) return;
        const rows = this.eventLogContainer.querySelectorAll('.log-row');
        let csv = 'Timestamp,Level,Message\n';
        rows.forEach(r => {
            const time = r.querySelector('.log-time')?.innerText || '';
            const level = r.querySelector('.log-level')?.innerText || '';
            const msg = (r.querySelector('.log-msg')?.innerText || '').replace(/"/g, '""');
            csv += `"${time}","${level}","${msg}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `torqueguard_scada_log_${Date.now()}.csv`;
        link.click();
    }
}

// Global instance
window.TorqueGuardDashboard = TorqueGuardDashboard;
