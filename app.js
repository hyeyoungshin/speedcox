/**
 * Speedcox - Main Application Controller
 * Rowing performance monitor with GPS and motion sensor stroke detection
 */

/* =============================================================================
 * GLOBAL VARIABLES - These store the app's current state
 * ============================================================================= */

// Workout state tracking
let isRunning = false;          // Is a workout currently active?
let startTime = null;           // When did the current workout start? (timestamp)
let totalDistance = 0;          // How far have we rowed? (in meters)
let lastPosition = null;        // Last GPS position we recorded
let strokeCount = 0;            // How many strokes in this workout?
let lastStrokeTime = 0;         // When was the last stroke? (for rate calculation)
let strokeTimes = [];           // Array storing recent stroke timestamps
let speedHistory = [];          // Array storing recent speed measurements
let watchId = null;             // GPS tracking ID (so we can stop it later)

// Motion sensor data for stroke detection
let motionPermission = false;   // Do we have permission to use motion sensors?
let accelerationHistory = [];   // Array storing recent acceleration data
let lastStrokeDetection = 0;    // When did we last detect a stroke?
let currentStrokeRate = 0;      // Current calculated stroke rate

// GPS-based stroke rate detection
let gpsStrokeRate = 0;          // Stroke rate calculated from GPS speed patterns
let speedPeaks = [];            // Array storing detected speed peaks (stroke cycles)
let lastSpeedPeak = 0;          // When did we last detect a speed peak?

// Stroke rate detection method selection
let strokeRateMethod = 'gps';   // Options: 'motion' or 'gps' - Default to GPS like NK SpeedCoach

// Audio announcement timing
let lastStrokeRateAnnounce = 0; // When did we last announce stroke rate?
let lastSplitAnnounce = 0;      // When did we last announce split time?

// Logging control flags to prevent spam
let lastLogMessage = '';        // Track last log message to avoid duplicates
let logCounter = 0;             // Counter for periodic logs

/* =============================================================================
 * HTML ELEMENT REFERENCES - Quick access to page elements we'll update
 * ============================================================================= */

const gpsStatus = document.getElementById('gpsStatus');           // GPS status dot
const gpsStatusText = document.getElementById('gpsStatusText');   // GPS status text
const strokeRateEl = document.getElementById('strokeRate');       // Stroke rate display
const strokeRateLabel = document.getElementById('strokeRateLabel'); // Stroke rate label
const splitEl = document.getElementById('split');                 // Split time display
const distanceEl = document.getElementById('distance');           // Distance display
const elapsedTimeEl = document.getElementById('elapsedTime');     // Time display
const startBtn = document.getElementById('startBtn');             // Start button
const stopBtn = document.getElementById('stopBtn');               // Stop button

/* =============================================================================
 * INITIALIZATION - Set up the app when page loads
 * ============================================================================= */

// Check if GPS is available and get initial position
if ('geolocation' in navigator) {
    // Browser supports GPS - try to get current location
    navigator.geolocation.getCurrentPosition(
        // Success callback - GPS is working
        (position) => {
            gpsStatus.classList.add('active');  // Turn status dot green
            gpsStatusText.textContent = 'GPS: Ready';
        },
        // Error callback - GPS failed
        (error) => {
            gpsStatusText.textContent = 'GPS: Error - ' + error.message;
        }
    );
} else {
    // Browser doesn't support GPS
    gpsStatusText.textContent = 'GPS: Not supported';
}

/* =============================================================================
 * MOTION SENSOR FUNCTIONS - Real accelerometer implementation
 * ============================================================================= */

/**
 * Request permission to use device motion sensors
 * Different handling for iOS vs Android
 */
