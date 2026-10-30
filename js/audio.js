/**
 * TORQUEGUARD 3D - Industrial Web Audio Synthesizer
 * Real-time procedural audio simulation for industrial motors, relays, buzzers & emergency sirens
 */

class IndustrialAudioEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.isInitialized = false;

        // Motor sound nodes
        this.motorOsc = null;
        this.motorSubOsc = null;
        this.motorGain = null;
        this.motorFilter = null;

        // Alarm & Siren nodes
        this.alarmInterval = null;
        this.sirenOsc = null;
        this.sirenGain = null;
        this.sirenLfo = null;

        // Current playing state
        this.currentAlarmState = null;
    }

    init() {
        if (this.isInitialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.setupMotorSynth();
            this.isInitialized = true;
            console.log("[Audio] Industrial Audio Engine Initialized");
        } catch (e) {
            console.warn("[Audio] Web Audio API failed to initialize:", e);
        }
    }

    setupMotorSynth() {
        if (!this.ctx) return;

        // Main motor whir
        this.motorOsc = this.ctx.createOscillator();
        this.motorOsc.type = 'sawtooth';
        this.motorOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

        // Sub harmonic hum
        this.motorSubOsc = this.ctx.createOscillator();
        this.motorSubOsc.type = 'triangle';
        this.motorSubOsc.frequency.setValueAtTime(90, this.ctx.currentTime);

        // Lowpass filter to simulate enclosed cast-iron motor frame
        this.motorFilter = this.ctx.createBiquadFilter();
        this.motorFilter.type = 'lowpass';
        this.motorFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
        this.motorFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

        // Motor gain
        this.motorGain = this.ctx.createGain();
        this.motorGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

        // Connect
        this.motorOsc.connect(this.motorFilter);
        this.motorSubOsc.connect(this.motorFilter);
        this.motorFilter.connect(this.motorGain);
        this.motorGain.connect(this.ctx.destination);

        this.motorOsc.start();
        this.motorSubOsc.start();
    }

    ensureContext() {
        if (!this.isInitialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.ensureContext();
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            if (this.motorGain) this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);
            this.stopAlarms();
        }
        return this.isMuted;
    }

    setMute(state) {
        this.ensureContext();
        this.isMuted = state;
        if (this.isMuted) {
            if (this.motorGain) this.motorGain.gain.setValueAtTime(0, this.ctx.currentTime);
            this.stopAlarms();
        }
    }

    /**
     * Updates motor acoustics based on live RPM and load
     */
    updateMotorSound(rpm, current, isStalled) {
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const absRpm = Math.abs(rpm);

        if (absRpm < 1.0 || isStalled) {
            // Stalled hum or stopped
            if (isStalled && current > 5.0) {
                // High-current 50/60Hz electromagnetic line hum from locked rotor
                this.motorOsc.frequency.setTargetAtTime(60, now, 0.05);
                this.motorSubOsc.frequency.setTargetAtTime(120, now, 0.05);
                this.motorFilter.frequency.setTargetAtTime(400, now, 0.05);
                this.motorGain.gain.setTargetAtTime(0.12, now, 0.05); // Straining hum
            } else {
                this.motorGain.gain.setTargetAtTime(0.001, now, 0.1);
            }
        } else {
            // Running motor pitch scales with RPM
            const targetFreq = 40 + (absRpm / 100.0) * 80; // 40Hz to 120Hz fundamental
            this.motorOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
            this.motorSubOsc.frequency.setTargetAtTime(targetFreq * 2, now, 0.08);

            // Filter opens with speed
            const cutoff = 240 + (absRpm / 100.0) * 200;
            this.motorFilter.frequency.setTargetAtTime(cutoff, now, 0.08);

            // Target volume
            const targetVol = 0.08 + (current / 8.0) * 0.04;
            this.motorGain.gain.setTargetAtTime(targetVol, now, 0.08);
        }
    }

    /**
     * Plays a crisp mechanical relay click sound
     */
    playRelayClick() {
        if (!this.ctx || this.isMuted) return;
        this.ensureContext();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.03);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
    }

    /**
     * Plays industrial buzzer / warning beep (intermittent beep-beep)
     */
    playWarningBeep() {
        if (!this.ctx || this.isMuted) return;
        this.ensureContext();

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(960, now);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.13);
    }

    /**
     * Starts active alarm depending on system state
     */
    setAlarmState(state) {
        if (this.currentAlarmState === state) return;
        this.currentAlarmState = state;
        this.stopAlarms();

        if (this.isMuted) return;
        this.ensureContext();

        if (state === 'SUSPECT') {
            // Intermittent warning beep every 600ms
            this.playWarningBeep();
            this.alarmInterval = setInterval(() => {
                if (!this.isMuted) this.playWarningBeep();
            }, 600);
        } else if (state === 'STALL') {
            // Urgent continuous pulsing alarm (1150Hz)
            this.alarmInterval = setInterval(() => {
                if (!this.isMuted && this.ctx) {
                    const now = this.ctx.currentTime;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(1250, now);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start(now);
                    osc.stop(now + 0.2);
                }
            }, 250);
        } else if (state === 'LOCKOUT') {
            // Full industrial emergency dual-tone siren
            this.startEmergencySiren();
        }
    }

    startEmergencySiren() {
        if (!this.ctx || this.isMuted) return;
        this.stopAlarms();

        const now = this.ctx.currentTime;
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sawtooth';

        // LFO sweeps between 650Hz and 1100Hz
        this.sirenLfo = this.ctx.createOscillator();
        this.sirenLfo.frequency.setValueAtTime(1.5, now); // 1.5 Hz siren cycle

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(260, now);

        this.sirenOsc.frequency.setValueAtTime(850, now);
        this.sirenLfo.connect(lfoGain);
        lfoGain.connect(this.sirenOsc.frequency);

        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.setValueAtTime(0.18, now);

        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.ctx.destination);

        this.sirenLfo.start(now);
        this.sirenOsc.start(now);
    }

    stopAlarms() {
        if (this.alarmInterval) {
            clearInterval(this.alarmInterval);
            this.alarmInterval = null;
        }
        if (this.sirenOsc) {
            try {
                this.sirenOsc.stop();
                this.sirenLfo.stop();
                this.sirenOsc.disconnect();
                this.sirenGain.disconnect();
            } catch (e) {}
            this.sirenOsc = null;
            this.sirenLfo = null;
            this.sirenGain = null;
        }
    }

    playSuccessChime() {
        if (!this.ctx || this.isMuted) return;
        this.ensureContext();

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const now = this.ctx.currentTime + idx * 0.08;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.26);
        });
    }

    playJamImpactSound() {
        if (!this.ctx || this.isMuted) return;
        this.ensureContext();

        const now = this.ctx.currentTime;
        // Heavy metallic crunch & thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

// Global instance
window.audioEngine = new IndustrialAudioEngine();
