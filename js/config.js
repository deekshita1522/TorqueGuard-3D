/**
 * TORQUEGUARD 3D - System Configuration & Industrial Parameters
 * Standard industrial constants for 24V DC Conveyor Actuator Cell
 */

const CONFIG = {
    // -------------------------------------------------------------
    // Electrical & Motor Parameters (24V DC Industrial Actuator)
    // -------------------------------------------------------------
    MOTOR: {
        RATED_VOLTAGE: 24.0,       // Volts DC
        RATED_CURRENT: 2.5,        // Amperes (nominal operating current)
        MAX_SAFE_CURRENT: 5.0,     // Amperes (heavy load safe boundary)
        CRITICAL_CURRENT: 6.0,     // Amperes (stall condition threshold)
        DANGEROUS_CURRENT: 8.0,    // Amperes (dangerous short-circuit / hard lock)
        ARMATURE_RESISTANCE: 1.2,  // Ohms (R_a)
        ARMATURE_INDUCTANCE: 0.008,// Henries (L_a)
        TORQUE_CONSTANT_KT: 0.18,  // Nm / A (K_t)
        BACK_EMF_KE: 0.18,         // V / (rad/s) (K_e)
        ROTOR_INERTIA: 0.025,      // kg*m^2 (J_rotor)
        VISCOUS_FRICTION: 0.015,   // N*m*s/rad (b)
        GEARBOX_RATIO: 15.0,       // 15:1 planetary reduction
        INRUSH_PEAK_FACTOR: 3.2,   // Initial startup inrush multiplier (~8.0A peak)
        INRUSH_DECAY_TIME: 0.35    // Inrush decay time constant (seconds)
    },

    // -------------------------------------------------------------
    // Mechanical & Conveyor Speed Parameters
    // -------------------------------------------------------------
    CONVEYOR: {
        NORMAL_RPM: 100.0,         // Nominal roller speed (RPM)
        HEAVY_LOAD_RPM: 70.0,      // Slower speed under heavy 45kg load
        STALL_RPM_THRESHOLD: 5.0,  // Max RPM considered stalled (< 5 RPM)
        ROLLER_DIAMETER_MM: 80.0,  // Drive roller diameter in mm
        BELT_LENGTH_M: 4.5,        // Conveyor belt length in meters
        NORMAL_LOAD_KG: 8.0,       // Normal carton load
        HEAVY_LOAD_KG: 45.0,       // Heavy cargo load
        MAX_LOAD_TORQUE: 4.5       // Load torque in Nm
    },

    // -------------------------------------------------------------
    // Optical Rotary Encoder Parameters
    // -------------------------------------------------------------
    ENCODER: {
        PULSES_PER_REV: 1024,      // Optical incremental quadrature encoder (PPR)
        SAMPLE_PERIOD_MS: 50,      // 50ms sampling window (20 Hz MCU velocity task)
        POSITION_ERROR_THRESHOLD: 25.0 // Error % > 25% flags suspect/stall
    },

    // -------------------------------------------------------------
    // Thermal Model Parameters (Lumped Capacitance ODE)
    // -------------------------------------------------------------
    THERMAL: {
        AMBIENT_TEMP: 35.0,        // Ambient factory temperature (°C)
        NORMAL_MAX_TEMP: 50.0,     // Normal upper bound (°C)
        WARNING_TEMP: 65.0,        // Warning threshold (°C)
        CRITICAL_TEMP: 80.0,       // Critical threshold (°C)
        EMERGENCY_TEMP: 88.0,      // Emergency thermal cutout (°C)
        THERMAL_RESISTANCE: 1.85,  // °C/W (dissipation resistance)
        THERMAL_CAPACITANCE: 120.0,// J/°C (thermal mass)
        FAN_COOLING_FACTOR: 0.6    // Convection boost factor when motor rotates
    },

    // -------------------------------------------------------------
    // Stall Detection Multi-Factor Rule Matrix
    // -------------------------------------------------------------
    STALL_DETECTION: {
        CURRENT_THRESHOLD: 6.0,    // Current > 6.0A
        RPM_THRESHOLD: 5.0,        // RPM < 5.0
        POSITION_CHANGE_MIN: 0,    // Encoder position delta == 0
        POSITION_ERROR_MIN: 25.0,  // Position error > 25%
        PERSISTENCE_TIME_SEC: 3.0  // Persistence timer duration (3.0 seconds)
    },

    // -------------------------------------------------------------
    // Automatic Recovery Strategy
    // -------------------------------------------------------------
    RECOVERY: {
        MAX_ATTEMPTS: 3,           // Up to 3 recovery retries before LOCKOUT
        STEP1_PWM_STOP: 0.1,       // Immediate PWM disable duration (s)
        STEP2_WAIT_COOLDOWN: 2.0,  // Wait 2.0 seconds cooldown & back-EMF dissipate
        STEP3_REVERSE_DURATION: 1.0,// Reverse conveyor for 1.0 second
        STEP3_REVERSE_RPM: -30.0,  // Reversal speed (RPM)
        STEP4_RESTART_DURATION: 1.5,// Re-acceleration forward window (s)
        STEP5_VERIFY_WINDOW: 1.0   // Verification window for encoder ticks
    },

    // -------------------------------------------------------------
    // Industrial Alarm & UI Color Codes (IEC 60073 / SCADA Standards)
    // -------------------------------------------------------------
    COLORS: {
        NORMAL: '#10b981',         // Green (Healthy)
        SUSPECT: '#f59e0b',        // Yellow/Amber (Warning)
        STALL: '#f97316',          // Orange (Stall Detected)
        LOCKOUT: '#ef4444',        // Red (Emergency / Lockout)
        RECOVERY: '#3b82f6',       // Blue (Automated Recovery Active)
        ESTOP: '#dc2626',          // Dark Red
        BG_DARK: '#0b111e',        // Industrial SCADA Dark Slate
        PANEL_BG: '#131e32',       // Brushed metal dark panel
        ACCENT_CYAN: '#06b6d4',     // Telemetry accent
        GRID_LINES: '#1e293b'
    },

    // -------------------------------------------------------------
    // System Timing & Simulation Rate
    // -------------------------------------------------------------
    SIMULATION: {
        TIME_STEP_SEC: 0.02,       // 50 Hz physics update loop (20ms)
        MAX_HISTORY_POINTS: 120,   // Rolling chart history length
        CHART_REFRESH_RATE_MS: 60  // Smooth graph update
    }
};

// Export to window for global access
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