function requestMotionPermission() {
    console.log('requestMotionPermission called');
    
    // For iOS 13+ devices
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        console.log('iOS device detected, requesting motion permission...');
        DeviceMotionEvent.requestPermission()
            .then(permission => {
                if (permission === 'granted') {
                    motionPermission = true;
                    setupMotionListeners();
                    console.log('Motion permission granted on iOS');
                    alert('Motion sensors enabled! Start a workout to use real stroke detection.');
                } else {
                    console.log('Motion permission denied on iOS');
                    alert('Motion permission denied. Will use simulated stroke rate.');
                    motionPermission = false;
                }
            })
            .catch(error => {
                console.log('Error requesting motion permission:', error);
                alert('Error enabling motion sensors: ' + error.message);
                motionPermission = false;
            });
    } 
    // For Android and older iOS devices
    else if ('DeviceMotionEvent' in window) {
        motionPermission = true;
        setupMotionListeners();
        console.log('Motion sensors available (Android or older iOS)');
        alert('Motion sensors enabled! Start a workout to use real stroke detection.');
    } 
    // No motion sensor support
    else {
        console.log('Motion sensors not supported by this browser');
        alert('Motion sensors not supported by your browser. Will use simulated stroke rate.');
        motionPermission = false;
    }
}

/**
 * Set up motion sensor event listeners
 * Only called if we have permission
 */
function setupMotionListeners() {
    // Listen for device motion events (accelerometer data)
    window.addEventListener('devicemotion', handleDeviceMotion);
    console.log('Motion event listeners set up');
}

/**
 * Process accelerometer data for stroke detection
 * Called automatically when device moves
 * @param {DeviceMotionEvent} event - Motion data from device
 */
function handleDeviceMotion(event) {
    // Only process motion during active workout
    if (!isRunning || !motionPermission) return;
    
    // Get acceleration data (including gravity)
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration || acceleration.x === null) return;
    
    const timestamp = Date.now();
    
    // Calculate total acceleration magnitude (combines x, y, z axes)
    // This gives us overall "intensity" of movement regardless of phone orientation
    const magnitude = Math.sqrt(
        Math.pow(acceleration.x || 0, 2) +  // Left/right movement
        Math.pow(acceleration.y || 0, 2) +  // Forward/back movement  
        Math.pow(acceleration.z || 0, 2)    // Up/down movement
    );
    
    // Store acceleration data for analysis
    accelerationHistory.push({ magnitude, timestamp });
    
    // Keep only last 10 seconds of data (prevents memory issues)
    const cutoff = timestamp - 10000; // 10 seconds ago
    accelerationHistory = accelerationHistory.filter(a => a.timestamp > cutoff);
    
    // Try to detect if this motion represents a rowing stroke
    detectStroke(magnitude, timestamp);
}

/**
 * Analyze acceleration data to detect rowing strokes - UPDATED WITH DETAILED COMMENTS!
 * 
 * HOW STROKE DETECTION WORKS:
 * 1. Collects acceleration data from phone's motion sensors
 * 2. Looks for "spikes" in acceleration (sudden movements)
 * 3. A spike that's significantly higher than baseline = one stroke
 * 4. Prevents counting the same stroke twice with timing filter
 * 
 * @param {Number} magnitude - Current total acceleration (combining x,y,z axes)
 * @param {Number} timestamp - When this measurement was taken (milliseconds)
 */
