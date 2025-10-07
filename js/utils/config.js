/**
 * Speedcox - Configuration Constants
 * Central location for all app configuration values and thresholds
 */

/* =============================================================================
 * GPS & DISTANCE TRACKING CONFIGURATION
 * ============================================================================= */

export const GPS_CONFIG = {
    // GPS tracking options
    ENABLE_HIGH_ACCURACY: true,  // Use GPS satellites, not just cell towers
    MAXIMUM_AGE: 1000,           // Accept positions up to 1 second old (ms)
    TIMEOUT: 10000,              // Give up waiting for GPS after 10 seconds (ms)
    
    // GPS noise filtering thresholds
    MIN_DISTANCE: 3,             // Minimum distance to count as real movement (meters)
    MIN_SPEED: 0.5,              // Minimum speed to count as real movement (m/s ≈ 1 knot)
    
    // Data retention
    SPEED_HISTORY_WINDOW: 30000, // Keep last 30 seconds of speed data (ms)
};

/* =============================================================================
 * MOTION SENSOR CONFIGURATION
 * ============================================================================= */

export const MOTION_CONFIG = {
    // Stroke detection thresholds
    ACCELERATION_THRESHOLD: 4,    // Amount above baseline to detect stroke
    MIN_STROKE_INTERVAL: 800,     // Minimum time between strokes (ms) - prevents double-counting
    
    // Data retention
    ACCELERATION_HISTORY_WINDOW: 10000,  // Keep last 10 seconds of acceleration (ms)
    BASELINE_SAMPLE_SIZE: 20,            // Number of samples to calculate baseline
    
    // Stroke rate calculation
    STROKE_RATE_WINDOW: 10000,    // Calculate rate from last 10 seconds (ms)
    STROKE_TIMES_RETENTION: 120000, // Keep 2 minutes of stroke history (ms)
    MAX_STROKE_RATE: 40,          // Maximum reasonable stroke rate (SPM)
};

/* =============================================================================
 * GPS-BASED STROKE DETECTION (NK SpeedCoach Method)
 * ============================================================================= */

export const GPS_STROKE_CONFIG = {
    // Speed peak detection
    PEAK_THRESHOLD_MULTIPLIER: 1.1,  // Speed must be 10% above average to be a peak
    MIN_SAMPLES_FOR_DETECTION: 5,    // Need at least 5 speed readings to detect patterns
    MIN_TIME_BETWEEN_PEAKS: 1000,    // Minimum 1 second between stroke peaks (ms)
    
    // Data retention
    PEAK_HISTORY_WINDOW: 30000,      // Keep last 30 seconds of peaks (ms)
    MIN_PEAKS_FOR_RATE: 2,           // Need at least 2 peaks to calculate rate
    
    // Limits
    MAX_GPS_STROKE_RATE: 40,         // Maximum reasonable GPS-detected rate (SPM)
};

/* =============================================================================
 * AUDIO ANNOUNCEMENTS
 * ============================================================================= */

export const AUDIO_CONFIG = {
    // Voice settings
    DEFAULT_VOICE_RATE: 1.0,     // Normal speech speed
    VOLUME: 0.8,                 // Slightly quieter than max (0.0 - 1.0)
    
    // Announcement intervals (in seconds, 0 = disabled)
    STROKE_RATE_INTERVALS: [0, 30, 60, 120, 300],  // Off, 30s, 1min, 2min, 5min
    SPLIT_TIME_INTERVALS: [0, 30, 60, 120, 300],   // Off, 30s, 1min, 2min, 5min
};

/* =============================================================================
 * DISPLAY & UI CONFIGURATION
 * ============================================================================= */

export const DISPLAY_CONFIG = {
    // Update intervals
    DISPLAY_UPDATE_INTERVAL: 100,  // Update display every 100ms
    LOG_INTERVAL: 5,               // Log status every 5 seconds (for debugging)
    
    // Stroke rate display methods
    STROKE_RATE_METHODS: {
        GPS: 'gps',
        MOTION: 'motion',
        BOTH: 'both'
    },
    
    DEFAULT_STROKE_METHOD: 'gps',  // Default to GPS method (like NK SpeedCoach)
};

/* =============================================================================
 * PERFORMANCE & CALCULATIONS
 * ============================================================================= */

export const PERFORMANCE_CONFIG = {
    // Standard rowing metrics
    SPLIT_DISTANCE: 500,          // Standard split is per 500 meters
    
    // Earth measurements (for distance calculations)
    EARTH_RADIUS_METERS: 6371000, // Earth's radius for Haversine formula
};

/* =============================================================================
 * WORKOUT SUMMARY
 * ============================================================================= */

export const SUMMARY_CONFIG = {
    // What data to include in summary
    SHOW_TOTAL_DISTANCE: true,
    SHOW_ELAPSED_TIME: true,
    SHOW_AVG_STROKE_RATE: true,
    SHOW_AVG_SPLIT: true,
    
    // Formatting
    DISTANCE_UNIT: 'meters',      // Could be 'meters' or 'kilometers'
    ROUND_DISTANCE: true,         // Round to nearest meter
};

/* =============================================================================
 * DEBUGGING & LOGGING
 * ============================================================================= */

export const DEBUG_CONFIG = {
    ENABLE_CONSOLE_LOGS: true,     // Set to false to disable all console logs
    LOG_GPS_UPDATES: true,         // Log GPS position updates
    LOG_MOTION_EVENTS: true,       // Log motion sensor events
    LOG_STROKE_DETECTION: true,    // Log when strokes are detected
    LOG_AUDIO_ANNOUNCEMENTS: true, // Log audio announcements
};

/* =============================================================================
 * HELPER FUNCTIONS FOR CONFIG ACCESS
 * ============================================================================= */

/**
 * Gets GPS tracking options object for geolocation API
 * @returns {Object} GPS options for navigator.geolocation.watchPosition
 */
export function getGPSOptions() {
    return {
        enableHighAccuracy: GPS_CONFIG.ENABLE_HIGH_ACCURACY,
        maximumAge: GPS_CONFIG.MAXIMUM_AGE,
        timeout: GPS_CONFIG.TIMEOUT
    };
}

/**
 * Gets current stroke rate method from config
 * @returns {string} 'gps', 'motion', or 'both'
 */
export function getDefaultStrokeMethod() {
    return DISPLAY_CONFIG.DEFAULT_STROKE_METHOD;
}

/**
 * Checks if a feature is enabled for debugging
 * @param {string} feature - Feature name (e.g., 'LOG_GPS_UPDATES')
 * @returns {boolean} True if feature is enabled
 */
export function isDebugEnabled(feature) {
    return DEBUG_CONFIG.ENABLE_CONSOLE_LOGS && DEBUG_CONFIG[feature];
}
