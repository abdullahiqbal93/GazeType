/**
 * GazeTracker: Core gaze tracking engine.
 * Manages MediaPipe Face Mesh, gaze extraction, smoothing, blink detection,
 * and coordinate mapping. This is a non-React module used by components.
 */

import { extractGazeRatios, estimateHeadPose, computeEAR, gazeToScreen } from './gazeMath';
import { GazeSmoother } from './smoothing';
import { BlinkDetector } from './blink';
import { CalibrationModel, GazeRatios, HeadPose, Point2D, UserSettings } from './types';

export interface GazeFrame {
  /** Smoothed gaze point on screen */
  gazePoint: Point2D | null;
  /** Raw gaze ratios */
  ratios: GazeRatios | null;
  /** Head pose */
  headPose: HeadPose | null;
  /** Raw landmarks */
  landmarks: { x: number; y: number; z: number }[] | null;
  /** FPS */
  fps: number;
}

type GazeCallback = (frame: GazeFrame) => void;
type BlinkCallback = () => void;

export class GazeTracker {
  private videoElement: HTMLVideoElement | null = null;
  private faceMesh: unknown = null;
  private camera: unknown = null;
  private smoother: GazeSmoother;
  private blinkDetector: BlinkDetector;
  private calibrationModel: CalibrationModel | null = null;
  private onGaze: GazeCallback | null = null;
  private onBlink: BlinkCallback | null = null;
  private isRunning = false;

  // FPS tracking
  private frameCount = 0;
  private lastFpsTime = 0;
  private currentFps = 0;

  // Animation frame
  private animFrameId: number | null = null;

  constructor(settings: UserSettings) {
    this.smoother = new GazeSmoother(settings.smoothingFactor);
    this.blinkDetector = new BlinkDetector(settings.blinkThreshold);
  }

  /**
   * Initialize the face mesh model and connect to video.
   */
  async init(videoElement: HTMLVideoElement): Promise<void> {
    this.videoElement = videoElement;

    // Dynamically import MediaPipe modules
    const FaceMeshModule = await import('@mediapipe/face_mesh');
    const CameraModule = await import('@mediapipe/camera_utils');

    const FaceMesh = FaceMeshModule.FaceMesh;

    this.faceMesh = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    (this.faceMesh as {
      setOptions: (opts: Record<string, unknown>) => void;
      onResults: (cb: (results: unknown) => void) => void;
    }).setOptions({
      maxNumFaces: 1,
      refineLandmarks: true, // Enables iris landmarks (478 total)
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    (this.faceMesh as {
      onResults: (cb: (results: unknown) => void) => void;
    }).onResults((results: unknown) => this.processResults(results));

    this.camera = new CameraModule.Camera(videoElement, {
      onFrame: async () => {
        if (this.faceMesh && this.isRunning) {
          await (this.faceMesh as { send: (opts: { image: HTMLVideoElement }) => Promise<void> }).send({ image: videoElement });
        }
      },
      width: 640,
      height: 480,
    });
  }

  /**
   * Start tracking.
   */
  async start(): Promise<void> {
    if (!this.camera) throw new Error('Call init() first');
    this.isRunning = true;
    this.lastFpsTime = performance.now();
    await (this.camera as { start: () => Promise<void> }).start();
  }

  /**
   * Stop tracking.
   */
  stop(): void {
    this.isRunning = false;
    if (this.camera) {
      (this.camera as { stop: () => void }).stop();
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  /**
   * Set the calibration model to use for coordinate mapping.
   */
  setCalibration(model: CalibrationModel): void {
    this.calibrationModel = model;
    this.smoother.reset();
  }

  /**
   * Update settings.
   */
  updateSettings(settings: Partial<UserSettings>): void {
    if (settings.smoothingFactor !== undefined) {
      this.smoother.setAlpha(settings.smoothingFactor);
    }
    if (settings.blinkThreshold !== undefined) {
      this.blinkDetector.setThreshold(settings.blinkThreshold);
    }
  }

  /**
   * Register callbacks.
   */
  setCallbacks(onGaze: GazeCallback, onBlink?: BlinkCallback): void {
    this.onGaze = onGaze;
    if (onBlink) {
      this.onBlink = onBlink;
      this.blinkDetector.setCallback(() => onBlink());
    }
  }

  /**
   * Get raw gaze ratios (for calibration collection).
   */
  getLastRatios(): { ratios: GazeRatios | null; headPose: HeadPose | null } {
    return { ratios: this.lastRatios, headPose: this.lastHeadPose };
  }

  private lastRatios: GazeRatios | null = null;
  private lastHeadPose: HeadPose | null = null;

  /**
   * Process face mesh results.
   */
  private processResults(results: unknown): void {
    const r = results as { multiFaceLandmarks?: { x: number; y: number; z: number }[][] };
    // Update FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime > 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (!r.multiFaceLandmarks || r.multiFaceLandmarks.length === 0) {
      this.onGaze?.({
        gazePoint: null,
        ratios: null,
        headPose: null,
        landmarks: null,
        fps: this.currentFps,
      });
      return;
    }

    const landmarks = r.multiFaceLandmarks[0];

    // Extract gaze ratios
    const ratios = extractGazeRatios(landmarks);
    this.lastRatios = ratios;

    // Estimate head pose
    const headPose = estimateHeadPose(landmarks);
    this.lastHeadPose = headPose;

    // Blink detection
    if (landmarks.length >= 478) {
      const leftEAR = computeEAR(landmarks, 'left');
      const rightEAR = computeEAR(landmarks, 'right');
      this.blinkDetector.update(leftEAR, rightEAR);
    }

    // Map to screen coordinates if calibrated
    let gazePoint: Point2D | null = null;
    if (ratios && this.calibrationModel) {
      const raw = gazeToScreen(
        ratios,
        this.calibrationModel.weightsX,
        this.calibrationModel.weightsY,
        headPose
      );
      gazePoint = this.smoother.smooth(raw);
    }

    this.onGaze?.({
      gazePoint,
      ratios,
      headPose,
      landmarks,
      fps: this.currentFps,
    });
  }

  /**
   * Destroy and clean up resources.
   */
  destroy(): void {
    this.stop();
    this.faceMesh = null;
    this.camera = null;
    this.videoElement = null;
  }
}