function detectStroke(magnitude, timestamp) {
    // STEP 1: Make sure we have enough data points to establish a baseline
    // Need at least 20 data points (about 2 seconds of data)
    if (accelerationHistory.length < 20) return;
    
    // STEP 2: Calculate the "baseline" - what's normal boat movement?
    // Take the last 20 acceleration readings and find their average
    const recentData = accelerationHistory.slice(-20);
    const avgMagnitude = recentData.reduce((sum, a) => sum + a.magnitude, 0) / recentData.length;
    
    // STEP 3: Set detection threshold
    // ADJUSTED: Increased from 2 to 4 to reduce sensitivity for boat-mounted device
    // A stroke is detected when acceleration exceeds baseline by this amount
    // Higher number = less sensitive (fewer false positives)
    // Lower number = more sensitive (may detect non-rowing movements)
    const threshold = avgMagnitude + 4;
    
    // STEP 4: Check if current movement qualifies as a stroke
    // Two conditions must be met:
    // A) Current acceleration is much higher than baseline (indicates a stroke)
    // B) At least 800ms (0.8 seconds) has passed since last stroke
    //    This prevents counting the same stroke multiple times
    //    (Rowing strokes typically happen every 1-2 seconds)
    if (magnitude > threshold && timestamp - lastStrokeDetection > 800) {
        
        // STROKE DETECTED!
        strokeCount++;  // Increment total stroke counter
        lastStrokeDetection = timestamp;  // Remember when this stroke happened
        
        // STEP 5: Calculate CURRENT stroke rate (strokes per minute)
        // Method: Count how many strokes happened in the last 10 seconds, then extrapolate
        // CHANGED: Reduced from 60 seconds to 10 seconds for immediate responsiveness
        const windowSize = 10000; // 10 seconds in milliseconds
        const recentStrokes = accelerationHistory.filter(
            a => a.timestamp > timestamp - windowSize &&  // Last 10 seconds
            a.magnitude > (avgMagnitude + 3)  // Significant motion (lower threshold for counting)
        ).length;
        
        // Convert to strokes per minute: (strokes in 10 sec) * 6 = strokes per minute
        // Example: 4 strokes in 10 seconds = 24 strokes per minute
        currentStrokeRate = Math.round((recentStrokes / (windowSize / 1000)) * 60);
        
        // Cap at reasonable maximum (40 SPM is very high for rowing)
        currentStrokeRate = Math.min(currentStrokeRate, 40);
        
        // Store this stroke rate with timestamp for averaging later
        strokeTimes.push({ rate: currentStrokeRate, timestamp: timestamp });
        
        // STEP 6: Clean up old data
        // Keep only last 2 minutes of stroke history for summary calculations
        const strokeCutoff = timestamp - 120000; // 2 minutes ago
        strokeTimes = strokeTimes.filter(s => s.timestamp > strokeCutoff);
        
        // Log detection for debugging
        console.log(`✓ Stroke detected! Total: ${strokeCount}, Current Rate: ${currentStrokeRate} SPM, Recent strokes in ${windowSize/1000}s: ${recentStrokes}`);
    }
}

/* =============================================================================
 * MAIN WORKOUT CONTROL FUNCTIONS
 * ============================================================================= */

/**
 * Starts a new workout session
 * Called when user clicks "Start" button
 */
function startWorkout() {
    console.log('startWorkout called'); // Debug log
    
    // Prevent starting if already running
    if (isRunning) return;
    
    // Update app state
    isRunning = true;
    startTime = Date.now();  // Record start time in milliseconds
    lastStrokeRateAnnounce = 0;
    lastSplitAnnounce = 0;
    
    // Update button states
    startBtn.disabled = true;   // Disable start button
    stopBtn.disabled = false;   // Enable stop button
    
    // Hide any previous workout summary
    document.getElementById('workoutSummary').style.display = 'none';
    
    // Start GPS tracking (only if using GPS-based methods)
    const selectedMethod = document.getElementById('strokeRateMethod').value;
    if (selectedMethod === 'gps' || selectedMethod === 'both') {
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                updatePosition,  // Function to call when GPS updates
                (error) => {
                    // Better GPS error logging for debugging
                    console.log('GPS error code:', error.code);
                    console.log('GPS error message:', error.message);
                    console.log('Full error object:', error);
                    
                    // Show user-friendly error messages
                    if (error.code === 1) {
                        console.log('GPS Error: Permission denied by user');
                        gpsStatusText.textContent = 'GPS: Permission denied';
                    } else if (error.code === 2) {
                        console.log('GPS Error: Position unavailable (no signal)');
                        gpsStatusText.textContent = 'GPS: No signal';
                    } else if (error.code === 3) {
                        console.log('GPS Error: Timeout waiting for position');
                        gpsStatusText.textContent = 'GPS: Timeout';
                    } else {
                        console.log('GPS Error: Unknown error');
                        gpsStatusText.textContent = 'GPS: Error - ' + error.message;
                    }
                },
                {
                    enableHighAccuracy: true,  // Use GPS, not just cell towers
                    maximumAge: 1000,         // Accept positions up to 1 second old
                    timeout: 10000            // Give up after 10 seconds
                }
            );
        }
        console.log('🌐 GPS tracking started for stroke rate detection');
    } else {
        console.log('⊗ GPS tracking disabled (using motion sensor method only)');
    }
    
    // Start the main update loop (updates display every 100ms)
    updateDisplay();
    
    // Announce workout start
    speak('Workout started');
    console.log('Workout started successfully'); // Debug log
}

