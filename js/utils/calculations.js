/**
 * Speedcox - Calculation Utilities
 * Pure functions for distance, time, and performance calculations
 */

/**
 * Calculates distance between two GPS coordinates
 * Uses the Haversine formula to account for Earth's curvature
 * 
 * HAVERSINE FORMULA EXPLANATION:
 * - Calculates shortest distance over Earth's surface (great-circle distance)
 * - More accurate than simple Pythagorean theorem for GPS coordinates
 * - Essential for rowing where distances can be several kilometers
 * 
 * @param {Object} pos1 - First position {lat, lng}
 * @param {Object} pos2 - Second position {lat, lng}
 * @returns {number} Distance in meters
 */
export function calculateDistance(pos1, pos2) {
    const R = 6371000; // Earth's radius in meters
    
    // Convert latitude/longitude differences to radians
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    
    // Haversine formula
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
}

/**
 * Formats time in seconds to MM:SS format
 * 
 * EXAMPLES:
 * - 65 seconds → "1:05"
 * - 125 seconds → "2:05"  
 * - 3661 seconds → "61:01" (handles times over 1 hour)
 * 
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2:30")
 */
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`; // Ensures 2-digit seconds
}

/**
 * Calculates split time (500m pace) from average speed
 * 
 * SPLIT TIME EXPLAINED:
 * - Standard rowing metric: time to row 500 meters at current pace
 * - Lower split = faster rowing
 * - Example: 2:00 split means you'd row 500m in 2 minutes at this pace
 * 
 * @param {number} avgSpeed - Average speed in meters per second
 * @returns {number|null} Split time in seconds, or null if speed is 0
 */
export function calculateSplit(avgSpeed) {
    if (avgSpeed <= 0) return null;
    return 500 / avgSpeed; // Time to row 500m at this speed
}

/**
 * Calculates average from an array of values
 * 
 * @param {Array<number>} values - Array of numeric values
 * @returns {number} Average value, or 0 if array is empty
 */
export function calculateAverage(values) {
    if (values.length === 0) return 0;
    const sum = values.reduce((total, val) => total + val, 0);
    return sum / values.length;
}

/**
 * Calculates total acceleration magnitude from x, y, z components
 * 
 * HOW IT WORKS:
 * - Combines acceleration from all three axes using Pythagorean theorem in 3D
 * - Result is orientation-independent (doesn't matter how phone is held)
 * - Essential for detecting rowing motion regardless of device mounting
 * 
 * @param {number} x - Acceleration in x-axis (left/right)
 * @param {number} y - Acceleration in y-axis (forward/back)
 * @param {number} z - Acceleration in z-axis (up/down)
 * @returns {number} Total acceleration magnitude
 */
export function calculateAccelerationMagnitude(x, y, z) {
    return Math.sqrt(
        Math.pow(x || 0, 2) +
        Math.pow(y || 0, 2) +
        Math.pow(z || 0, 2)
    );
}

/**
 * Filters out GPS noise by checking movement thresholds
 * 
 * GPS NOISE FILTERING:
 * - GPS naturally drifts ±5-10 meters even when stationary
 * - We filter out movements that are:
 *   A) Too small (< 3 meters) - likely GPS drift
 *   B) Too slow (< 0.5 m/s) - also likely drift
 * - Only real rowing movement passes through
 * 
 * @param {number} distance - Distance moved in meters
 * @param {number} speed - Speed in meters per second
 * @param {number} minDistance - Minimum distance threshold (default: 3m)
 * @param {number} minSpeed - Minimum speed threshold (default: 0.5 m/s)
 * @returns {boolean} True if movement is real (not GPS noise)
 */
export function isRealMovement(distance, speed, minDistance = 3, minSpeed = 0.5) {
    return distance > minDistance && speed >= minSpeed;
}

/**
 * Calculates stroke rate from stroke count and time span
 * 
 * @param {number} strokeCount - Number of strokes detected
 * @param {number} timeSpanSeconds - Time period in seconds
 * @param {number} maxRate - Maximum allowed rate (default: 40 SPM)
 * @returns {number} Stroke rate in strokes per minute
 */
export function calculateStrokeRate(strokeCount, timeSpanSeconds, maxRate = 40) {
    if (timeSpanSeconds <= 0) return 0;
    const rate = Math.round((strokeCount / timeSpanSeconds) * 60);
    return Math.min(rate, maxRate); // Cap at maximum
}

/**
 * Checks if a value is a speed peak (local maximum)
 * 
 * PEAK DETECTION:
 * - Used for GPS-based stroke detection
 * - A peak = speed significantly higher than recent average
 * - Represents the drive phase of a rowing stroke
 * 
 * @param {number} currentSpeed - Current speed value
 * @param {number} avgSpeed - Average of recent speeds
 * @param {number} threshold - Peak threshold multiplier (default: 1.1 = 10% above avg)
 * @returns {boolean} True if current speed is a peak
 */
export function isSpeedPeak(currentSpeed, avgSpeed, threshold = 1.1) {
    return currentSpeed > (avgSpeed * threshold);
}

/**
 * Rounds a number to specified decimal places
 * 
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} Rounded value
 */
export function roundTo(value, decimals = 2) {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
}
