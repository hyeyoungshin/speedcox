// My notes:
// Services contain business logic that:

// Uses models (workout.js, sensors.js) for state
// Uses utils (calculations.js, config.js) for calculations
// Provides clean APIs for controllers to call
// Handles complex algorithms separately from UI code


/**
 * Speedcox - Stroke Detection Service
 * Core algorithms for detecting rowing strokes via motion sensors and GPS
 */


import { 
    calculateAccelerationMagnitude,
    calculateAverage,
    calculateStrokeRate,
    isSpeedPeak 
} from '../utils/calculations.js';

import { 
    MOTION_CONFIG, 
    GPS_STROKE_CONFIG 
} from '../utils/config.js';

/* =============================================================================
 * MOTION-BASED STROKE DETECTION SERVICE
 * ============================================================================= */

/**
 * Detects rowing strokes from accelerometer data
 * 
 * ALGORITHM OVERVIEW:
 * 1. Maintains a history of acceleration measurements
 * 2. Calculates baseline (average) acceleration
 * 3. Detects "spikes" significantly above baseline
 * 4. Filters out double-detections with timing threshold
 * 5. Calculates real-time stroke rate
 * 
 * This service encapsulates the stroke detection logic that was previously
 * embedded in the motion sensor event handler.
 */
const MotionStrokeDetection = {
    
    /**
     * Analyzes acceleration data to detect a rowing stroke
     * 
     * HOW STROKE DETECTION WORKS:
     * 1. Collects acceleration data from phone's motion sensors
     * 2. Looks for "spikes" in acceleration (sudden movements)
     * 3. A spike significantly higher than baseline = one stroke
     * 4. Prevents counting same stroke twice with timing filter
     * 
     * CALIBRATION:
     * - Threshold of 4 works well for boat-mounted devices
     * - Minimum 800ms between strokes prevents double-counting
     * - Uses 10-second window for immediate stroke rate response
     * 
     * @param {Array} accelerationHistory - Recent acceleration data points [{magnitude, timestamp}]
     * @param {number} currentMagnitude - Current acceleration magnitude
     * @param {number} timestamp - Current timestamp
     * @param {number} lastStrokeTime - Timestamp of last detected stroke
     * @returns {Object|null} Stroke detection result or null if no stroke
     *   {
     *     detected: true,
     *     strokeRate: number,
     *     timestamp: number,
     *     recentStrokeCount: number
     *   }
     */
    detectStroke(accelerationHistory, currentMagnitude, timestamp, lastStrokeTime) {
        // STEP 1: Need enough data to establish baseline
        if (accelerationHistory.length < MOTION_CONFIG.BASELINE_SAMPLE_SIZE) {
            return null;
        }
        
        // STEP 2: Calculate baseline (what's normal boat movement?)
        const recentData = accelerationHistory.slice(-MOTION_CONFIG.BASELINE_SAMPLE_SIZE);
        const avgMagnitude = calculateAverage(recentData.map(d => d.magnitude));
        
        // STEP 3: Set detection threshold
        const threshold = avgMagnitude + MOTION_CONFIG.ACCELERATION_THRESHOLD;
        
        // STEP 4: Check if current movement qualifies as a stroke
        const isSignificantMotion = currentMagnitude > threshold;
        const isNewStroke = timestamp - lastStrokeTime > MOTION_CONFIG.MIN_STROKE_INTERVAL;
        
        if (isSignificantMotion && isNewStroke) {
            // STROKE DETECTED!
            
            // STEP 5: Calculate current stroke rate
            // Count strokes in recent window, extrapolate to per minute
            const windowSize = MOTION_CONFIG.STROKE_RATE_WINDOW;
            const recentStrokes = accelerationHistory.filter(
                a => a.timestamp > timestamp - windowSize &&
                a.magnitude > (avgMagnitude + (MOTION_CONFIG.ACCELERATION_THRESHOLD - 1))
            ).length;
            
            const timeSpanSeconds = windowSize / 1000;
            const strokeRate = calculateStrokeRate(
                recentStrokes, 
                timeSpanSeconds, 
                MOTION_CONFIG.MAX_STROKE_RATE
            );
            
            return {
                detected: true,
                strokeRate: strokeRate,
                timestamp: timestamp,
                recentStrokeCount: recentStrokes,
                avgMagnitude: avgMagnitude,
                threshold: threshold
            };
        }
        
        return null;
    },
    
    /**
     * Validates if acceleration data is sufficient for detection
     * @param {Array} accelerationHistory - Acceleration history array
     * @returns {boolean} True if enough data for detection
     */
    hasEnoughData(accelerationHistory) {
        return accelerationHistory.length >= MOTION_CONFIG.BASELINE_SAMPLE_SIZE;
    },
    
    /**
     * Calculates current baseline acceleration from history
     * @param {Array} accelerationHistory - Recent acceleration data
     * @returns {number} Average baseline magnitude
     */
    calculateBaseline(accelerationHistory) {
        if (accelerationHistory.length < MOTION_CONFIG.BASELINE_SAMPLE_SIZE) {
            return 0;
        }
        const recentData = accelerationHistory.slice(-MOTION_CONFIG.BASELINE_SAMPLE_SIZE);
        return calculateAverage(recentData.map(d => d.magnitude));
    }
};

/* =============================================================================
 * GPS-BASED STROKE DETECTION SERVICE (NK SpeedCoach Method)
 * ============================================================================= */