/**
 * Stops the current workout session
 * Called when user clicks "Stop" button
 */
function stopWorkout() {
    // Prevent stopping if not running
    if (!isRunning) return;
    
    console.log('⏹️ Stopping workout...'); // Log that we're stopping
    
    // Reset logging flag so messages can appear again on next start
    lastLogMessage = '';
    
    // Update app state
    isRunning = false;
    startBtn.disabled = false;   // Re-enable start button
    stopBtn.disabled = true;     // Disable stop button
    
    // Stop GPS tracking
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log('🌐 GPS tracking stopped');
    }
    
    // Log motion sensor status
    if (motionPermission) {
        console.log('📱 Motion sensor detection stopped (sensors still enabled for next workout)');
    }
    
    console.log('✓ Workout stopped successfully'); // Confirm stop
    
    // Show workout summary
    showWorkoutSummary();
    speak('Workout stopped');
}

/**
 * Resets all workout data to zero
 * Called when user clicks "Reset" button
 */
function resetWorkout() {
    // Stop workout first (if running)
    stopWorkout();
    
    // Reset all data to initial state
    totalDistance = 0;
    strokeCount = 0;
    strokeTimes = [];
    speedHistory = [];
    lastPosition = null;
    startTime = null;
    currentStrokeRate = 0; // Reset accelerometer stroke rate
    
    // Reset display to initial values
    strokeRateEl.textContent = '--';
    splitEl.textContent = '--:--';
    distanceEl.textContent = '0m';
    elapsedTimeEl.textContent = '0:00';
    
    // Hide workout summary
    document.getElementById('workoutSummary').style.display = 'none';
}

/* =============================================================================
 * GPS POSITION TRACKING
 * ============================================================================= */

/**
 * Handles new GPS position data - UPDATED WITH DETAILED COMMENTS & BUG FIXES
 * Called automatically by the browser when GPS position updates
 * 
 * HOW GPS DISTANCE TRACKING WORKS:
 * 1. Browser provides new GPS coordinates periodically (every ~1 second)
 * 2. Calculate distance between last position and new position
 * 3. Filter out GPS "noise" (small random fluctuations when stationary)
 * 4. Add real movement to total distance
 * 5. Track speed for split time calculation
 * 
 * @param {Position} position - GPS position object from browser
 */
