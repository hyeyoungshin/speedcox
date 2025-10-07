// My notes:
// What the New app.js Does: Orchestration (Main Job):
// Imports all modules
// Initializes controllers with callbacks
// Coordinates data flow between models/controllers
// Manages UI updates and event handlers

// Key Features:

// Loads settings from storage on startup
// Initializes all controllers (GPS, Motion, Audio)
// Starts/stops workouts with proper lifecycle
// Handles GPS updates → updates WorkoutModel → triggers stroke detection
// Handles motion data → updates SensorModel → detects strokes
// Updates display every 100ms with current metrics
// Manages audio announcements based on intervals
// Shows workout summary and saves to history
// Persists settings when changed

// Data Flow Example (GPS Stroke Detection):
// 

/**
 * Speedcox - Main Application Controller
 * Orchestrates models, controllers, and services for the rowing performance monitor
 */

/* =============================================================================
 * IMPORTS - Modular Architecture
 * ============================================================================= */

// Models (State Management)
import WorkoutModel from './models/workout.js';
import SensorModel from './models/sensors.js';

// Controllers (Hardware/Feature Coordination)
import GPSController from './controllers/gps.js';
import MotionController from './controllers/motion.js';
import AudioController from './controllers/audio.js';

// Services (Business Logic)
import StrokeDetectionService from './services/strokeDetection.js';
import StorageService from './services/storage.js';

// Utilities (Pure Functions)
import { formatTime, calculateSplit, calculateAverage } from './utils/calculations.js';
import { DISPLAY_CONFIG, AUDIO_CONFIG } from './utils/config.js';

/* =============================================================================
 * DOM ELEMENT REFERENCES
 * ============================================================================= */

const elements = {
    // Status indicators
    gpsStatus: document.getElementById('gpsStatus'),
    gpsStatusText: document.getElementById('gpsStatusText'),
    
    // Metric displays
    strokeRate: document.getElementById('strokeRate'),
    strokeRateLabel: document.getElementById('strokeRateLabel'),
    split: document.getElementById('split'),
    distance: document.getElementById('distance'),
    elapsedTime: document.getElementById('elapsedTime'),
    
    // Controls
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    
    // Settings
    strokeRateMethod: document.getElementById('strokeRateMethod'),
    strokeRateInterval: document.getElementById('strokeRateInterval'),
    splitInterval: document.getElementById('splitInterval'),
    voiceSpeed: document.getElementById('voiceSpeed'),
    
    // Summary
    workoutSummary: document.getElementById('workoutSummary'),
    summaryDistance: document.getElementById('summaryDistance'),
    summaryTime: document.getElementById('summaryTime'),
    summaryAvgStrokeRate: document.getElementById('summaryAvgStrokeRate'),
    summaryAvgSplit: document.getElementById('summaryAvgSplit')
};

/* =============================================================================
 * APPLICATION STATE
 * ============================================================================= */

