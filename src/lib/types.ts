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
  smoothingFactor: 0.3,
  blinkThreshold: 0.21,
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
  type?: 'char' | 'space' | 'backspace' | 'enter' | 'clear' | 'shift' | 'tts';
}
