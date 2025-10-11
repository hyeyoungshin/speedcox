/**
 * Workout Data Model
 * Manages workout state and metrics
 */

const WorkoutModel = {
    // Workout state
    isRunning: false,   // Is a workout currently active?
    startTime: null,
    
    // Distance and position tracking
    totalDistance: 0,   // How far have we rowed? (in meters)
    lastPosition: null,
    
    // Speed tracking
    speedHistory: [],
    
    // Stroke tracking
    strokeCount: 0,
    strokeTimes: [],
    lastStrokeTime: 0,
    
    // GPS tracking
    watchId: null,
    
    // Audio announcement timing
    lastStrokeRateAnnounce: 0,
    lastSplitAnnounce: 0,
    
    // Logging control
    lastLogMessage: '',
    logCounter: 0,
    
    /**
     * Start a new workout
     */
    start() {
        this.isRunning = true;
        this.startTime = Date.now();
        this.lastStrokeRateAnnounce = 0;
        this.lastSplitAnnounce = 0;
        this.lastLogMessage = '';
        console.log('Workout model: Started');
    },
    
    /**
     * Stop the current workout
     */
    stop() {
        this.isRunning = false;
        this.lastLogMessage = '';
        console.log('Workout model: Stopped');
    },
    
    /**
     * Reset all workout data
     */
    reset() {
        this.isRunning = false;
        this.startTime = null;
        this.totalDistance = 0;
        this.lastPosition = null;
        this.speedHistory = [];
        this.strokeCount = 0;
        this.strokeTimes = [];
        this.lastStrokeTime = 0;
        this.watchId = null;
        this.lastStrokeRateAnnounce = 0;
        this.lastSplitAnnounce = 0;
        this.lastLogMessage = '';
        this.logCounter = 0;
        console.log('Workout model: Reset');
    },
    
    /**
     * Get elapsed time in seconds
     * @returns {Number} Seconds since workout started
     */
    getElapsedTime() {
        if (!this.startTime) return 0;
        return (Date.now() - this.startTime) / 1000;
    },
    
    /**
     * Add distance to total
     * @param {Number} distance - Distance in meters
     */
    addDistance(distance) {
        this.totalDistance += distance;
    },
    
    /**
     * Update GPS position
     * @param {Object} position - Position object {lat, lng, timestamp}
     */
    updatePosition(position) {
        this.lastPosition = position;
    },
    
    /**
     * Add speed measurement
     * @param {Number} speed - Speed in m/s
     * @param {Number} timestamp - Timestamp
     */
    addSpeed(speed, timestamp) {
        this.speedHistory.push({ speed, timestamp });
        
        // Keep only last 30 seconds of speed data
        const cutoff = timestamp - 30000;
        this.speedHistory = this.speedHistory.filter(s => s.timestamp > cutoff);
    },
    
    /**
     * Get average speed from recent history
     * @returns {Number} Average speed in m/s
     */
    getAverageSpeed() {
        if (this.speedHistory.length === 0) return 0;
        return this.speedHistory.reduce((sum, s) => sum + s.speed, 0) / this.speedHistory.length;
    },
    
    /**
     * Calculate 500m split time
     * @returns {Number} Split time in seconds
     */
    getSplit500m() {
        const avgSpeed = this.getAverageSpeed();
        if (avgSpeed <= 0) return 0;
        return 500 / avgSpeed;
    },
    
    /**
     * Add stroke to count
     * @param {Number} rate - Current stroke rate
     * @param {Number} timestamp - Timestamp
     */
    addStroke(rate, timestamp) {
        this.strokeCount++;
        this.strokeTimes.push({ rate, timestamp });
        
        // Keep only last 2 minutes of stroke data
        const cutoff = timestamp - 120000;
        this.strokeTimes = this.strokeTimes.filter(s => s.timestamp > cutoff);
    },
    
    /**
     * Get average stroke rate
     * @returns {Number} Average stroke rate
     */
    getAverageStrokeRate() {
        if (this.strokeTimes.length === 0) return 0;
        return this.strokeTimes.reduce((sum, s) => sum + s.rate, 0) / this.strokeTimes.length;
    },
    
    /**
     * Get workout summary data
     * @returns {Object} Summary statistics
     */
    getSummary() {
        const elapsed = this.getElapsedTime();
        const avgStrokeRate = this.getAverageStrokeRate();
        const avgSpeed = this.getAverageSpeed();
        const avgSplit = avgSpeed > 0 ? 500 / avgSpeed : 0;
        
        return {
            distance: Math.round(this.totalDistance),
            time: elapsed,
            avgStrokeRate: Math.round(avgStrokeRate),
            avgSplit: avgSplit
        };
    }
};

// ES6 module export  
export default WorkoutModel;
