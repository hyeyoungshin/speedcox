# speedcoach-AF
a mobile app speedcoach with audio feedback and detailed workout logging

### Advantages
- useful for rowers who want an alternative to dedicated hardware devices
- (not new) combines GPS tracking with stroke rate calculation and (new) audio announcements


### Key Features:
- **GPS Tracking**: Uses the device's GPS to track distance and calculate speed
- **Stroke Rate Monitoring**: Currently simulated (would need accelerometer data in a real implementation)
- **Split Calculation**: Shows 500m split pace based on current speed
- **Audio Announcements**: Configurable voice announcements for stroke rate and split times
- **Workout Summary**: Shows total distance, time, and averages after each session


### Audio Configuration:
- Announce stroke rate: Off, every 30s, 1 min, or 2 min
- Announce split times: Off, every 1 min, 2 min, or 5 min
- Voice speed: Slow, normal, or fast

The GPS functionality will request location permissions when first used.


## Mobile App

Modern smartphones have both _accelerometers_ and _gyroscopes_, and they're accessible through web APIs. This makes it perfect for a mobile web app.

**Real Stroke Detection Features:** The app uses real motion sensors for stroke detection.
- Accelerometer Integration: Uses DeviceMotionEvent to access phone's motion sensors
- iOS Permission Handling: Properly requests permission on iOS 13+ devices
- Smart Stroke Detection: Analyzes acceleration patterns to detect rowing strokes
- Rate Calculation: Calculates actual stroke rate based on detected strokes per minute
- Fallback Mode: Still works with simulated data if motion sensors aren't available

### How It Works:

- Motion Sensing: Continuously monitors phone's acceleration in all three axes
- Pattern Recognition: Looks for acceleration peaks that indicate stroke movements
- Filtering: Prevents double-counting strokes with minimum time intervals
- Rate Calculation: Counts actual strokes in recent time windows to calculate SPM (strokes per minute)

### Mobile Optimization:

- Handles both iOS and Android motion permission models
- Responsive design perfect for phone screens
- Touch-friendly controls
- Battery-efficient sensor sampling

The app will automatically detect if motion sensors are available and use them. If not (like on desktop), it falls back to simulated stroke rates for testing.

### Usage Tips for Rowers:

Mount the phone securely in the boat (waterproof case recommended)
Keep the phone oriented consistently during rowing
The motion detection works best when the phone moves with the rowing motion
For best GPS accuracy, ensure clear sky view


## Advanced Features

### Advanced Audio Settings:

- Stroke Rate Change Alerts: New setting to announce stroke rate whenever it changes by ±2, ±3, or ±5 SPM
- Smart Announcements: Only announces when there's a meaningful change, not constant chatter
- Configurable Sensitivity: Choose how sensitive the change detection should be

### Workout Data Persistence:

- Auto-Save Data: Each workout automatically collects detailed data (stroke rates, splits, GPS points)
- Workout History: "View History" button shows all saved workouts with key stats
- Individual Workout Details: Each saved workout shows date, time, duration, distance, averages
- Data Management: Delete individual workouts or clear entire history
- Local Storage: All data saved locally on the device (up to 50 most recent workouts)

### New Features Added:

1. Rate Change Detection: Announces "Stroke rate up to 24" or "Stroke rate down to 20" when changes occur
2. Workout Saving: After each workout, you can save it with detailed metrics and view it later
3. Comprehensive Data Collection: Each workout stores stroke data, split times, and GPS coordinates throughout the session
4. History Management: Browse, review, and delete saved workouts with an intuitive interface
5. Persistent Storage: Uses localStorage to keep workout history between app sessions

### How the Audio Works:

- Rate Change Alerts: Set to announce when stroke rate changes by 3+ SPM (configurable)
- Regular Intervals: Still announce stroke rate every 30s and splits every 2 minutes
- Smart Timing: Avoids overlapping announcements for better clarity
- Voice Control: Adjustable speech speed (slow/normal/fast)

###  Usage Tips:

- Before Rowing: Enable motion sensors and ensure GPS is working
- During Workout: The app automatically tracks and can announce changes
- After Rowing: Review your summary and save the workout to build your history
- Analysis: Use workout history to track progress over time

### Advantage over Speedcoach
The app now provides a complete rowing training companion with professional-grade features that rival dedicated hardware speedcoaches, but with the added benefit of detailed workout logging and intelligent audio feedback!


## Deployment
- Progressive Web App (PWA)

- Native App Stores