function updatePosition(position) {
    // Only process if workout is running
    if (!isRunning) return;
    
    // STEP 1: Extract GPS coordinates from browser's position object
    const currentPos = {
        lat: position.coords.latitude,   // Latitude (north/south)
        lng: position.coords.longitude,  // Longitude (east/west)
        timestamp: position.timestamp    // When this position was recorded
    };
    
    // STEP 2: If we have a previous position, calculate distance moved
    if (lastPosition) {
        // Calculate straight-line distance between two GPS points
        const distance = calculateDistance(lastPosition, currentPos);
        
        // Calculate time difference in seconds
        const timeDiff = (currentPos.timestamp - lastPosition.timestamp) / 1000;
        
        // STEP 3: FILTER OUT GPS NOISE
        // GPS has natural drift of ±5-10 meters even when stationary
        // CHANGED: Increased from 0.5m to 3m minimum movement threshold
        // CHANGED: Added minimum speed requirement (0.5 m/s = ~1 knot = slow walking)
        // Only count as real movement if BOTH conditions are met:
        // A) Moved at least 3 meters (filters out GPS drift)
        // B) Time difference is positive (sanity check)
        // C) Speed is at least 0.5 m/s (filters out very slow GPS drift)
        const minDistance = 3;  // meters - adjust higher if still seeing drift
        const minSpeed = 0.5;   // meters per second
        
        if (distance > minDistance && timeDiff > 0) {
            // Calculate current speed
            const speed = distance / timeDiff; // meters per second
            
            // Only count movement if speed is above minimum threshold
            if (speed >= minSpeed) {
                // This is REAL movement, not GPS noise
                totalDistance += distance;
                speedHistory.push({ speed, timestamp: currentPos.timestamp });
                
                console.log(`✓ GPS: Moved ${distance.toFixed(1)}m in ${timeDiff.toFixed(1)}s, Speed: ${speed.toFixed(2)} m/s`);
                
                // STEP 4: Keep only recent speed data for averaging
                // Keep last 30 seconds of speed data for split calculation
                const cutoff = currentPos.timestamp - 30000; // 30 seconds ago
                speedHistory = speedHistory.filter(s => s.timestamp > cutoff);
            } else {
                // Movement detected but too slow - likely GPS noise
                console.log(`⊗ GPS: Ignoring slow movement (${speed.toFixed(2)} m/s < ${minSpeed} m/s threshold)`);
            }
            
            // STEP 5: GPS-BASED STROKE RATE ESTIMATION
            // Analyze speed patterns to estimate stroke rate (like NK SpeedCoach)
            analyzeSpeedForStrokeRate(speed, currentPos.timestamp);
            
        } else if (distance > 0) {
            // Small movement detected - GPS noise/drift
            console.log(`⊗ GPS: Ignoring small movement (${distance.toFixed(2)}m < ${minDistance}m threshold)`);
        }
    } else {
        // First GPS reading - no previous position to compare
        console.log('GPS: First position acquired');
    }
    
    // STEP 5: Store current position for next comparison
    lastPosition = currentPos;
}

/**
 * Analyzes GPS speed patterns to estimate stroke rate - NEW!
 * 
 * HOW GPS-BASED STROKE RATE WORKS (NK SpeedCoach Method):
 * 1. During each rowing stroke, boat speed fluctuates in a pattern
 * 2. Speed increases during drive phase (pulling the oar)
 * 3. Speed decreases during recovery phase (returning to catch)
 * 4. By detecting these speed peaks/valleys, we can count strokes
 * 5. Calculate strokes per minute from the timing between peaks
 * 
 * This method doesn't require motion sensors - only GPS speed data
 * More reliable for boat-mounted devices that don't move with rower
 * 
 * @param {Number} speed - Current boat speed in m/s
 * @param {Number} timestamp - When this speed was measured
 */
