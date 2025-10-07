/**
 * Speedcox - Storage Service
 * Handles data persistence, workout history, and settings
 */

import { formatTime } from '../utils/calculations.js';

/* =============================================================================
 * LOCAL STORAGE KEYS
 * ============================================================================= */

const STORAGE_KEYS = {
    WORKOUTS: 'speedcox_workouts',
    SETTINGS: 'speedcox_settings',
    LAST_WORKOUT: 'speedcox_last_workout'
};

/* =============================================================================
 * SETTINGS STORAGE
 * ============================================================================= */

/**
 * Settings management service
 * Persists user preferences across sessions
 */
const SettingsStorage = {
    
    /**
     * Gets all user settings from storage
     * @returns {Object} Settings object with defaults if none exist
     */
    getSettings() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        
        // Return defaults if no settings found
        return this.getDefaultSettings();
    },
    
    /**
     * Gets default settings
     * @returns {Object} Default settings object
     */
    getDefaultSettings() {
        return {
            strokeRateMethod: 'gps',          // 'gps', 'motion', or 'both'
            strokeRateInterval: 60,           // Audio announcement interval (seconds)
            splitInterval: 60,                // Split announcement interval (seconds)
            voiceSpeed: 1.0,                  // Speech rate (0.5 - 2.0)
            enableMotionSensors: false,       // Motion sensors enabled
            units: 'metric'                   // 'metric' or 'imperial'
        };
    },
    
    /**
     * Saves settings to storage
     * @param {Object} settings - Settings object to save
     * @returns {boolean} True if successful
     */
    saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            console.log('✓ Settings saved');
            return true;
        } catch (error) {
            console.error('❌ Error saving settings:', error);
            return false;
        }
    },
    
    /**
     * Updates a single setting
     * @param {string} key - Setting key
     * @param {*} value - New value
     * @returns {boolean} True if successful
     */
    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    },
    
    /**
     * Resets settings to defaults
     * @returns {boolean} True if successful
     */
    resetSettings() {
        const defaults = this.getDefaultSettings();
        return this.saveSettings(defaults);
    }
};

/* =============================================================================
 * WORKOUT HISTORY STORAGE
 * ============================================================================= */

/**
 * Workout history management service
 * Stores completed workouts for review and analysis
 */
