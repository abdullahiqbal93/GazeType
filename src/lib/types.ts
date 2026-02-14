/**
 * Core type definitions for GazeType application
 */

/** 2D point on screen */
export interface Point2D {
  x: number;
  y: number;
}

/** Normalized gaze ratios from eye tracking */
export interface GazeRatios {
  /** Horizontal ratio (0 = left corner, 1 = right corner) */
  leftEyeX: number;
  /** Vertical ratio (0 = top, 1 = bottom) */
  leftEyeY: number;
  /** Horizontal ratio for right eye */
  rightEyeX: number;
  /** Vertical ratio for right eye */
  rightEyeY: number;
  /** Average horizontal ratio */
  avgX: number;
  /** Average vertical ratio */
  avgY: number;
}

/** Head pose estimation */
export interface HeadPose {
  /** Yaw angle in degrees (left/right rotation) */
  yaw: number;
  /** Pitch angle in degrees (up/down tilt) */
  pitch: number;
  /** Roll angle in degrees */
  roll: number;
}

/** A single calibration sample */
export interface CalibrationSample {
  /** Target screen point the user was looking at */
  target: Point2D;
  /** Measured gaze ratios at that point */
  ratios: GazeRatios;
  /** Optional head pose at sample time */
  headPose?: HeadPose;
  /** Timestamp */
  timestamp: number;
}

/** Calibration model parameters (ridge regression coefficients) */
export interface CalibrationModel {
  /** Coefficients for X prediction: [w0, w1, w2, w3, w4, w5, bias] */
  weightsX: number[];
  /** Coefficients for Y prediction */
  weightsY: number[];
  /** Model quality metric (R²) */
  quality: number;
  /** When the calibration was performed */
  calibratedAt: number;
  /** Number of samples used */
  sampleCount: number;
}

/** Neural network layer weights */
export interface NNLayer {
  weights: number[][];  // [outputDim][inputDim]
  biases: number[];     // [outputDim]
}

/** Neural network gaze model (MLP: 12 → 32 → 16 → 2) */
export interface NeuralGazeModel {
  layers: NNLayer[];
  quality: number;
  calibratedAt: number;
  sampleCount: number;
  /** Training loss history */
  lossHistory: number[];
  /** Target normalization parameters (min/max used during training) */
  targetNorm?: {
    minX: number; maxX: number;
    minY: number; maxY: number;
  };
}

/** Typing session record */
export interface TypingSession {
  id: string;
  startTime: number;
  endTime: number;
  /** Total characters typed (excluding backspaces) */
  totalChars: number;
  /** Total keystrokes including backspaces */
  totalKeystrokes: number;
  /** Number of backspace presses */
  backspaceCount: number;
  /** Words per minute */
  wpm: number;
  /** Accuracy: 1 - (backspaces / totalKeystrokes) */
  accuracy: number;
  /** Final text produced */
  finalText: string;
}

/** Live typing analytics (tracked during a session) */
export interface TypingAnalytics {
  sessionStart: number;
  totalChars: number;
  totalKeystrokes: number;
  backspaceCount: number;
  /** Timestamps of each word completion (space/punctuation after word) */
  wordTimestamps: number[];
  /** Rolling WPM over last 60 seconds */
  currentWpm: number;
  /** Overall WPM for the session */
  overallWpm: number;
  /** Current accuracy */
  accuracy: number;
}

/** Continuous calibration config */
export interface ContinuousCalibrationConfig {
  /** Whether continuous calibration is enabled */
  enabled: boolean;
  /** Minimum dwell confidence to accept as implicit sample */
  minDwellConfidence: number;
  /** Number of implicit samples before retraining */
  retrainThreshold: number;
  /** Maximum stored implicit samples (FIFO) */
  maxSamples: number;
}

/** User settings / preferences */
export interface UserSettings {
  /** Dwell time in milliseconds for key selection */
  dwellTime: number;
  /** Enable blink-to-select */
  blinkSelectEnabled: boolean;
  /** Show gaze cursor on screen */
  showGazeCursor: boolean;
  /** Keyboard key size: 'small' | 'medium' | 'large' */
  keySize: 'small' | 'medium' | 'large';
  /** High contrast mode */
  highContrast: boolean;
  /** Audio feedback on key select */
  audioFeedback: boolean;
  /** Auto-speak completed sentences */
  autoSpeak: boolean;
  /** TTS voice name */
  ttsVoice: string;
  /** TTS speech rate */
  ttsRate: number;
  /** Enable word predictions */
  predictionsEnabled: boolean;
  /** Debug mode - show overlays */
  debugMode: boolean;
  /** Smoothing factor for EMA (0-1, higher = more smoothing) */
  smoothingFactor: number;
  /** Blink detection EAR threshold */
  blinkThreshold: number;
  /** Use neural network model instead of ridge regression */
  useNeuralModel: boolean;
  /** Enable continuous calibration */
  continuousCalibration: boolean;
  /** Show typing analytics panel */
  showAnalytics: boolean;
}

/** Default settings */
export const DEFAULT_SETTINGS: UserSettings = {
  dwellTime: 800,
  blinkSelectEnabled: false,
  showGazeCursor: true,
  keySize: 'large',
  highContrast: false,
  audioFeedback: true,
  autoSpeak: false,
  ttsVoice: '',
  ttsRate: 1.0,
  predictionsEnabled: true,
  debugMode: false,
  smoothingFactor: 0.5,
  blinkThreshold: 0.21,
  useNeuralModel: false,
  continuousCalibration: true,
  showAnalytics: true,
};

/** Blink event */
export interface BlinkEvent {
  /** Which eye blinked */
  eye: 'left' | 'right' | 'both';
  /** Duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

/** Keyboard key definition */
export interface KeyDef {
  /** Display label */
  label: string;
  /** Value to insert */
  value: string;
  /** Width multiplier (1 = normal) */
  width?: number;
  /** Special key type */
  type?: 'char' | 'space' | 'backspace' | 'enter' | 'clear' | 'shift' | 'tts' | 'left' | 'right';
}