function analyzeSpeedForStrokeRate(speed, timestamp) {
    // Need at least some speed history to detect patterns
    if (speedHistory.length < 5) return;
    
    // STEP 1: Get recent speed history for pattern analysis
    const recentSpeeds = speedHistory.slice(-10); // Last 10 speed readings
    
    // Calculate average speed from recent readings
    const avgSpeed = recentSpeeds.reduce((sum, s) => sum + s.speed, 0) / recentSpeeds.length;
    
    // STEP 2: Detect speed "peaks" (local maximums)
    // A peak occurs when speed is significantly higher than recent average
    // This represents the drive phase of a rowing stroke
    const peakThreshold = avgSpeed * 1.1; // 10% above average
    const isPeak = speed > peakThreshold;
    
    // STEP 3: Check if this is a new peak (not same peak as before)
    // Must be at least 1 second since last peak (prevents double-counting)
    // Typical rowing: 1-2 seconds per stroke at 20-30 SPM
    const minTimeBetweenStrokes = 1000; // 1 second in milliseconds
    
    if (isPeak && timestamp - lastSpeedPeak > minTimeBetweenStrokes) {
        // NEW STROKE DETECTED via GPS speed pattern!
        speedPeaks.push({ speed, timestamp });
        lastSpeedPeak = timestamp;
        
        // STEP 4: Calculate stroke rate from recent peaks
        // Keep only last 30 seconds of peak data
        const peakWindow = 30000; // 30 seconds
        speedPeaks = speedPeaks.filter(p => p.timestamp > timestamp - peakWindow);
        
        // Calculate strokes per minute
        if (speedPeaks.length >= 2) {
            // Get time span of peaks
            const oldestPeak = speedPeaks[0].timestamp;
            const newestPeak = speedPeaks[speedPeaks.length - 1].timestamp;
            const timeSpan = (newestPeak - oldestPeak) / 1000; // in seconds
            
            // Calculate rate: (number of strokes) / (time in minutes)
            const strokeCount = speedPeaks.length - 1; // -1 because first peak is starting point
            gpsStrokeRate = Math.round((strokeCount / timeSpan) * 60);
            
            // Cap at reasonable maximum
            gpsStrokeRate = Math.min(gpsStrokeRate, 40);
            
            console.log(`🌊 GPS Stroke: Peak detected! Speed: ${speed.toFixed(2)} m/s, Calculated rate: ${gpsStrokeRate} SPM (from ${speedPeaks.length} peaks over ${timeSpan.toFixed(1)}s)`);
        }
    }
}

/**
 * Calculates distance between two GPS coordinates
 * Uses the Haversine formula to account for Earth's curvature
 * @param {Object} pos1 - First position {lat, lng}
 * @param {Object} pos2 - Second position {lat, lng}
 * @returns {Number} Distance in meters
 */
