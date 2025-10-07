/**
 * Speedcox - Sensors Model
 * Manages motion sensor data, stroke detection, and sensor permissions
 */

/* =============================================================================
 * SENSOR STATE - Encapsulates all motion sensor-related data
 * ============================================================================= */

class SensorsModel {
    constructor() {
        // Motion sensor permissions and state
        this.motionPermission = false;
        this.isListening = false;
        
        // Stroke detection data
        this.strokeCount = 0;
        this.lastStrokeTime = 0;
        this.lastStrokeDetection = 0;
        this.currentStrokeRate = 0;
        
        // Acceleration data storage
        this.accelerationHistory = [];
        
        // Stroke timing history for rate calculation
        this.strokeTimes = [];
        
        // Bind event handler to preserve 'this' context
        this.handleDeviceMotion = this.handleDeviceMotion.bind(this);
    }
    
    /* =========================================================================
     * PERMISSION & INITIALIZATION
     * ========================================================================= */
    
    /**
     * Requests permission to use device motion sensors
     * Different handling for iOS vs Android
     * 
     * iOS 13+ requires explicit user permission
     * Android and older iOS automatically grant access
     * 
     * @returns {Promise<boolean>} Resolves to true if permission granted
     */
    async requestPermission() {
        console.log('🔐 Requesting motion sensor permission...');
        
        // iOS 13+ requires explicit permission
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            
            console.log('📱 iOS device detected, requesting permission...');
            
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                
                if (permission === 'granted') {
                    this.motionPermission = true;
                    this.setupListeners();
                    console.log('✓ Motion permission granted on iOS');
                    return true;
                } else {
                    console.log('⊘ Motion permission denied on iOS');
                    this.motionPermission = false;
                    return false;
                }
            } catch (error) {
                console.log('❌ Error requesting motion permission:', error);
                this.motionPermission = false;
                return false;
            }
        } 
        // Android and older iOS - no permission needed
        else if ('DeviceMotionEvent' in window) {
            this.motionPermission = true;
            this.setupListeners();
            console.log('✓ Motion sensors available (Android or older iOS)');
            return true;
        } 
        // No motion sensor support
        else {
            console.log('⊘ Motion sensors not supported by this browser');
            this.motionPermission = false;
            return false;
        }
    }
    
    /**
     * Sets up motion sensor event listeners
     * Only called after permission is granted
     */
    setupListeners() {
        if (this.isListening) return;
        
        window.addEventListener('devicemotion', this.handleDeviceMotion);
        this.isListening = true;
        console.log('👂 Motion event listeners activated');
    }
    
    /**
     * Removes motion sensor event listeners
     * Call when stopping workout or cleaning up
     */
    removeListeners() {
        if (!this.isListening) return;
        
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isListening = false;
        console.log('🔇 Motion event listeners deactivated');
    }
    
    /* =========================================================================
     * MOTION DATA PROCESSING
     * ========================================================================= */
    
    /**
     * Processes accelerometer data for stroke detection - EVENT HANDLER
     * Called automatically when device moves (if listeners are active)
     * 
     * HOW IT WORKS:
     * 1. Extract acceleration from all three axes (x, y, z)
     * 2. Calculate total acceleration magnitude
     * 3. Store in history for pattern analysis
     * 4. Attempt to detect rowing strokes from motion patterns
     * 
     * @param {DeviceMotionEvent} event - Motion data from device sensors
     */
    handleDeviceMotion(event) {
        // Only process motion if we have permission
        if (!this.motionPermission) return;
        
        // Get acceleration data (including gravity)
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration || acceleration.x === null) return;
        
        const timestamp = Date.now();
        
        // Calculate total acceleration magnitude (combines x, y, z axes)
        // This gives us overall "intensity" of movement regardless of phone orientation
        const magnitude = Math.sqrt(
            Math.pow(acceleration.x || 0, 2) +  // Left/right
            Math.pow(acceleration.y || 0, 2) +  // Forward/back
            Math.pow(acceleration.z || 0, 2)    // Up/down
        );
        
        // Store acceleration data for analysis
        this.accelerationHistory.push({ magnitude, timestamp });
        
        // Keep only last 10 seconds of data (prevents memory issues)
        const cutoff = timestamp - 10000;
        this.accelerationHistory = this.accelerationHistory.filter(a => a.timestamp > cutoff);
        
        // Attempt to detect rowing stroke from this motion
        this.detectStroke(magnitude, timestamp);
    }
    
    /**
     * Analyzes acceleration data to detect rowing strokes - CORE ALGORITHM
     * 
     * HOW STROKE DETECTION WORKS:
     * 1. Collects acceleration data from phone's motion sensors
     * 2. Looks for "spikes" in acceleration (sudden movements)
     * 3. A spike significantly higher than baseline = one stroke
     * 4. Prevents counting same stroke twice with timing filter
     * 
     * CALIBRATION NOTES:
     * - Threshold of 4 works well for boat-mounted devices
     * - Minimum 800ms between strokes prevents double-counting
     * - Uses 10-second window for immediate stroke rate response
     * 
     * @param {number} magnitude - Current total acceleration
     * @param {number} timestamp - When this measurement was taken (ms)
     */
    detectStroke(magnitude, timestamp) {
        // STEP 1: Need enough data to establish baseline
        if (this.accelerationHistory.length < 20) return;
        
        // STEP 2: Calculate baseline (what's normal boat movement?)
        const recentData = this.accelerationHistory.slice(-20);
        const avgMagnitude = recentData.reduce((sum, a) => sum + a.magnitude, 0) / recentData.length;
        
        // STEP 3: Set detection threshold
        // Increased from 2 to 4 to reduce sensitivity for boat-mounted device
        const threshold = avgMagnitude + 4;
        
        // STEP 4: Check if current movement qualifies as a stroke
        // Two conditions:
        // A) Acceleration significantly higher than baseline
        // B) At least 800ms since last stroke (prevents double-counting)
        if (magnitude > threshold && timestamp - this.lastStrokeDetection > 800) {
            
            // STROKE DETECTED!
            this.strokeCount++;
            this.lastStrokeDetection = timestamp;
            
            // STEP 5: Calculate CURRENT stroke rate
            // Count strokes in last 10 seconds, extrapolate to per minute
            const windowSize = 10000; // 10 seconds
            const recentStrokes = this.accelerationHistory.filter(
                a => a.timestamp > timestamp - windowSize &&
                a.magnitude > (avgMagnitude + 3)
            ).length;
            
            // Convert to strokes per minute
            this.currentStrokeRate = Math.round((recentStrokes / (windowSize / 1000)) * 60);
            this.currentStrokeRate = Math.min(this.currentStrokeRate, 40); // Cap at 40 SPM
            
            // Store stroke rate with timestamp
            this.strokeTimes.push({ rate: this.currentStrokeRate, timestamp });
            
            // STEP 6: Clean up old data (keep last 2 minutes)
            const strokeCutoff = timestamp - 120000;
            this.strokeTimes = this.strokeTimes.filter(s => s.timestamp > strokeCutoff);
            
            console.log(`✓ Stroke detected! Total: ${this.strokeCount}, Rate: ${this.currentStrokeRate} SPM, Recent: ${recentStrokes}`);
        }
    }
    
    /* =========================================================================
     * STATE MANAGEMENT
     * ========================================================================= */
    
    /**
     * Starts stroke detection
     * Activates motion event processing
     */
    start() {
        if (!this.motionPermission) {
            console.log('⚠️ Cannot start - motion permission not granted');
            return false;
        }
        
        console.log('▶️ Motion sensor stroke detection started');
        return true;
    }
    
    /**
     * Stops stroke detection
     * Motion listeners remain active but detection pauses
     */
    stop() {
        console.log('⏸️ Motion sensor stroke detection stopped');
    }
    
    /**
     * Resets all sensor data to initial state
     * Keeps permission status and listeners
     */
    reset() {
        this.strokeCount = 0;
        this.lastStrokeTime = 0;
        this.lastStrokeDetection = 0;
        this.currentStrokeRate = 0;
        this.accelerationHistory = [];
        this.strokeTimes = [];
        
        console.log('🔄 Sensor data reset');
    }
    
    /**
     * Cleans up all sensor resources
     * Call when completely done with sensors (e.g., page unload)
     */
    cleanup() {
        this.removeListeners();
        this.reset();
    }
    
    /* =========================================================================
     * GETTERS - Public API for accessing sensor data
     * ========================================================================= */
    
    /**
     * Gets current motion-based stroke rate
     * @returns {number} Stroke rate in strokes per minute
     */
    getStrokeRate() {
        return this.currentStrokeRate;
    }
    
    /**
     * Gets total stroke count for current session
     * @returns {number} Total strokes detected
     */
    getStrokeCount() {
        return this.strokeCount;
    }
    
    /**
     * Gets average stroke rate over entire session
     * @returns {number} Average stroke rate in SPM, or 0 if no data
     */
    getAverageStrokeRate() {
        if (this.strokeTimes.length === 0) return 0;
        
        const sum = this.strokeTimes.reduce((total, s) => total + s.rate, 0);
        return Math.round(sum / this.strokeTimes.length);
    }
    
    /**
     * Checks if motion sensors are available and permitted
     * @returns {boolean} True if sensors can be used
     */
    hasPermission() {
        return this.motionPermission;
    }
    
    /**
     * Checks if motion sensor data is currently being collected
     * @returns {boolean} True if actively listening for motion events
     */
    isActive() {
        return this.isListening && this.motionPermission;
    }
    
    /**
     * Gets recent acceleration history for debugging
     * @param {number} seconds - How many seconds of history to return
     * @returns {Array} Array of {magnitude, timestamp} objects
     */
    getRecentHistory(seconds = 10) {
        const cutoff = Date.now() - (seconds * 1000);
        return this.accelerationHistory.filter(a => a.timestamp > cutoff);
    }
}

// Export for use in main app
export default SensorsModel;