const WorkoutStorage = {
    
    /**
     * Gets all saved workouts
     * @returns {Array} Array of workout objects, newest first
     */
    getWorkouts() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading workouts:', error);
        }
        return [];
    },
    
    /**
     * Saves a completed workout
     * 
     * WORKOUT DATA STRUCTURE:
     * {
     *   id: timestamp,
     *   date: ISO date string,
     *   duration: seconds,
     *   distance: meters,
     *   avgStrokeRate: SPM,
     *   avgSplit: seconds per 500m,
     *   strokeCount: number,
     *   method: 'gps' | 'motion' | 'both'
     * }
     * 
     * @param {Object} workoutData - Workout data to save
     * @returns {boolean} True if successful
     */
    saveWorkout(workoutData) {
        try {
            const workouts = this.getWorkouts();
            
            // Create workout record
            const workout = {
                id: Date.now(),
                date: new Date().toISOString(),
                duration: workoutData.duration,
                distance: workoutData.distance,
                avgStrokeRate: workoutData.avgStrokeRate,
                avgSplit: workoutData.avgSplit,
                strokeCount: workoutData.strokeCount,
                method: workoutData.method || 'gps'
            };
            
            // Add to beginning of array (newest first)
            workouts.unshift(workout);
            
            // Limit to last 100 workouts to prevent storage overflow
            if (workouts.length > 100) {
                workouts.splice(100);
            }
            
            // Save to storage
            localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
            localStorage.setItem(STORAGE_KEYS.LAST_WORKOUT, JSON.stringify(workout));
            
            console.log('✓ Workout saved:', workout);
            return true;
        } catch (error) {
            console.error('❌ Error saving workout:', error);
            return false;
        }
    },
    
    /**
     * Gets the most recent workout
     * @returns {Object|null} Last workout or null if none
     */
    getLastWorkout() {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.LAST_WORKOUT);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading last workout:', error);
        }
        return null;
    },
    
    /**
     * Deletes a workout by ID
     * @param {number} workoutId - Workout ID to delete
     * @returns {boolean} True if successful
     */
    deleteWorkout(workoutId) {
        try {
            const workouts = this.getWorkouts();
            const filtered = workouts.filter(w => w.id !== workoutId);
            localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(filtered));
            console.log('✓ Workout deleted:', workoutId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting workout:', error);
            return false;
        }
    },
    
    /**
     * Clears all workout history
     * @returns {boolean} True if successful
     */
    clearAllWorkouts() {
        try {
            localStorage.removeItem(STORAGE_KEYS.WORKOUTS);
            localStorage.removeItem(STORAGE_KEYS.LAST_WORKOUT);
            console.log('✓ All workouts cleared');
            return true;
        } catch (error) {
            console.error('❌ Error clearing workouts:', error);
            return false;
        }
    },
    
    /**
     * Gets workout statistics summary
     * @returns {Object} Statistics object
     */
    getStatistics() {
        const workouts = this.getWorkouts();
        
        if (workouts.length === 0) {
            return {
                totalWorkouts: 0,
                totalDistance: 0,
                totalTime: 0,
                avgDistance: 0,
                avgDuration: 0,
                avgStrokeRate: 0
            };
        }
        
        const totalDistance = workouts.reduce((sum, w) => sum + w.distance, 0);
        const totalTime = workouts.reduce((sum, w) => sum + w.duration, 0);
        const totalStrokeRate = workouts.reduce((sum, w) => sum + (w.avgStrokeRate || 0), 0);
        
        return {
            totalWorkouts: workouts.length,
            totalDistance: Math.round(totalDistance),
            totalTime: Math.round(totalTime),
            avgDistance: Math.round(totalDistance / workouts.length),
            avgDuration: Math.round(totalTime / workouts.length),
            avgStrokeRate: Math.round(totalStrokeRate / workouts.length)
        };
    },
    
    /**
     * Formats workout for display
     * @param {Object} workout - Workout object
     * @returns {Object} Formatted workout data
     */
    formatWorkout(workout) {
        return {
            ...workout,
            durationFormatted: formatTime(workout.duration),
            avgSplitFormatted: workout.avgSplit ? formatTime(workout.avgSplit) : '--:--',
            distanceFormatted: `${Math.round(workout.distance)}m`,
            dateFormatted: new Date(workout.date).toLocaleDateString(),
            timeFormatted: new Date(workout.date).toLocaleTimeString()
        };
    }
};

/* =============================================================================
 * EXPORT UNIFIED STORAGE SERVICE
 * ============================================================================= */

const StorageService = {
    settings: SettingsStorage,
    workouts: WorkoutStorage,
    
    /**
     * Checks if localStorage is available
     * @returns {boolean} True if storage is available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            console.warn('⚠️ localStorage not available:', error);
            return false;
        }
    },
    
    /**
     * Exports all data as JSON
     * @returns {Object} All app data
     */
    exportData() {
        return {
            workouts: WorkoutStorage.getWorkouts(),
            settings: SettingsStorage.getSettings(),
            exportDate: new Date().toISOString()
        };
    },
    
    /**
     * Imports data from JSON
     * @param {Object} data - Data to import
     * @returns {boolean} True if successful
     */
    importData(data) {
        try {
            if (data.workouts) {
                localStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(data.workouts));
            }
            if (data.settings) {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
            }
            console.log('✓ Data imported successfully');
            return true;
        } catch (error) {
            console.error('❌ Error importing data:', error);
            return false;
        }
    }
};

export default StorageService;