function calculateDistance(pos1, pos2) {
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

/* =============================================================================
 * DISPLAY UPDATE LOOP
 * ============================================================================= */

/**
 * Main display update function
 * Updates all metrics shown on screen
 * Calls itself every 100ms while workout is running
 */
function updateDisplay() {
    // Only run if workout is active
    if (!isRunning) return;
    
    // Calculate elapsed time since workout started
    const elapsed = (Date.now() - startTime) / 1000; // Convert to seconds
    
    // Update elapsed time display (format: minutes:seconds)
    elapsedTimeEl.textContent = formatTime(elapsed);
    
    // Update distance display (round to nearest meter)
    distanceEl.textContent = Math.round(totalDistance) + 'm';
    
    // Calculate and update split time (how long to row 500m at current pace)
    if (speedHistory.length > 0) {
        // Calculate average speed from recent data
        const avgSpeed = speedHistory.reduce((sum, s) => sum + s.speed, 0) / speedHistory.length;
        if (avgSpeed > 0) {
            const split500m = 500 / avgSpeed; // Time to row 500m at current speed
            splitEl.textContent = formatTime(split500m);
        }
    }
    
    // Update stroke rate (now uses REAL accelerometer data!)
    updateStrokeRate(elapsed);
    
    // Handle audio announcements
    handleAudioAnnouncements(elapsed);
    
    // Schedule next update in 100ms (creates smooth updates)
    if (isRunning) {
        setTimeout(updateDisplay, 100);
    }
}

/**
 * Updates stroke rate display - UPDATED WITH DUAL METHOD SUPPORT
 * 
 * HOW STROKE RATE DISPLAY WORKS:
 * 1. Check which detection method is selected (GPS or Motion)
 * 2. Display appropriate stroke rate based on method
 * 3. If "Show Both" selected, display both with labels
 * 
 * @param {Number} elapsed - Seconds since workout started
 */
function updateStrokeRate(elapsed) {
    // Don't update or log if workout is not running
    if (!isRunning) return;
    
    // Get selected method from dropdown
    const selectedMethod = document.getElementById('strokeRateMethod').value;
    
    // OPTION 1: GPS-BASED STROKE RATE (NK SpeedCoach style)
    if (selectedMethod === 'gps') {
        if (gpsStrokeRate > 0) {
            strokeRateEl.textContent = gpsStrokeRate;
            
            const logMsg = `📊 Display: Showing GPS-based stroke rate: ${gpsStrokeRate} SPM`;
            if (Math.floor(elapsed) % 5 === 0 && lastLogMessage !== logMsg) {
                console.log(logMsg);
                lastLogMessage = logMsg;
            }
        } else {
            strokeRateEl.textContent = '--';
            
            const logMsg = '📊 Display: GPS mode, waiting for speed patterns...';
            if (lastLogMessage !== logMsg) {
                console.log(logMsg);
                lastLogMessage = logMsg;
            }
        }
        return;
    }
    
    // OPTION 2: MOTION SENSOR STROKE RATE
    if (selectedMethod === 'motion') {
        if (motionPermission) {
            if (currentStrokeRate > 0) {
                strokeRateEl.textContent = currentStrokeRate;
                
                const logMsg = `📊 Display: Showing motion-based stroke rate: ${currentStrokeRate} SPM`;
                if (Math.floor(elapsed) % 5 === 0 && lastLogMessage !== logMsg) {
                    console.log(logMsg);
                    lastLogMessage = logMsg;
                }
            } else {
                strokeRateEl.textContent = '--';
                
                const logMsg = '📊 Display: Motion sensor active, waiting for strokes...';
                if (lastLogMessage !== logMsg) {
                    console.log(logMsg);
                    lastLogMessage = logMsg;
                }
            }
        } else {
            strokeRateEl.textContent = 'Enable Motion';
            
            const logMsg = '📊 Display: Motion sensors not enabled';
            if (lastLogMessage !== logMsg) {
                console.log(logMsg);
                lastLogMessage = logMsg;
            }
        }
        return;
    }
    
    // OPTION 3: SHOW BOTH METHODS (Comparison Mode)
    if (selectedMethod === 'both') {
        const gpsDisplay = gpsStrokeRate > 0 ? gpsStrokeRate : '--';
        const motionDisplay = (motionPermission && currentStrokeRate > 0) ? currentStrokeRate : '--';
        
        // Display format: "GPS:24 / MOT:26"
        strokeRateEl.innerHTML = `<span style="font-size:0.7em">GPS:</span>${gpsDisplay} <span style="font-size:0.7em">/ MOT:</span>${motionDisplay}`;
        
        const logMsg = `📊 Display: Comparison - GPS: ${gpsDisplay} SPM, Motion: ${motionDisplay} SPM`;
        if (Math.floor(elapsed) % 5 === 0 && lastLogMessage !== logMsg) {
            console.log(logMsg);
            lastLogMessage = logMsg;
        }
        return;
    }
}

/**
 * Changes stroke rate detection method
 * Called when user changes the dropdown selection
 */
function changeStrokeRateMethod() {
    const method = document.getElementById('strokeRateMethod').value;
    strokeRateMethod = method;
    
    // Update the label to show which method is active
    const label = document.getElementById('strokeRateLabel');
    if (method === 'gps') {
        label.textContent = 'Stroke Rate (GPS)';
    } else if (method === 'motion') {
        label.textContent = 'Stroke Rate (Motion)';
    } else {
        label.textContent = 'Stroke Rate (Both)';
    }
    
    console.log(`⚙️ Stroke rate method changed to: ${method}`);
    
    if (method === 'motion' && !motionPermission) {
        alert('Motion sensors not enabled. Click "Enable" button first.');
    }
}

/* =============================================================================
 * AUDIO ANNOUNCEMENTS
 * ============================================================================= */

/**
 * Handles periodic audio announcements based on user settings - UPDATED!
 * 
 * HOW AUDIO ANNOUNCEMENTS WORK:
 * 1. Check user's settings for announcement frequency
 * 2. Check if enough time has passed since last announcement
 * 3. Speak current metrics using text-to-speech
 * 
 * FIXED: Now announces CURRENT stroke rate, not average
 * 
 * @param {Number} elapsed - Seconds since workout started
 */
function handleAudioAnnouncements(elapsed) {
    // Get user's audio settings from dropdowns
    const strokeRateInterval = parseInt(document.getElementById('strokeRateInterval').value);
    const splitInterval = parseInt(document.getElementById('splitInterval').value);
    
    // STROKE RATE ANNOUNCEMENT
    // Check if: 1) User wants announcements (interval > 0)
    //           2) Enough time has passed since last announcement
    if (strokeRateInterval > 0 && elapsed - lastStrokeRateAnnounce >= strokeRateInterval) {
        // Get CURRENT stroke rate from display (this is the real-time value)
        const currentRate = strokeRateEl.textContent;
        
        // Only announce if we have a valid stroke rate (not "--")
        if (currentRate !== '--') {
            // FIXED: Announce CURRENT rate shown on display
            // This is the immediate stroke rate, not a historical average
            speak(`Stroke rate ${currentRate}`);
            lastStrokeRateAnnounce = elapsed;  // Remember when we announced
            console.log(`🔊 Audio: Announced current stroke rate ${currentRate} SPM`);
        }
    }
    
    // SPLIT TIME ANNOUNCEMENT  
    // Check if: 1) User wants split announcements (interval > 0)
    //           2) Enough time has passed since last split announcement
    if (splitInterval > 0 && elapsed - lastSplitAnnounce >= splitInterval) {
        const currentSplit = splitEl.textContent;
        
        // Only announce if we have a valid split time (not "--:--")
        if (currentSplit !== '--:--') {
            // Convert split time to spoken format
            // Example: "2:30" becomes "Split 2 minutes 30 seconds"
            const splitParts = currentSplit.split(':');
            speak(`Split ${splitParts[0]} minutes ${splitParts[1]} seconds`);
            lastSplitAnnounce = elapsed;  // Remember when we announced
            console.log(`🔊 Audio: Announced split time ${currentSplit}`);
        }
    }
}

/**
 * Speaks text using browser's text-to-speech
 * @param {String} text - Text to speak
 */
function speak(text) {
    // Check if browser supports text-to-speech
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = parseFloat(document.getElementById('voiceSpeed').value); // User's preferred speed
        utterance.volume = 0.8; // Slightly quieter than max
        speechSynthesis.speak(utterance);
    }
}

