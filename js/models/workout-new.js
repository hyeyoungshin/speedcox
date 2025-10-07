/**
 * Speedcox - Workout Model
 * Manages workout state, GPS tracking, distance calculation, and metrics
 */

/* =============================================================================
 * WORKOUT STATE - Encapsulates all workout-related data
 * ============================================================================= */

class WorkoutModel {
    constructor() {
        // Workout session state
        this.isRunning = false;
        this.startTime = null;
        this.totalDistance = 0;
        this.strokeCount = 0;
        
        // GPS tracking
        this.lastPosition = null;
        this.watchId = null;
        this.speedHistory = [];
        
        // GPS-based stroke rate detection (NK SpeedCoach method)
        this.gpsStrokeRate = 0;
        this.speedPeaks = [];
        this.lastSpeedPeak = 0;
        
        // Audio announcement timing
        this.lastStrokeRateAnnounce = 0;
        this.lastSplitAnnounce = 0;
        
        // Logging control
        this.lastLogMessage = '';
    }
    
    /* =========================================================================
     * WORKOUT LIFECYCLE METHODS
     * ========================================================================= */
    
    /**
     * Starts a new workout session
     * Resets state and initializes GPS tracking if needed
     * @param {boolean} useGPS - Whether to enable GPS tracking
     * @param {Function} positionCallback - Callback for GPS position updates
     * @param {Function} errorCallback - Callback for GPS errors
     */
    start(useGPS, positionCallback, errorCallback) {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.startTime = Date.now();
        this.lastStrokeRateAnnounce = 0;
        this.lastSplitAnnounce = 0;
        this.lastLogMessage = '';
        
        // Start GPS tracking if requested
        if (useGPS && 'geolocation' in navigator) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => positionCallback(position),
                (error) => errorCallback(error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 1000,
                    timeout: 10000
                }
            );
            console.log('🌐 GPS tracking started for workout');
        }
        
        console.log('✓ Workout started successfully');
    }
    
    /**
     * Stops the current workout session
     * Cleans up GPS tracking and resets announcement timers
     */
    stop() {
        if (!this.isRunning) return;
        
        console.log('⏹️ Stopping workout...');
        
        this.isRunning = false;
        this.lastLogMessage = '';
        
        // Stop GPS tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            console.log('🌐 GPS tracking stopped');
        }
        
        console.log('✓ Workout stopped successfully');
    }
    
    /**
     * Resets all workout data to initial state
     * Stops workout first if currently running
     */
    reset() {
        this.stop();
        
        this.totalDistance = 0;
        this.strokeCount = 0;
        this.speedHistory = [];
        this.lastPosition = null;
        this.startTime = null;
        this.gpsStrokeRate = 0;
        this.speedPeaks = [];
        this.lastSpeedPeak = 0;
    }
    
    /* =========================================================================
     * GPS POSITION TRACKING & DISTANCE CALCULATION
     * ========================================================================= */
    
    /**
     * Processes new GPS position data - CORE DISTANCE TRACKING
     * 
     * HOW GPS DISTANCE TRACKING WORKS:
     * 1. Browser provides new GPS coordinates periodically (~1 second intervals)
     * 2. Calculate distance between last position and new position
     * 3. Filter out GPS "noise" (small random fluctuations when stationary)
     * 4. Add real movement to total distance
     * 5. Track speed for split time calculation
     * 
     * @param {Position} position - GPS position object from browser
     */
    updatePosition(position) {
        if (!this.isRunning) return;
        
        const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp
        };
        
        // If we have a previous position, calculate distance moved
        if (this.lastPosition) {
            const distance = this.calculateDistance(this.lastPosition, currentPos);
            const timeDiff = (currentPos.timestamp - this.lastPosition.timestamp) / 1000;
            
            // FILTER OUT GPS NOISE
            // GPS has natural drift of ±5-10 meters even when stationary
            // Only count as real movement if:
            // A) Moved at least 3 meters (filters out GPS drift)
            // B) Speed is at least 0.5 m/s (filters out slow GPS drift)
            const minDistance = 3;  // meters
            const minSpeed = 0.5;   // meters per second (~1 knot)
            
            if (distance > minDistance && timeDiff > 0) {
                const speed = distance / timeDiff;
                
                if (speed >= minSpeed) {
                    // This is REAL movement, not GPS noise
                    this.totalDistance += distance;
                    this.speedHistory.push({ speed, timestamp: currentPos.timestamp });
                    
                    console.log(`✓ GPS: Moved ${distance.toFixed(1)}m in ${timeDiff.toFixed(1)}s, Speed: ${speed.toFixed(2)} m/s`);
                    
                    // Keep only last 30 seconds of speed data
                    const cutoff = currentPos.timestamp - 30000;
                    this.speedHistory = this.speedHistory.filter(s => s.timestamp > cutoff);
                    
                    // Analyze speed patterns for stroke rate estimation
                    this.analyzeSpeedForStrokeRate(speed, currentPos.timestamp);
                } else {
                    console.log(`⊘ GPS: Ignoring slow movement (${speed.toFixed(2)} m/s < ${minSpeed} m/s threshold)`);
                }
            } else if (distance > 0) {
                console.log(`⊘ GPS: Ignoring small movement (${distance.toFixed(2)}m < ${minDistance}m threshold)`);
            }
        } else {
            console.log('📍 GPS: First position acquired');
        }
        
        this.lastPosition = currentPos;
    }
    
    /**
     * Analyzes GPS speed patterns to estimate stroke rate (NK SpeedCoach Method)
     * 
     * HOW GPS-BASED STROKE RATE WORKS:
     * 1. During each rowing stroke, boat speed fluctuates in a pattern
     * 2. Speed increases during drive phase (pulling the oar)
     * 3. Speed decreases during recovery phase (returning to catch)
     * 4. By detecting these speed peaks/valleys, we can count strokes
     * 5. Calculate strokes per minute from timing between peaks
     * 
     * This method doesn't require motion sensors - only GPS speed data
     * More reliable for boat-mounted devices that don't move with rower
     * 
     * @param {number} speed - Current boat speed in m/s
     * @param {number} timestamp - When this speed was measured
     */
    analyzeSpeedForStrokeRate(speed, timestamp) {
        if (this.speedHistory.length < 5) return;
        
        // Get recent speed history for pattern analysis
        const recentSpeeds = this.speedHistory.slice(-10);
        const avgSpeed = recentSpeeds.reduce((sum, s) => sum + s.speed, 0) / recentSpeeds.length;
        
        // Detect speed "peaks" (local maximums)
        // A peak = speed significantly higher than recent average
        const peakThreshold = avgSpeed * 1.1; // 10% above average
        const isPeak = speed > peakThreshold;
        
        // Check if this is a new peak (not same peak as before)
        // Must be at least 1 second since last peak
        const minTimeBetweenStrokes = 1000; // milliseconds
        
        if (isPeak && timestamp - this.lastSpeedPeak > minTimeBetweenStrokes) {
            this.speedPeaks.push({ speed, timestamp });
            this.lastSpeedPeak = timestamp;
            
            // Keep only last 30 seconds of peak data
            const peakWindow = 30000;
            this.speedPeaks = this.speedPeaks.filter(p => p.timestamp > timestamp - peakWindow);
            
            // Calculate stroke rate from recent peaks
            if (this.speedPeaks.length >= 2) {
                const oldestPeak = this.speedPeaks[0].timestamp;
                const newestPeak = this.speedPeaks[this.speedPeaks.length - 1].timestamp;
                const timeSpan = (newestPeak - oldestPeak) / 1000; // seconds
                
                const strokeCount = this.speedPeaks.length - 1;
                this.gpsStrokeRate = Math.round((strokeCount / timeSpan) * 60);
                this.gpsStrokeRate = Math.min(this.gpsStrokeRate, 40); // Cap at 40 SPM
                
                console.log(`🌊 GPS Stroke: Peak detected! Speed: ${speed.toFixed(2)} m/s, Rate: ${this.gpsStrokeRate} SPM (${this.speedPeaks.length} peaks over ${timeSpan.toFixed(1)}s)`);
            }
        }
    }
    
    /**
     * Calculates distance between two GPS coordinates
     * Uses the Haversine formula to account for Earth's curvature
     * 
     * @param {Object} pos1 - First position {lat, lng}
     * @param {Object} pos2 - Second position {lat, lng}
     * @returns {number} Distance in meters
     */
    calculateDistance(pos1, pos2) {
        const R = 6371000; // Earth's radius in meters
        
        const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
        const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /* =========================================================================
     * METRICS CALCULATION
     * ========================================================================= */
    
    /**
     * Gets current workout elapsed time in seconds
     * @returns {number} Elapsed time in seconds, or 0 if not started
     */
    getElapsedTime() {
        if (!this.startTime) return 0;
        return (Date.now() - this.startTime) / 1000;
    }
    
    /**
     * Calculates current split time (500m pace)
     * Returns time it would take to row 500m at current average speed
     * 
     * @returns {number|null} Split time in seconds, or null if no speed data
     */
    getCurrentSplit() {
        if (this.speedHistory.length === 0) return null;
        
        const avgSpeed = this.speedHistory.reduce((sum, s) => sum + s.speed, 0) / this.speedHistory.length;
        if (avgSpeed <= 0) return null;
        
        return 500 / avgSpeed; // seconds to row 500m
    }
    
    /**
     * Gets current GPS-based stroke rate
     * @returns {number} Stroke rate in strokes per minute
     */
    getGpsStrokeRate() {
        return this.gpsStrokeRate;
    }
    
    /**
     * Checks if enough time has passed for stroke rate announcement
     * @param {number} interval - Announcement interval in seconds
     * @returns {boolean} True if should announce now
     */
    shouldAnnounceStrokeRate(interval) {
        if (interval <= 0) return false;
        const elapsed = this.getElapsedTime();
        return elapsed - this.lastStrokeRateAnnounce >= interval;
    }
    
    /**
     * Marks stroke rate as announced (updates timer)
     */
    markStrokeRateAnnounced() {
        this.lastStrokeRateAnnounce = this.getElapsedTime();
    }
    
    /**
     * Checks if enough time has passed for split time announcement
     * @param {number} interval - Announcement interval in seconds
     * @returns {boolean} True if should announce now
     */
    shouldAnnounceSplit(interval) {
        if (interval <= 0) return false;
        const elapsed = this.getElapsedTime();
        return elapsed - this.lastSplitAnnounce >= interval;
    }
    
    /**
     * Marks split time as announced (updates timer)
     */
    markSplitAnnounced() {
        this.lastSplitAnnounce = this.getElapsedTime();
    }
    
    /**
     * Gets workout summary data for display after workout ends
     * @returns {Object} Summary statistics
     */
    getSummary() {
        return {
            distance: Math.round(this.totalDistance),
            elapsedTime: this.getElapsedTime(),
            avgSpeed: this.totalDistance / this.getElapsedTime(),
            strokeCount: this.strokeCount
        };
    }
}

// Export for use in main app
export default WorkoutModel;