const app = {
    // Display update loop
    updateIntervalId: null,
    
    // Settings
    settings: null,
    
    /**
     * Initializes the application
     * Sets up all controllers, loads settings, and prepares UI
     */
    initialize() {
        console.log('🚀 Initializing Speedcox...');
        
        // Load user settings
        this.loadSettings();
        
        // Initialize controllers
        this.initializeControllers();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI state
        this.initializeUI();
        
        console.log('✓ Speedcox initialized successfully');
    },
    
    /**
     * Loads user settings from storage
     */
    loadSettings() {
        if (StorageService.isAvailable()) {
            this.settings = StorageService.settings.getSettings();
            this.applySettings();
            console.log('✓ Settings loaded');
        } else {
            this.settings = StorageService.settings.getDefaultSettings();
            console.warn('⚠️ Storage not available, using defaults');
        }
    },
    
    /**
     * Applies loaded settings to UI and controllers
     */
    applySettings() {
        // Stroke rate method
        if (elements.strokeRateMethod) {
            elements.strokeRateMethod.value = this.settings.strokeRateMethod;
            SensorModel.setStrokeRateMethod(this.settings.strokeRateMethod);
        }
        
        // Audio settings
        if (elements.strokeRateInterval) {
            elements.strokeRateInterval.value = this.settings.strokeRateInterval;
        }
        if (elements.splitInterval) {
            elements.splitInterval.value = this.settings.splitInterval;
        }
        if (elements.voiceSpeed) {
            elements.voiceSpeed.value = this.settings.voiceSpeed;
            AudioController.setVoiceSpeed(parseFloat(this.settings.voiceSpeed));
        }
        
        // Motion sensors
        if (this.settings.enableMotionSensors) {
            MotionController.hasPermission = true;
        }
    },
    
    /**
     * Initializes all controllers with callbacks
     */
    initializeControllers() {
        // Initialize Audio Controller
        AudioController.initialize();
        
        // Initialize GPS Controller
        GPSController.initialize({
            onPositionUpdate: (data) => this.handleGPSUpdate(data),
            onError: (error) => this.handleGPSError(error),
            onStrokeDetected: (peakData) => this.handleGPSStroke(peakData)
        });
        
        // Initialize Motion Controller
        MotionController.initialize({
            onStrokeDetected: (strokeData) => this.handleMotionStroke(strokeData),
            onAccelerationData: (magnitude, timestamp) => this.handleAccelerationData(magnitude, timestamp),
            onPermissionGranted: () => this.handleMotionPermissionGranted(),
            onPermissionDenied: () => this.handleMotionPermissionDenied()
        });
        
        // Update GPS status indicator
        const gpsStatus = GPSController.getStatus();
        if (gpsStatus.available) {
            elements.gpsStatus.classList.add('active');
            elements.gpsStatusText.textContent = 'GPS: Ready';
        } else {
            elements.gpsStatusText.textContent = 'GPS: Not supported';
        }
    },
    
    /**
     * Sets up UI event listeners
     */
    setupEventListeners() {
        // Workout controls
        elements.startBtn.addEventListener('click', () => this.startWorkout());
        elements.stopBtn.addEventListener('click', () => this.stopWorkout());
        
        // Settings changes
        if (elements.strokeRateMethod) {
            elements.strokeRateMethod.addEventListener('change', () => this.changeStrokeRateMethod());
        }
        if (elements.voiceSpeed) {
            elements.voiceSpeed.addEventListener('change', (e) => {
                AudioController.setVoiceSpeed(parseFloat(e.target.value));
                this.saveSettingChange('voiceSpeed', e.target.value);
            });
        }
        if (elements.strokeRateInterval) {
            elements.strokeRateInterval.addEventListener('change', (e) => {
                this.saveSettingChange('strokeRateInterval', parseInt(e.target.value));
            });
        }
        if (elements.splitInterval) {
            elements.splitInterval.addEventListener('change', (e) => {
                this.saveSettingChange('splitInterval', parseInt(e.target.value));
            });
        }
        
        // Reset button (if exists)
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetWorkout());
        }
        
        // Enable motion sensors button (if exists)
        const enableMotionBtn = document.getElementById('enableMotionBtn');
        if (enableMotionBtn) {
            enableMotionBtn.addEventListener('click', () => this.enableMotionSensors());
        }
    },
    
    /**
     * Initializes UI to default state
     */
    initializeUI() {
        elements.stopBtn.disabled = true;
        elements.strokeRate.textContent = '--';
        elements.split.textContent = '--:--';
        elements.distance.textContent = '0m';
        elements.elapsedTime.textContent = '0:00';
        
        // Set stroke rate label based on method
        this.updateStrokeRateLabel();
    },
    
    /* =========================================================================
     * WORKOUT LIFECYCLE
     * ========================================================================= */
    
    /**
     * Starts a new workout session
     */
    startWorkout() {
        console.log('▶️ Starting workout...');
        
        // Get current stroke rate method
        const method = SensorModel.getStrokeRateMethod();
        const useGPS = (method === 'gps' || method === 'both');
        const useMotion = (method === 'motion' || method === 'both');
        
        // Start workout model
        WorkoutModel.start(
            useGPS,
            (position) => GPSController.handlePositionUpdate(position),
            (error) => GPSController.handleError(error)
        );
        
        // Start GPS tracking if needed
        if (useGPS) {
            GPSController.startTracking();
        }
        
        // Start motion detection if needed and available
        if (useMotion && MotionController.hasPermission) {
            MotionController.startDetection();
        } else if (useMotion && !MotionController.hasPermission) {
            console.warn('⚠️ Motion sensors not enabled');
            alert('Motion sensors not enabled. Click "Enable Motion Sensors" button first.');
        }
        
        // Update UI
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;
        elements.workoutSummary.style.display = 'none';
        
        // Start display update loop
        this.startDisplayUpdates();
        
        // Announce start
        AudioController.announceWorkoutStart();
        
        console.log('✓ Workout started');
    },
    
    /**
     * Stops the current workout session
     */
    stopWorkout() {
        console.log('⏹️ Stopping workout...');
        
        // Stop workout model
        WorkoutModel.stop();
        
        // Stop controllers
        GPSController.stopTracking();
        MotionController.stopDetection();
        
        // Stop display updates
        this.stopDisplayUpdates();
        
        // Update UI
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
        
        // Show summary
        this.showWorkoutSummary();
        
        // Announce stop
        AudioController.announceWorkoutStop();
        
        // Save workout to history
        this.saveWorkout();
        
        console.log('✓ Workout stopped');
    },
    
    /**
     * Resets all workout data
     */
    resetWorkout() {
        console.log('🔄 Resetting workout...');
        
        // Stop if running
        if (WorkoutModel.isRunning) {
            this.stopWorkout();
        }
        
        // Reset models
        WorkoutModel.reset();
        SensorModel.reset();
        
        // Reset controllers
        GPSController.reset();
        
        // Reset UI
        this.initializeUI();
        elements.workoutSummary.style.display = 'none';
        
        console.log('✓ Workout reset');
    },
    
    /* =========================================================================
     * GPS EVENT HANDLERS
     * ========================================================================= */
    
    /**
     * Handles GPS position updates
     * @param {Object} data - GPS update data {distance, speed, timestamp, position}
     */
    handleGPSUpdate(data) {
        // Update workout model with GPS data
        WorkoutModel.totalDistance += data.distance;
        WorkoutModel.speedHistory.push({ 
            speed: data.speed, 
            timestamp: data.timestamp 
        });
        
        // Analyze speed for GPS-based stroke detection
        const peakResult = GPSController.analyzeSpeedForStrokes(
            WorkoutModel.speedHistory,
            data.speed,
            data.timestamp,
            WorkoutModel.lastSpeedPeak
        );
        
        if (peakResult && peakResult.isPeak) {
            WorkoutModel.speedPeaks.push({ 
                speed: peakResult.speed, 
                timestamp: peakResult.timestamp 
            });
            WorkoutModel.lastSpeedPeak = peakResult.timestamp;
            
            // Calculate and update GPS stroke rate
            const gpsRate = GPSController.calculateGPSStrokeRate(WorkoutModel.speedPeaks);
            WorkoutModel.gpsStrokeRate = gpsRate;
            SensorModel.setGPSStrokeRate(gpsRate);
        }
    },
    
    /**
     * Handles GPS errors
     * @param {Object} error - Error object {code, message}
     */
    handleGPSError(error) {
        elements.gpsStatusText.textContent = error.message;
        elements.gpsStatus.classList.remove('active');
    },
    
    /**
     * Handles GPS-based stroke detection
     * @param {Object} peakData - Peak detection data
     */
    handleGPSStroke(peakData) {
        // Already handled in handleGPSUpdate
    },
    
    /* =========================================================================
     * MOTION SENSOR EVENT HANDLERS
     * ========================================================================= */
    
    /**
     * Handles acceleration data from motion sensors
     * @param {number} magnitude - Acceleration magnitude
     * @param {number} timestamp - Timestamp
     */
    handleAccelerationData(magnitude, timestamp) {
        // Store in sensor model
        SensorModel.addAcceleration(magnitude, timestamp);
        
        // Detect strokes if motion detection is active
        if (MotionController.isDetecting) {
            const strokeResult = MotionController.detectStroke(
                SensorModel.accelerationHistory,
                magnitude,
                timestamp,
                SensorModel.lastStrokeDetection
            );
            
            if (strokeResult && strokeResult.detected) {
                // Stroke detected via motion sensors
                WorkoutModel.strokeCount++;
                SensorModel.recordStrokeDetection(strokeResult.timestamp);
                SensorModel.setMotionStrokeRate(strokeResult.strokeRate);
            }
        }
    },
    
    /**
     * Handles motion-based stroke detection
     * @param {Object} strokeData - Stroke detection result
     */
    handleMotionStroke(strokeData) {
        // Already handled in handleAccelerationData
    },
    
    /**
     * Handles motion permission granted
     */
    handleMotionPermissionGranted() {
        console.log('✓ Motion sensors enabled');
        alert('Motion sensors enabled! Start a workout to use real stroke detection.');
        this.saveSettingChange('enableMotionSensors', true);
    },
    
    /**
     * Handles motion permission denied
     */
    handleMotionPermissionDenied() {
        console.log('⊘ Motion sensors denied');
        alert('Motion permission denied. Will use GPS-based stroke detection only.');
        this.saveSettingChange('enableMotionSensors', false);
    },
    
    /**
     * Enables motion sensors (requests permission)
     */
    async enableMotionSensors() {
        const granted = await MotionController.requestPermission();
        if (granted) {
            console.log('✓ Motion sensors ready');
        }
    },
    
    /* =========================================================================
     * DISPLAY UPDATE LOOP
     * ========================================================================= */
    
    /**
     * Starts the display update loop
     */
    startDisplayUpdates() {
        this.updateIntervalId = setInterval(() => {
            this.updateDisplay();
        }, DISPLAY_CONFIG.DISPLAY_UPDATE_INTERVAL);
    },
    
    /**
     * Stops the display update loop
     */
    stopDisplayUpdates() {
        if (this.updateIntervalId) {
            clearInterval(this.updateIntervalId);
            this.updateIntervalId = null;
        }
    },
    
    /**
     * Main display update function
     * Updates all metrics shown on screen
     */
    updateDisplay() {
        if (!WorkoutModel.isRunning) return;
        
        // Update elapsed time
        const elapsed = WorkoutModel.getElapsedTime();
        elements.elapsedTime.textContent = formatTime(elapsed);
        
        // Update distance
        elements.distance.textContent = Math.round(WorkoutModel.totalDistance) + 'm';
        
        // Update split time
        const split = WorkoutModel.getCurrentSplit();
        if (split !== null) {
            elements.split.textContent = formatTime(split);
        }
        
        // Update stroke rate
        this.updateStrokeRateDisplay();
        
        // Handle audio announcements
        this.handleAudioAnnouncements(elapsed);
    },
    
    /**
     * Updates stroke rate display based on selected method
     */
    updateStrokeRateDisplay() {
        const method = SensorModel.getStrokeRateMethod();
        const gpsRate = SensorModel.getGPSStrokeRate();
        const motionRate = SensorModel.getMotionStrokeRate();
        
        if (method === 'gps') {
            elements.strokeRate.textContent = gpsRate > 0 ? gpsRate : '--';
        } else if (method === 'motion') {
            elements.strokeRate.textContent = motionRate > 0 ? motionRate : '--';
        } else if (method === 'both') {
            const gpsDisplay = gpsRate > 0 ? gpsRate : '--';
            const motionDisplay = motionRate > 0 ? motionRate : '--';
            elements.strokeRate.innerHTML = `<span style="font-size:0.7em">GPS:</span>${gpsDisplay} <span style="font-size:0.7em">/ MOT:</span>${motionDisplay}`;
        }
    },
    
    /**
     * Updates stroke rate label based on method
     */
    updateStrokeRateLabel() {
        const method = SensorModel.getStrokeRateMethod();
        if (method === 'gps') {
            elements.strokeRateLabel.textContent = 'Stroke Rate (GPS)';
        } else if (method === 'motion') {
            elements.strokeRateLabel.textContent = 'Stroke Rate (Motion)';
        } else {
            elements.strokeRateLabel.textContent = 'Stroke Rate (Both)';
        }
    },
    
    /* =========================================================================
     * AUDIO ANNOUNCEMENTS
     * ========================================================================= */
    
    /**
     * Handles periodic audio announcements
     * @param {number} elapsed - Elapsed time in seconds
     */
    handleAudioAnnouncements(elapsed) {
        const strokeRateInterval = parseInt(elements.strokeRateInterval.value);
        const splitInterval = parseInt(elements.splitInterval.value);
        
        // Stroke rate announcement
        if (AudioController.shouldAnnounce(WorkoutModel.lastStrokeRateAnnounce, elapsed, strokeRateInterval)) {
            const method = SensorModel.getStrokeRateMethod();
            const strokeRate = SensorModel.getCurrentStrokeRate();
            
            if (strokeRate && strokeRate !== 0 && strokeRate !== '--') {
                AudioController.announceStrokeRate(strokeRate, method);
                WorkoutModel.markStrokeRateAnnounced();
            }
        }
        
        // Split time announcement
        if (AudioController.shouldAnnounce(WorkoutModel.lastSplitAnnounce, elapsed, splitInterval)) {
            const split = WorkoutModel.getCurrentSplit();
            
            if (split !== null) {
                AudioController.announceSplit(split);
                WorkoutModel.markSplitAnnounced();
            }
        }
    },
    
    /* =========================================================================
     * WORKOUT SUMMARY
     * ========================================================================= */
    
    /**
     * Shows workout summary after workout ends
     */
    showWorkoutSummary() {
        const summary = WorkoutModel.getSummary();
        
        // Update summary display
        elements.summaryDistance.textContent = summary.distance + 'm';
        elements.summaryTime.textContent = formatTime(summary.elapsedTime);
        
        // Calculate average stroke rate
        const method = SensorModel.getStrokeRateMethod();
        let avgStrokeRate = 0;
        
        if (method === 'gps' || method === 'both') {
            avgStrokeRate = WorkoutModel.gpsStrokeRate;
        }
        if (method === 'motion' || method === 'both') {
            const motionRate = SensorModel.getMotionStrokeRate();
            avgStrokeRate = motionRate > 0 ? motionRate : avgStrokeRate;
        }
        
        elements.summaryAvgStrokeRate.textContent = avgStrokeRate > 0 ? avgStrokeRate : '--';
        
        // Calculate average split
        const avgSplit = calculateSplit(summary.avgSpeed);
        if (avgSplit !== null) {
            elements.summaryAvgSplit.textContent = formatTime(avgSplit);
        }
        
        // Show summary panel
        elements.workoutSummary.style.display = 'block';
        
        // Announce summary
        AudioController.announceWorkoutSummary({
            distance: summary.distance,
            elapsedTime: summary.elapsedTime,
            avgStrokeRate: avgStrokeRate,
            avgSplit: avgSplit
        });
    },
    
    /**
     * Saves workout to storage
     */
    saveWorkout() {
        if (!StorageService.isAvailable()) return;
        
        const summary = WorkoutModel.getSummary();
        const method = SensorModel.getStrokeRateMethod();
        
        // Get appropriate stroke rate
        let avgStrokeRate = 0;
        if (method === 'gps' || method === 'both') {
            avgStrokeRate = WorkoutModel.gpsStrokeRate;
        }
        if (method === 'motion' || method === 'both') {
            const motionRate = SensorModel.getMotionStrokeRate();
            avgStrokeRate = motionRate > 0 ? motionRate : avgStrokeRate;
        }
        
        const workoutData = {
            duration: summary.elapsedTime,
            distance: summary.distance,
            avgStrokeRate: avgStrokeRate,
            avgSplit: calculateSplit(summary.avgSpeed),
            strokeCount: summary.strokeCount,
            method: method
        };
        
        StorageService.workouts.saveWorkout(workoutData);
    },
    
    /* =========================================================================
     * SETTINGS MANAGEMENT
     * ========================================================================= */
    
    /**
     * Changes stroke rate detection method
     */
    changeStrokeRateMethod() {
        const method = elements.strokeRateMethod.value;
        SensorModel.setStrokeRateMethod(method);
        this.updateStrokeRateLabel();
        this.saveSettingChange('strokeRateMethod', method);
        
        if (method === 'motion' && !MotionController.hasPermission) {
            alert('Motion sensors not enabled. Click "Enable Motion Sensors" button first.');
        }
    },
    
    /**
     * Saves a single setting change
     * @param {string} key - Setting key
     * @param {*} value - New value
     */
    saveSettingChange(key, value) {
        if (StorageService.isAvailable()) {
            this.settings[key] = value;
            StorageService.settings.updateSetting(key, value);
        }
    }
};

/* =============================================================================
 * APPLICATION STARTUP
 * ============================================================================= */

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
} else {
    app.initialize();
}

// Make app available globally for debugging
window.SpeedcoxApp = app;

// Export for module usage
export default app;