/* =============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================= */

/**
 * Formats time in seconds to MM:SS format
 * @param {Number} seconds - Time in seconds
 * @returns {String} Formatted time string (e.g., "2:30")
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`; // Ensures 2-digit seconds
}

/**
 * Shows workout summary after workout ends
 * Calculates and displays average statistics
 */
function showWorkoutSummary() {
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Update summary display elements
    document.getElementById('summaryDistance').textContent = Math.round(totalDistance) + 'm';
    document.getElementById('summaryTime').textContent = formatTime(elapsed);
    
    // Calculate average stroke rate if we have data
    if (strokeTimes.length > 0) {
        const avgStrokeRate = strokeTimes.reduce((sum, s) => sum + s.rate, 0) / strokeTimes.length;
        document.getElementById('summaryAvgStrokeRate').textContent = Math.round(avgStrokeRate);
    }
    
    // Calculate average split if we have distance and time
    if (totalDistance > 0 && elapsed > 0) {
        const avgSpeed = totalDistance / elapsed;
        const avgSplit = 500 / avgSpeed;
        document.getElementById('summaryAvgSplit').textContent = formatTime(avgSplit);
    }
    
    // Show the summary panel
    document.getElementById('workoutSummary').style.display = 'block';
}

/* =============================================================================
 * INITIALIZATION - Final setup
 * ============================================================================= */

// Set initial button states when page loads
stopBtn.disabled = true; // Can't stop if we haven't started

// Set initial stroke rate label based on default method
strokeRateLabel.textContent = 'Stroke Rate (GPS)'; // Default is GPS method
