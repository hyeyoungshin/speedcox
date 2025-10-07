// My note:
// Controller Design Pattern:
// Each controller:

// Encapsulates specific hardware/feature interaction
// Uses callbacks to communicate with models and UI
// Delegates complex logic to services
// Provides clean API for main app.js to use
// Handles errors and edge cases gracefully


/**
 * Speedcox - Audio Feedback Controller
 * Manages text-to-speech announcements for workout metrics
 */

import { formatTime } from '../utils/calculations.js';
import { AUDIO_CONFIG } from '../utils/config.js';

/* =============================================================================
 * AUDIO CONTROLLER
 * ============================================================================= */

const AudioController = {
    // Audio state
    enabled: true,
    voiceSpeed: AUDIO_CONFIG.DEFAULT_VOICE_RATE,
    volume: AUDIO_CONFIG.VOLUME,
    
    // Speech synthesis
    synth: null,
    isSpeaking: false,
    
    /**
     * Initializes audio controller
     * Checks if text-to-speech is available
     */
    initialize() {
        if ('speechSynthesis' in window) {
            this.synth = window.speechSynthesis;
            this.enabled = true;
            console.log('🔊 Audio controller initialized');
        } else {
            this.enabled = false;
            console.warn('⚠️ Text-to-speech not supported by this browser');
        }
    },
    
    /**
     * Speaks text using browser's text-to-speech
     * 
     * @param {string} text - Text to speak
     * @param {Object} options - Optional speech parameters
     *   {
     *     rate: number (0.5 - 2.0),
     *     volume: number (0.0 - 1.0),
     *     onEnd: () => {}
     *   }
     */
    speak(text, options = {}) {
        if (!this.enabled || !this.synth) {
            console.warn('⚠️ Cannot speak - audio not available');
            return;
        }
        
        // Cancel any ongoing speech
        if (this.isSpeaking) {
            this.synth.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = options.rate || this.voiceSpeed;
        utterance.volume = options.volume || this.volume;
        
        // Track speaking state
        utterance.onstart = () => {
            this.isSpeaking = true;
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            if (options.onEnd) {
                options.onEnd();
            }
        };
        
        utterance.onerror = (error) => {
            console.error('❌ Speech error:', error);
            this.isSpeaking = false;
        };
        
        this.synth.speak(utterance);
        console.log(`🔊 Speaking: "${text}"`);
    },
    
    /**
     * Announces workout started
     */
    announceWorkoutStart() {
        this.speak('Workout started');
    },
    
    /**
     * Announces workout stopped
     */
    announceWorkoutStop() {
        this.speak('Workout stopped');
    },
    
    /**
     * Announces current stroke rate
     * 
     * @param {number|Object} strokeRate - Stroke rate value or {gps, motion} object
     * @param {string} method - Detection method ('gps', 'motion', or 'both')
     */
    announceStrokeRate(strokeRate, method = 'gps') {
        if (!strokeRate || strokeRate === 0) return;
        
        let announcement = '';
        
        if (method === 'both' && typeof strokeRate === 'object') {
            // Announce both rates
            const gpsRate = strokeRate.gps || 0;
            const motionRate = strokeRate.motion || 0;
            
            if (gpsRate > 0 && motionRate > 0) {
                announcement = `Stroke rate: GPS ${gpsRate}, Motion ${motionRate}`;
            } else if (gpsRate > 0) {
                announcement = `GPS stroke rate ${gpsRate}`;
            } else if (motionRate > 0) {
                announcement = `Motion stroke rate ${motionRate}`;
            }
        } else {
            // Simple announcement
            announcement = `Stroke rate ${strokeRate}`;
        }
        
        if (announcement) {
            this.speak(announcement);
            console.log(`📊 Announced: ${announcement}`);
        }
    },
    
    /**
     * Announces current split time (500m pace)
     * 
     * @param {number} splitSeconds - Split time in seconds
     */
    announceSplit(splitSeconds) {
        if (!splitSeconds || splitSeconds <= 0) return;
        
        // Format split time for speaking
        const minutes = Math.floor(splitSeconds / 60);
        const seconds = Math.floor(splitSeconds % 60);
        
        const announcement = `Split ${minutes} minutes ${seconds} seconds`;
        this.speak(announcement);
        console.log(`📊 Announced: ${announcement}`);
    },
    
    /**
     * Announces distance covered
     * 
     * @param {number} distance - Distance in meters
     */
    announceDistance(distance) {
        if (!distance || distance <= 0) return;
        
        const roundedDistance = Math.round(distance);
        let announcement = '';
        
        if (distance >= 1000) {
            const kilometers = (distance / 1000).toFixed(1);
            announcement = `Distance ${kilometers} kilometers`;
        } else {
            announcement = `Distance ${roundedDistance} meters`;
        }
        
        this.speak(announcement);
        console.log(`📊 Announced: ${announcement}`);
    },
    
    /**
     * Announces elapsed time
     * 
     * @param {number} elapsedSeconds - Elapsed time in seconds
     */
    announceElapsedTime(elapsedSeconds) {
        if (!elapsedSeconds || elapsedSeconds <= 0) return;
        
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = Math.floor(elapsedSeconds % 60);
        
        let announcement = '';
        if (minutes > 0) {
            announcement = `Time ${minutes} minutes ${seconds} seconds`;
        } else {
            announcement = `Time ${seconds} seconds`;
        }
        
        this.speak(announcement);
        console.log(`📊 Announced: ${announcement}`);
    },
    
    /**
     * Announces workout summary
     * 
     * @param {Object} summary - Workout summary data
     *   {
     *     distance: number,
     *     elapsedTime: number,
     *     avgStrokeRate: number,
     *     avgSplit: number
     *   }
     */
    announceWorkoutSummary(summary) {
        const parts = ['Workout complete'];
        
        if (summary.distance) {
            const distance = Math.round(summary.distance);
            if (distance >= 1000) {
                parts.push(`${(distance / 1000).toFixed(1)} kilometers`);
            } else {
                parts.push(`${distance} meters`);
            }
        }
        
        if (summary.elapsedTime) {
            const minutes = Math.floor(summary.elapsedTime / 60);
            parts.push(`in ${minutes} minutes`);
        }
        
        if (summary.avgStrokeRate) {
            parts.push(`average stroke rate ${Math.round(summary.avgStrokeRate)}`);
        }
        
        const announcement = parts.join('. ');
        this.speak(announcement);
        console.log(`📊 Announced summary: ${announcement}`);
    },
    
    /**
     * Sets voice speed
     * @param {number} rate - Speech rate (0.5 - 2.0)
     */
    setVoiceSpeed(rate) {
        this.voiceSpeed = Math.max(0.5, Math.min(2.0, rate));
        console.log(`🔊 Voice speed set to ${this.voiceSpeed}`);
    },
    
    /**
     * Sets volume
     * @param {number} volume - Volume (0.0 - 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0.0, Math.min(1.0, volume));
        console.log(`🔊 Volume set to ${this.volume}`);
    },
    
    /**
     * Cancels any ongoing speech
     */
    cancel() {
        if (this.synth && this.isSpeaking) {
            this.synth.cancel();
            this.isSpeaking = false;
            console.log('🔇 Speech cancelled');
        }
    },
    
    /**
     * Checks if audio announcements should be made
     * 
     * @param {number} lastAnnounceTime - Time of last announcement (seconds)
     * @param {number} currentTime - Current time (seconds)
     * @param {number} interval - Announcement interval (seconds)
     * @returns {boolean} True if should announce now
     */
    shouldAnnounce(lastAnnounceTime, currentTime, interval) {
        if (interval <= 0) return false; // Announcements disabled
        return (currentTime - lastAnnounceTime) >= interval;
    },
    
    /**
     * Gets audio controller status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            enabled: this.enabled,
            supported: 'speechSynthesis' in window,
            isSpeaking: this.isSpeaking,
            voiceSpeed: this.voiceSpeed,
            volume: this.volume
        };
    }
};

export default AudioController;
