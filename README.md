# 👁️ GazeType — Eye-Controlled Keyboard + Text-to-Speech

A production-ready MVP of a webcam-based eye-controlled typing web application. Type using your eyes by looking at keys on a virtual keyboard — no special hardware required.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-cyan)
![MediaPipe](https://img.shields.io/badge/MediaPipe-FaceMesh-green)

## Features

- **👀 Real-time gaze tracking** — tracks iris position using MediaPipe Face Mesh (478 landmarks with iris tracking)
- **🎯 9-point calibration** — ridge regression model maps eye ratios to screen coordinates
- **🧠 Neural network gaze model** — optional MLP (12→32→16→2) trained on calibration data for higher accuracy with target normalization
- **🔄 Continuous calibration** — adapts the model over time using implicit feedback from key selections
- **⌨️ Virtual QWERTY keyboard** — dwell-to-select with configurable dwell time
- **😉 Blink-to-select** — optional blink detection using Eye Aspect Ratio (EAR)
- **🔮 Word prediction** — n-gram based autocomplete with top-3 suggestions
- **🔊 Text-to-speech** — Web Speech API integration with voice/rate selection
- **📊 Typing analytics** — live WPM, accuracy, rolling WPM, and session history tracking
- **📊 EMA smoothing** — reduces gaze cursor jitter for usable typing
- **💾 IndexedDB storage** — persistent storage for calibration data, models, implicit samples, and session history
- **♿ Accessibility settings** — dwell time, key size, high contrast, audio feedback
- **🔒 100% private** — all processing happens locally in the browser, no video frames ever uploaded
- **🐛 Debug mode** — visualize gaze point, FPS, and eye ratios in real-time

## Quick Start

```bash
# Clone and install
cd gazetype
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome (recommended) or Edge.

## Usage Flow

1. **Landing page** → Click "Get Started"
2. **Permissions** → Allow camera access (with privacy guarantees)
3. **Calibrate** → Follow 9 dots on screen while looking at each one
4. **Type** → Look at keys to type, use predictions, speak text

## Project Structure

```
gazetype/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Landing page
│   │   ├── permissions/       # Camera permission request
│   │   ├── calibrate/         # 9-point calibration flow
│   │   ├── type/              # Main typing interface
│   │   └── help/              # Help & troubleshooting
│   ├── components/            # React components
│   │   ├── Webcam.tsx         # WebRTC camera capture
│   │   ├── GazeEngine.tsx     # Gaze tracking lifecycle manager
│   │   ├── GazeCursor.tsx     # Floating gaze cursor overlay
│   │   ├── VirtualKeyboard.tsx # QWERTY keyboard with dwell selection
│   │   ├── PredictionBar.tsx  # Word prediction suggestions
│   │   ├── SettingsPanel.tsx  # Accessibility & preference settings
│   │   ├── AnalyticsPanel.tsx # Live typing analytics display
│   │   ├── DebugOverlay.tsx   # Debug info display
│   │   └── AppContext.tsx     # Global state management
│   └── lib/                   # Core logic modules
│       ├── types.ts           # TypeScript type definitions
│       ├── gazeMath.ts        # Iris ratio extraction, head pose, EAR
│       ├── gazeTracker.ts     # MediaPipe integration & tracking engine
│       ├── calibration.ts     # Ridge regression calibration model
│       ├── neuralGaze.ts      # Neural network MLP gaze model
│       ├── continuousCalibration.ts # Implicit feedback calibration
│       ├── analytics.ts       # Typing analytics tracker (WPM, accuracy)
│       ├── smoothing.ts       # EMA & moving average smoothers
│       ├── blink.ts           # Blink detection via EAR threshold
│       ├── ngram.ts           # N-gram word prediction
│       ├── keyboardLayout.ts  # QWERTY layout definition
│       ├── storage.ts         # localStorage persistence
│       ├── idb.ts             # IndexedDB storage for large datasets
│       └── tts.ts             # Text-to-speech wrapper
├── tests/                     # Unit tests
│   ├── calibration.test.ts
│   ├── smoothing.test.ts
│   ├── gazeMath.test.ts
│   ├── ngram.test.ts
│   ├── blink.test.ts
│   ├── neuralGaze.test.ts
│   ├── analytics.test.ts
│   ├── idb.test.ts
│   └── setup.ts              # Jest polyfills
└── package.json
```

## Design Decisions

### Gaze Estimation: Iris Ratio Mapping
We use MediaPipe Face Mesh's iris landmarks (indices 468-477) to compute the relative position of the iris center within the eye bounding box. This gives us normalized horizontal and vertical "gaze ratios" for each eye.

**Why this approach:** It works with any standard webcam, runs entirely in-browser via WebAssembly, and provides sufficient accuracy for a keyboard-sized target grid when combined with calibration.

### Calibration: Ridge Regression
The mapping from eye ratios to screen coordinates uses ridge regression with polynomial features (quadratic terms + cross-terms). The feature vector is: `[avgX, avgY, avgX², avgY², avgX·avgY, headYaw, headPitch, 1]`.

**Why ridge regression over simple linear:**
- Captures non-linearities in the eye-to-screen mapping
- Regularization prevents overfitting with only 9×30 = 270 calibration samples
- Fast closed-form solution (no iterative optimization)
- Gaussian elimination solver implemented from scratch (no heavy linear algebra deps needed at runtime)

### Neural Network Gaze Model (Optional)
An alternative MLP model (12→32→16→2) trained on the same calibration data, with:
- **Target normalization** — targets scaled to [0,1] during training, denormalized on prediction, for stable gradient convergence
- **Xavier initialization** — proper weight scaling for deep networks
- **ReLU activations** on hidden layers, linear output
- **Mini-batch SGD with momentum** (0.9) and L2 regularization (λ=0.0001)
- **Fine-tuning support** — can be incrementally updated via continuous calibration

**Why offer neural alongside ridge:**
- Better captures non-linear eye-to-screen mapping (especially at screen edges)
- Can be fine-tuned with implicit feedback from typing (continuous calibration)
- Ridge regression remains the default for its speed and reliability; neural mode is opt-in

### Continuous Calibration
Records implicit samples whenever the user selects a key — using the gaze position at selection time as a training datum for that key's screen center. After accumulating enough samples (default: 20), both ridge and neural models are retrained in the background.

**Design choices:**
- Maximum 200 implicit samples retained (FIFO to prevent unbounded growth)
- Minimum 30s between retraining passes to avoid churn
- Implicit samples complement (not replace) the original calibration data

### Smoothing: Exponential Moving Average
`smoothed = α × new + (1-α) × previous` with default α = 0.3.

**Why EMA over Kalman:** Simpler to implement and tune, single parameter, good enough at 20+ FPS, and the user can adjust the smoothing factor in settings.

### Blink Detection: Eye Aspect Ratio
EAR = (|p2-p6| + |p3-p5|) / (2 × |p1-p4|) where p1-p6 are eyelid landmarks.

**Thresholds:** Default EAR < 0.21 for blink detection, with minimum 2 consecutive low-EAR frames to avoid noise, debounced at 300ms, and valid blink duration 50-500ms.

### Word Prediction: N-gram Dictionary
A ~200-word common English dictionary with bigram frequency tables. Prefix matching + contextual boosting from previous word.

**Why not a full language model:** Bundle size and latency constraints for an MVP. The n-gram approach provides useful predictions with near-zero overhead.

## Settings

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| Dwell Time | 300-2000ms | 800ms | How long to look at a key to select it |
| Smoothing | 0.05-0.80 | 0.30 | EMA factor (lower = smoother, higher = faster) |
| Key Size | S/M/L | Medium | Virtual keyboard key dimensions |
| High Contrast | On/Off | Off | Yellow-on-black color scheme |
| Audio Feedback | On/Off | On | Click sound on key selection |
| Word Predictions | On/Off | On | Show top-3 word suggestions |
| Blink Select | On/Off | Off | Enable blink-to-click |
| Show Cursor | On/Off | On | Display gaze cursor overlay |
| Debug Mode | On/Off | Off | Show FPS, ratios, coordinates |
| Auto-Speak | On/Off | Off | TTS reads completed sentences |
| Neural Network | On/Off | Off | Use MLP model instead of ridge regression |
| Continuous Calibration | On/Off | On | Adapt model from typing feedback |
| Typing Analytics | On/Off | On | Show live WPM and accuracy stats |

## Tests

```bash
npm test
```

Runs 68 unit tests covering:
- Calibration point generation and model fitting (R² quality)
- EMA and moving average smoothing convergence
- Feature vector construction and screen coordinate mapping
- N-gram prediction with prefix and bigram matching
- Blink detection with EAR thresholds
- Neural network creation, training, convergence, and prediction
- IndexedDB storage for calibration, models, sessions, and implicit samples
- Typing analytics tracking (WPM, accuracy, keystrokes, sessions)

## Manual Test Checklist

- [ ] Camera permission prompt appears with privacy note
- [ ] Camera preview shows with "Camera On" indicator
- [ ] 9-point calibration completes with quality score
- [ ] Gaze cursor moves following eye direction
- [ ] Dwell selection highlights and selects keys
- [ ] Typed text appears in the text area
- [ ] Backspace, Space, Enter, Clear work correctly
- [ ] Word predictions appear and can be selected
- [ ] TTS reads typed text when 🔊 is pressed
- [ ] Settings panel opens and changes persist
- [ ] Dwell time adjustment changes selection speed
- [ ] High contrast mode changes UI colors
- [ ] Debug mode shows FPS and gaze coordinates
- [ ] "Stop Camera" button disables the camera
- [ ] Calibration persists across page refresh
- [ ] No network requests contain video data (check DevTools Network tab)

## Performance Targets

- **20+ FPS** on a typical laptop (MediaPipe Face Mesh is WebAssembly-optimized)
- **< 100ms** input latency from gaze to key highlight
- **Stable gaze cursor** with configurable EMA smoothing

## Privacy Guarantees

- Camera frames are processed **entirely in-browser** using MediaPipe's WASM runtime
- **No video data** is ever sent over the network
- Calibration data and settings stored in **localStorage + IndexedDB** (local only)
- Visible "Camera On" indicator when webcam is active
- One-click "Stop Camera" button available at all times
- No analytics, tracking, or telemetry

## Known Limitations

1. **Accuracy depends on lighting** — needs well-lit face without strong backlighting
2. **Glasses reflections** — reflective lenses can reduce iris tracking accuracy
3. **Head movement** — large head movements reduce accuracy (head pose compensation is basic)
4. **Browser support** — requires WebRTC + WebAssembly (Chrome/Edge recommended)
5. **Calibration drift** — accuracy degrades if user changes position significantly
6. **Small dictionary** — word prediction covers ~200 common words

## Future Improvements

- 👤 **Robust head pose** — full 6-DoF head pose estimation to handle movement
- 🌍 **Multilingual predictions** — support multiple language dictionaries
- ✏️ **Error correction** — auto-correct based on word context
- 📱 **Mobile support** — adapt for tablet/phone front cameras
- 🎨 **Custom keyboard layouts** — AZERTY, Dvorak, symbol layers
- 🔌 **WebSocket API** — expose gaze data for external applications

## Tech Stack

- **Frontend:** Next.js 16, React, TypeScript, TailwindCSS 4
- **Computer Vision:** MediaPipe Face Mesh (478-landmark model with iris tracking)
- **Smoothing:** Custom EMA implementation
- **Calibration:** Ridge regression with polynomial features + optional MLP neural network
- **Predictions:** N-gram dictionary with bigram context
- **TTS:** Web Speech API (speechSynthesis)
- **Storage:** localStorage + IndexedDB
- **Testing:** Jest + ts-jest + fake-indexeddb

## License

MIT
