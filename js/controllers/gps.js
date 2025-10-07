/**
 * Speedcox - GPS Controller
 * Manages GPS tracking, position updates, and GPS-based stroke detection
 */

import { calculateDistance, isRealMovement } from '../utils/calculations.js';
import { GPS_CONFIG } from '../utils/config.js';
import StrokeDetectionService from '../services/strokeDetection.js';

/* =============================================================================
 * GPS CONTROLLER
 * ============================================================================= */

const GPSController = {
    // GPS state
    watchId: null,
    isTracking: false,
    lastPosition: null,
    
    // Callbacks for updating models/UI
    onPositionUpdate: null,
    onError: null,
    onStrokeDetected: null,
    
    // GPS status
    gpsAvailable: false,
    gpsReady: false,
    
    /**
     * Initializes GPS controller and checks availability
     * @param {Object} callbacks - Callback functions
     *   {
     *     onPositionUpdate: (distance, speed, timestamp) => {},
     *     onError: (error) => {},
     *     onStrokeDetected: (strokeRate) => {}
     *   }
     */
    initialize(callbacks) {
        this.onPositionUpdate = callbacks.onPositionUpdate;
        this.onError = callbacks.onError;
        this.onStrokeDetected = callbacks.onStrokeDetected;
        
        // Check if GPS is available
        if ('geolocation' in navigator) {
            this.gpsAvailable = true;
            console.log('✓ GPS available');
            
            // Get initial position to verify GPS is working
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.gpsReady = true;
                    console.log('✓ GPS ready');
                },
                (error) => {
                    console.warn('⚠️ GPS error during initialization:', error.message);
                    if (this.onError) {
                        this.onError(error);
                    }
                }
            );
        } else {
            this.gpsAvailable = false;
            console.warn('⚠️ GPS not supported by this browser');
        }
    },
    
    /**
     * Starts GPS tracking
     * @returns {boolean} True if tracking started successfully
     */
    startTracking() {
        if (!this.gpsAvailable) {
            console.error('❌ Cannot start GPS tracking - not available');
            return false;
        }
        
        if (this.isTracking) {
            console.warn('⚠️ GPS tracking already active');
            return true;
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handlePositionUpdate(position),
            (error) => this.handleError(error),
            {
                enableHighAccuracy: GPS_CONFIG.ENABLE_HIGH_ACCURACY,
                maximumAge: GPS_CONFIG.MAXIMUM_AGE,
                timeout: GPS_CONFIG.TIMEOUT
            }
        );
        
        this.isTracking = true;
        console.log('🌐 GPS tracking started');
        return true;
    },
    
    /**
     * Stops GPS tracking
     */
    stopTracking() {
        if (!this.isTracking || !this.watchId) {
            return;
        }
        
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
        this.isTracking = false;
        this.lastPosition = null;
        
        console.log('🌐 GPS tracking stopped');
    },
    
    /**
     * Handles new GPS position data
     * 
     * CORE GPS TRACKING LOGIC:
     * 1. Extract GPS coordinates from browser
     * 2. Calculate distance from last position
     * 3. Filter out GPS noise (stationary drift)
     * 4. Track speed for split calculation
     * 5. Analyze speed patterns for stroke detection
     * 
     * @param {Position} position - GPS position object from browser
     */
    handlePositionUpdate(position) {
        const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp
        };
        
        // If we have a previous position, calculate movement
        if (this.lastPosition) {
            const distance = calculateDistance(this.lastPosition, currentPos);
            const timeDiff = (currentPos.timestamp - this.lastPosition.timestamp) / 1000;
            
            // Calculate speed
            const speed = timeDiff > 0 ? distance / timeDiff : 0;
            
            // Filter out GPS noise
            if (isRealMovement(distance, speed, GPS_CONFIG.MIN_DISTANCE, GPS_CONFIG.MIN_SPEED)) {
                // This is REAL movement
                console.log(`✓ GPS: Moved ${distance.toFixed(1)}m in ${timeDiff.toFixed(1)}s, Speed: ${speed.toFixed(2)} m/s`);
                
                // Notify callback with movement data
                if (this.onPositionUpdate) {
                    this.onPositionUpdate({
                        distance: distance,
                        speed: speed,
                        timestamp: currentPos.timestamp,
                        position: currentPos
                    });
                }
            } else {
                // GPS noise detected - ignore
                if (distance > 0) {
                    console.log(`⊘ GPS: Ignoring movement (${distance.toFixed(2)}m, ${speed.toFixed(2)} m/s)`);
                }
            }
        } else {
            console.log('📍 GPS: First position acquired');
        }
        
        this.lastPosition = currentPos;
    },
    
    /**
     * Handles GPS errors
     * @param {PositionError} error - GPS error object
     */
    handleError(error) {
        console.error('❌ GPS error:', error.code, error.message);
        
        let errorMessage = 'GPS Error';
        
        switch (error.code) {
            case 1: // PERMISSION_DENIED
                errorMessage = 'GPS: Permission denied';
                break;
            case 2: // POSITION_UNAVAILABLE
                errorMessage = 'GPS: No signal';
                break;
            case 3: // TIMEOUT
                errorMessage = 'GPS: Timeout';
                break;
            default:
                errorMessage = 'GPS: ' + error.message;
        }
        
        if (this.onError) {
            this.onError({
                code: error.code,
                message: errorMessage
            });
        }
    },
    
    /**
     * Analyzes speed patterns for GPS-based stroke detection
     * Should be called by workout model when it receives speed data
     * 
     * @param {Array} speedHistory - Recent speed measurements
     * @param {number} currentSpeed - Current speed
     * @param {number} timestamp - Current timestamp
     * @param {number} lastPeakTime - Last detected peak time
     * @returns {Object|null} Peak detection result
     */
    analyzeSpeedForStrokes(speedHistory, currentSpeed, timestamp, lastPeakTime) {
        const peakResult = StrokeDetectionService.gps.detectSpeedPeak(
            speedHistory,
            currentSpeed,
            timestamp,
            lastPeakTime
        );
        
        if (peakResult && peakResult.isPeak) {
            console.log(`🌊 GPS Stroke: Peak detected! Speed: ${currentSpeed.toFixed(2)} m/s`);
            
            // Notify callback if stroke detected
            if (this.onStrokeDetected) {
                this.onStrokeDetected(peakResult);
            }
        }
        
        return peakResult;
    },
    
    /**
     * Calculates GPS-based stroke rate from peaks
     * @param {Array} speedPeaks - Array of detected speed peaks
     * @returns {number} Stroke rate in SPM
     */
    calculateGPSStrokeRate(speedPeaks) {
        return StrokeDetectionService.gps.calculateStrokeRateFromPeaks(speedPeaks);
    },
    
    /**
     * Resets GPS controller state
     */
    reset() {
        this.lastPosition = null;
    },
    
    /**
     * Gets GPS status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            available: this.gpsAvailable,
            ready: this.gpsReady,
            tracking: this.isTracking
        };
    }
};

export default GPSController;
