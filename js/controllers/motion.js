/**
 * Speedcox - Motion Sensor Controller
 * Manages motion sensor permissions, event listeners, and motion-based stroke detection
 */

import { calculateAccelerationMagnitude } from '../utils/calculations.js';
import { MOTION_CONFIG } from '../utils/config.js';
import StrokeDetectionService from '../services/strokeDetection.js';

/* =============================================================================
 * MOTION SENSOR CONTROLLER
 * ============================================================================= */

const MotionController = {
    // Motion sensor state
    hasPermission: false,
    isListening: false,
    isDetecting: false,
    
    // Callbacks for updating models/UI
    onStrokeDetected: null,
    onAccelerationData: null,
    onPermissionGranted: null,
    onPermissionDenied: null,
    
    /**
     * Initializes motion controller
     * @param {Object} callbacks - Callback functions
     *   {
     *     onStrokeDetected: (strokeData) => {},
     *     onAccelerationData: (magnitude, timestamp) => {},
     *     onPermissionGranted: () => {},
     *     onPermissionDenied: () => {}
     *   }
     */
    initialize(callbacks) {
        this.onStrokeDetected = callbacks.onStrokeDetected;
        this.onAccelerationData = callbacks.onAccelerationData;
        this.onPermissionGranted = callbacks.onPermissionGranted;
        this.onPermissionDenied = callbacks.onPermissionDenied;
        
        console.log('📱 Motion controller initialized');
    },
    
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
                    this.hasPermission = true;
                    this.setupListeners();
                    console.log('✓ Motion permission granted on iOS');
                    
                    if (this.onPermissionGranted) {
                        this.onPermissionGranted();
                    }
                    return true;
                } else {
                    console.log('⊘ Motion permission denied on iOS');
                    this.hasPermission = false;
                    
                    if (this.onPermissionDenied) {
                        this.onPermissionDenied();
                    }
                    return false;
                }
            } catch (error) {
                console.error('❌ Error requesting motion permission:', error);
                this.hasPermission = false;
                
                if (this.onPermissionDenied) {
                    this.onPermissionDenied();
                }
                return false;
            }
        } 
        // Android and older iOS - no permission needed
        else if ('DeviceMotionEvent' in window) {
            this.hasPermission = true;
            this.setupListeners();
            console.log('✓ Motion sensors available (Android or older iOS)');
            
            if (this.onPermissionGranted) {
                this.onPermissionGranted();
            }
            return true;
        } 
        // No motion sensor support
        else {
            console.log('⊘ Motion sensors not supported by this browser');
            this.hasPermission = false;
            
            if (this.onPermissionDenied) {
                this.onPermissionDenied();
            }
            return false;
        }
    },
    
    /**
     * Sets up motion sensor event listeners
     * Only called after permission is granted
     */
    setupListeners() {
        if (this.isListening) {
            console.log('⚠️ Motion listeners already set up');
            return;
        }
        
        window.addEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
        this.isListening = true;
        console.log('👂 Motion event listeners activated');
    },
    
    /**
     * Removes motion sensor event listeners
     */
    removeListeners() {
        if (!this.isListening) {
            return;
        }
        
        window.removeEventListener('devicemotion', (event) => this.handleDeviceMotion(event));
        this.isListening = false;
        console.log('🔇 Motion event listeners deactivated');
    },
    
    /**
     * Starts stroke detection from motion data
     * Listeners must already be active
     */
    startDetection() {
        if (!this.hasPermission) {
            console.error('❌ Cannot start detection - no permission');
            return false;
        }
        
        if (!this.isListening) {
            console.error('❌ Cannot start detection - listeners not active');
            return false;
        }
        
        this.isDetecting = true;
        console.log('▶️ Motion stroke detection started');
        return true;
    },
    
    /**
     * Stops stroke detection (but keeps listeners active)
     */
    stopDetection() {
        this.isDetecting = false;
        console.log('⏸️ Motion stroke detection stopped');
    },
    
    /**
     * Processes accelerometer data for stroke detection - EVENT HANDLER
     * Called automatically when device moves
     * 
     * HOW IT WORKS:
     * 1. Extract acceleration from all three axes (x, y, z)
     * 2. Calculate total acceleration magnitude
     * 3. Pass to callback for storage in model
     * 4. If detecting, analyze for stroke patterns
     * 
     * @param {DeviceMotionEvent} event - Motion data from device sensors
     */
    handleDeviceMotion(event) {
        // Only process if we have permission
        if (!this.hasPermission) return;
        
        // Get acceleration data (including gravity)
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration || acceleration.x === null) return;
        
        const timestamp = Date.now();
        
        // Calculate total acceleration magnitude (combines x, y, z axes)
        const magnitude = calculateAccelerationMagnitude(
            acceleration.x,
            acceleration.y,
            acceleration.z
        );
        
        // Notify callback with acceleration data for storage
        if (this.onAccelerationData) {
            this.onAccelerationData(magnitude, timestamp);
        }
        
        // If detection is active, analyze for strokes
        // Note: Actual detection happens in the callback, which will call detectStroke()
    },
    
    /**
     * Analyzes acceleration data for stroke detection
     * Should be called by sensor model after storing acceleration data
     * 
     * @param {Array} accelerationHistory - Recent acceleration data
     * @param {number} currentMagnitude - Current acceleration magnitude
     * @param {number} timestamp - Current timestamp
     * @param {number} lastStrokeTime - Last detected stroke time
     * @returns {Object|null} Stroke detection result
     */
    detectStroke(accelerationHistory, currentMagnitude, timestamp, lastStrokeTime) {
        if (!this.isDetecting) return null;
        
        const strokeResult = StrokeDetectionService.motion.detectStroke(
            accelerationHistory,
            currentMagnitude,
            timestamp,
            lastStrokeTime
        );
        
        if (strokeResult && strokeResult.detected) {
            console.log(`✓ Stroke detected! Rate: ${strokeResult.strokeRate} SPM`);
            
            // Notify callback with stroke data
            if (this.onStrokeDetected) {
                this.onStrokeDetected(strokeResult);
            }
        }
        
        return strokeResult;
    },
    
    /**
     * Gets motion sensor status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            hasPermission: this.hasPermission,
            isListening: this.isListening,
            isDetecting: this.isDetecting,
            supported: 'DeviceMotionEvent' in window
        };
    },
    
    /**
     * Cleans up all motion sensor resources
     */
    cleanup() {
        this.stopDetection();
        this.removeListeners();
        console.log('🧹 Motion controller cleaned up');
    }
};

export default MotionController;
