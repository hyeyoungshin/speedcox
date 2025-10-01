# Speedcox: A Web-Based Rowing Performance Monitor with Audio Feedback


## Purpose:
Speedcox is a Progressive Web Application (PWA) designed to replicate and enhance the functionality of the NK SpeedCoach, the industry-standard rowing performance monitor. The primary goal is to provide rowers with real-time stroke rate monitoring and audio feedback using readily available smartphone hardware, eliminating the need for dedicated specialized equipment. By leveraging modern web technologies, Speedcox offers an accessible, cost-effective alternative that can be installed directly on any mobile device.

## Key Features:

### Dual Stroke Rate Detection Methods:

- GPS-Based Detection (NK SpeedCoach Method): Analyzes boat speed fluctuations to infer stroke rate from the characteristic speed patterns during drive and recovery phases
- Motion Sensor Detection: Utilizes smartphone accelerometer data to detect individual rowing strokes through acceleration pattern analysis
- Comparison Mode: Allows simultaneous display of both methods for real-time accuracy validation


### Audio Feedback System:

- Configurable text-to-speech announcements for stroke rate and split times
- Customizable announcement intervals (every 30 seconds, 1 minute, 2 minutes)
- Adjustable voice speed to accommodate different user preferences
- Enables hands-free monitoring without requiring visual attention


### GPS-Based Metrics:

- Real-time distance tracking using Haversine formula for accurate curved-earth calculations
- 500-meter split time calculation based on current boat speed
- GPS noise filtering to eliminate stationary drift (minimum distance and speed thresholds)
- Comprehensive workout summaries with average statistics


### Modern Software Architecture:

- Model-View-Controller (MVC) pattern with clear separation of concerns
- Modular design with specialized components for GPS tracking, motion detection, and audio feedback
- Service-oriented architecture for stroke detection algorithms and data persistence
- Progressive Web App (PWA) capabilities for offline functionality and native-like experience
- Installable on any device without app store requirements

```
speedcox/
├── index.html              # Main HTML structure (view only)
├── css/
│   └── styles.css          # All styling
├── js/
│   ├── app.js              # Main app controller
│   ├── models/
│   │   ├── workout.js      # Workout data model
│   │   └── sensors.js      # Sensor data management
│   ├── controllers/
│   │   ├── gps.js          # GPS tracking logic
│   │   ├── motion.js       # Motion sensor logic
│   │   └── audio.js        # Audio feedback system
│   ├── services/
│   │   ├── strokeDetection.js    # Stroke rate algorithms
│   │   └── storage.js      # Data persistence
│   └── utils/
│       ├── calculations.js # Distance, time formatting
│       └── config.js       # Configuration constants
├── manifest.json           # PWA manifest
└── sw.js                   # Service worker
```


## Technical Challenges:

### Stroke Detection Accuracy:

**Challenge:** Distinguishing genuine rowing strokes from environmental noise (waves, boat rocking, GPS fluctuations)  

**Solution:** Implemented adaptive threshold algorithms that calculate baseline motion/speed and detect significant deviations. For motion sensors, using magnitude of acceleration across all axes (√(x² + y² + z²)) to detect motion regardless of phone orientation. For GPS, detecting speed peaks that exceed 10% above rolling average.


### GPS Signal Processing:
**Challenge:** GPS has natural drift of ±5-10 meters even when stationary, causing false distance accumulation  

**Solution:** Multi-layer filtering: minimum distance threshold (3 meters), minimum speed requirement (0.5 m/s), and time-difference validation to distinguish real movement from GPS noise


### Motion Sensor Permissions:

**Challenge:** iOS 13+ requires explicit user permission for DeviceMotionEvent access, while Android grants automatically  
**Solution:** Implemented conditional permission handling that detects device type and requests permissions appropriately, with graceful fallback to GPS-only mode if denied


### Real-Time Performance:

**Challenge:** Processing high-frequency sensor data (accelerometer updates ~60 Hz, GPS ~1 Hz) without UI lag  

**Solution:** Implemented efficient data structures with sliding time windows, keeping only relevant recent data (10 seconds for acceleration, 30 seconds for speed) and using setTimeout for display updates at manageable 100ms intervals


### Stroke Rate Calculation Timing:

**Challenge:** Providing immediate stroke rate feedback vs. waiting for statistical significance  

**Solution:** For motion sensors, calculate rate from strokes detected in last 10 seconds (not 60), allowing updates within 2-3 strokes. For GPS, use 30-second window of speed peaks to balance responsiveness with accuracy.


### Audio Timing Conflicts:

**Challenge:** Multiple audio announcements could overlap (stroke rate + split time)

**Solution:** Implemented independent timing trackers for each announcement type with user-configurable intervals, preventing audio collisions


### Cross-Platform Sensor Calibration:

**Challenge:** Different phones have varying accelerometer sensitivities and GPS accuracies

**Solution:** User-selectable detection methods allow rowers to choose the most accurate approach for their specific device and mounting configuration


### Deployment & Distribution:

**Challenge:** Avoiding app store requirements while maintaining installability

**Solution:** PWA architecture allows direct installation via browser with manifest.json, providing native app-like experience without distribution overhead



## Future Enhancements:

- Smartwatch integration via Web Bluetooth API for body-mounted stroke detection
- Workout data persistence using localStorage with export capabilities
- Stroke technique analysis using machine learning on acceleration patterns
- Integration with Scala backend for complex algorithm processing and workout history database