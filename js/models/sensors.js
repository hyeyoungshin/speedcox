/**
 * Sensor Data Model
 * Manages motion sensor and GPS stroke detection data
 */

const SensorModel = {
    // Motion sensor state
    motionPermission: false,   // Do we have permission to use motion sensors?
    accelerationHistory: [],
    lastStrokeDetection: 0,
    currentStrokeRate: 0,      // Current calculated stroke rate
    
    // GPS-based stroke detection state
    gpsStrokeRate: 0,          // Stroke rate calculated from GPS speed patterns
    speedPeaks: [],
    lastSpeedPeak: 0,
    
    // Detection method selection
    strokeRateMethod: 'gps', // 'gps', 'motion', or 'both'
    
    /**
     * Enable motion sensors
     */
    enableMotion() {
        this.motionPermission = true;
        console.log('Sensor model: Motion sensors enabled');
    },
    
    /**
     * Disable motion sensors
     */
    disableMotion() {
        this.motionPermission = false;
        console.log('Sensor model: Motion sensors disabled');
    },
    
    /**
     * Check if motion sensors are enabled
     * @returns {Boolean}
     */
    isMotionEnabled() {
        return this.motionPermission;
    },
    
    /**
     * Add acceleration data point
     * @param {Number} magnitude - Acceleration magnitude
     * @param {Number} timestamp - Timestamp
     */
    addAcceleration(magnitude, timestamp) {
        this.accelerationHistory.push({ magnitude, timestamp });
        
        // Keep only last 10 seconds of data
        const cutoff = timestamp - 10000;
        this.accelerationHistory = this.accelerationHistory.filter(a => a.timestamp > cutoff);
    },
    
    /**
     * Get recent acceleration data
     * @param {Number} count - Number of recent readings to get
     * @returns {Array} Recent acceleration readings
     */
    getRecentAcceleration(count = 20) {
        return this.accelerationHistory.slice(-count);
    },
    
    /**
     * Calculate average acceleration magnitude
     * @returns {Number} Average magnitude
     */
    getAverageAcceleration() {
        const recent = this.getRecentAcceleration();
        if (recent.length === 0) return 0;
        return recent.reduce((sum, a) => sum + a.magnitude, 0) / recent.length;
    },
    
    /**
     * Update motion-based stroke rate
     * @param {Number} rate - New stroke rate
     */
    setMotionStrokeRate(rate) {
        this.currentStrokeRate = rate;
    },
    
    /**
     * Get current motion-based stroke rate
     * @returns {Number} Current stroke rate
     */
    getMotionStrokeRate() {
        return this.currentStrokeRate;
    },
    
    /**
     * Record stroke detection time
     * @param {Number} timestamp - When stroke was detected
     */
    recordStrokeDetection(timestamp) {
        this.lastStrokeDetection = timestamp;
    },
    
    /**
     * Get time since last stroke detection
     * @param {Number} currentTime - Current timestamp
     * @returns {Number} Milliseconds since last detection
     */
    getTimeSinceLastStroke(currentTime) {
        return currentTime - this.lastStrokeDetection;
    },
    
    /**
     * Add GPS speed peak
     * @param {Number} speed - Speed value
     * @param {Number} timestamp - Timestamp
     */
    addSpeedPeak(speed, timestamp) {
        this.speedPeaks.push({ speed, timestamp });
        this.lastSpeedPeak = timestamp;
        
        // Keep only last 30 seconds of peaks
        const cutoff = timestamp - 30000;
        this.speedPeaks = this.speedPeaks.filter(p => p.timestamp > cutoff);
    },
    
    /**
     * Calculate GPS-based stroke rate from peaks
     * @returns {Number} Calculated stroke rate
     */
    calculateGPSStrokeRate() {
        if (this.speedPeaks.length < 2) return 0;
        
        const oldestPeak = this.speedPeaks[0].timestamp;
        const newestPeak = this.speedPeaks[this.speedPeaks.length - 1].timestamp;
        const timeSpan = (newestPeak - oldestPeak) / 1000; // in seconds
        
        const strokeCount = this.speedPeaks.length - 1;
        const rate = Math.round((strokeCount / timeSpan) * 60);
        
        // Cap at reasonable maximum
        return Math.min(rate, 40);
    },
    
    /**
     * Update GPS-based stroke rate
     * @param {Number} rate - New stroke rate
     */
    setGPSStrokeRate(rate) {
        this.gpsStrokeRate = rate;
    },
    
    /**
     * Get current GPS-based stroke rate
     * @returns {Number} Current GPS stroke rate
     */
    getGPSStrokeRate() {
        return this.gpsStrokeRate;
    },
    
    /**
     * Get time since last speed peak
     * @param {Number} currentTime - Current timestamp
     * @returns {Number} Milliseconds since last peak
     */
    getTimeSinceLastPeak(currentTime) {
        return currentTime - this.lastSpeedPeak;
    },
    
    /**
     * Set stroke rate detection method
     * @param {String} method - 'gps', 'motion', or 'both'
     */
    setStrokeRateMethod(method) {
        this.strokeRateMethod = method;
        console.log(`Sensor model: Stroke rate method set to ${method}`);
    },
    
    /**
     * Get current stroke rate detection method
     * @returns {String} Current method
     */
    getStrokeRateMethod() {
        return this.strokeRateMethod;
    },
    
    /**
     * Get stroke rate based on selected method
     * @returns {Number|Object} Stroke rate or {gps, motion} if 'both'
     */
    getCurrentStrokeRate() {
        if (this.strokeRateMethod === 'gps') {
            return this.gpsStrokeRate;
        } else if (this.strokeRateMethod === 'motion') {
            return this.currentStrokeRate;
        } else if (this.strokeRateMethod === 'both') {
            return {
                gps: this.gpsStrokeRate,
                motion: this.currentStrokeRate
            };
        }
        return 0;
    },
    
    /**
     * Reset all sensor data
     */
    reset() {
        this.accelerationHistory = [];
        this.lastStrokeDetection = 0;
        this.currentStrokeRate = 0;
        this.gpsStrokeRate = 0;
        this.speedPeaks = [];
        this.lastSpeedPeak = 0;
        console.log('Sensor model: Reset');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SensorModel;
}