/**
 * Detects rowing strokes from GPS speed patterns
 * 
 * ALGORITHM OVERVIEW:
 * 1. Analyzes boat speed fluctuations from GPS
 * 2. Speed increases during drive phase (pulling oar)
 * 3. Speed decreases during recovery phase (returning to catch)
 * 4. Detects these peaks/valleys to count strokes
 * 5. Calculates stroke rate from peak timing
 * 
 * This method doesn't require motion sensors - only GPS speed data.
 * More reliable for boat-mounted devices that don't move with rower.
 */
const GPSStrokeDetection = {
    
    /**
     * Analyzes GPS speed patterns to detect rowing strokes
     * 
     * HOW GPS-BASED STROKE DETECTION WORKS:
     * 1. During each rowing stroke, boat speed fluctuates in a pattern
     * 2. Speed increases during drive phase (pulling the oar)
     * 3. Speed decreases during recovery phase (returning to catch)
     * 4. By detecting these speed peaks, we can count strokes
     * 5. Calculate strokes per minute from timing between peaks
     * 
     * @param {Array} speedHistory - Recent speed measurements [{speed, timestamp}]
     * @param {number} currentSpeed - Current boat speed (m/s)
     * @param {number} timestamp - Current timestamp
     * @param {number} lastPeakTime - Timestamp of last detected peak
     * @returns {Object|null} Peak detection result or null if no peak
     *   {
     *     isPeak: true,
     *     speed: number,
     *     timestamp: number,
     *     avgSpeed: number
     *   }
     */
    detectSpeedPeak(speedHistory, currentSpeed, timestamp, lastPeakTime) {
        // Need minimum samples for pattern detection
        if (speedHistory.length < GPS_STROKE_CONFIG.MIN_SAMPLES_FOR_DETECTION) {
            return null;
        }
        
        // Get recent speed history for pattern analysis
        const recentSpeeds = speedHistory.slice(-10);
        const avgSpeed = calculateAverage(recentSpeeds.map(s => s.speed));
        
        // Check if current speed is a peak (local maximum)
        const isPeak = isSpeedPeak(
            currentSpeed, 
            avgSpeed, 
            GPS_STROKE_CONFIG.PEAK_THRESHOLD_MULTIPLIER
        );
        
        // Check if this is a new peak (not same peak as before)
        const isNewPeak = timestamp - lastPeakTime > GPS_STROKE_CONFIG.MIN_TIME_BETWEEN_PEAKS;
        
        if (isPeak && isNewPeak) {
            return {
                isPeak: true,
                speed: currentSpeed,
                timestamp: timestamp,
                avgSpeed: avgSpeed
            };
        }
        
        return null;
    },
    
    /**
     * Calculates stroke rate from detected speed peaks
     * 
     * @param {Array} speedPeaks - Array of detected peaks [{speed, timestamp}]
     * @returns {number} Calculated stroke rate in SPM, or 0 if insufficient data
     */
    calculateStrokeRateFromPeaks(speedPeaks) {
        if (speedPeaks.length < GPS_STROKE_CONFIG.MIN_PEAKS_FOR_RATE) {
            return 0;
        }
        
        // Get time span of peaks
        const oldestPeak = speedPeaks[0].timestamp;
        const newestPeak = speedPeaks[speedPeaks.length - 1].timestamp;
        const timeSpanSeconds = (newestPeak - oldestPeak) / 1000;
        
        // Calculate rate: (number of strokes) / (time in minutes)
        const strokeCount = speedPeaks.length - 1; // -1 because first peak is starting point
        
        return calculateStrokeRate(
            strokeCount, 
            timeSpanSeconds, 
            GPS_STROKE_CONFIG.MAX_GPS_STROKE_RATE
        );
    },
    
    /**
     * Validates if speed data is sufficient for peak detection
     * @param {Array} speedHistory - Speed history array
     * @returns {boolean} True if enough data for detection
     */
    hasEnoughData(speedHistory) {
        return speedHistory.length >= GPS_STROKE_CONFIG.MIN_SAMPLES_FOR_DETECTION;
    },
    
    /**
     * Calculates average speed from history
     * @param {Array} speedHistory - Recent speed data
     * @returns {number} Average speed in m/s
     */
    calculateAverageSpeed(speedHistory) {
        if (speedHistory.length === 0) return 0;
        return calculateAverage(speedHistory.map(s => s.speed));
    }
};

/* =============================================================================
 * UNIFIED STROKE DETECTION SERVICE
 * ============================================================================= */

/**
 * Main stroke detection service that coordinates both methods
 * Provides a unified interface for the controllers to use
 */
const StrokeDetectionService = {
    motion: MotionStrokeDetection,
    gps: GPSStrokeDetection,
    
    /**
     * Gets stroke rate based on selected method
     * @param {string} method - 'motion', 'gps', or 'both'
     * @param {number} motionRate - Current motion-based rate
     * @param {number} gpsRate - Current GPS-based rate
     * @returns {number|Object} Stroke rate or {motion, gps} if 'both'
     */
    getCurrentRate(method, motionRate, gpsRate) {
        if (method === 'motion') {
            return motionRate;
        } else if (method === 'gps') {
            return gpsRate;
        } else if (method === 'both') {
            return { motion: motionRate, gps: gpsRate };
        }
        return 0;
    }
};

export default StrokeDetectionService;
