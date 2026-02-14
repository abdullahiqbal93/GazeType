/**
 * Continuous calibration: adapts the gaze model over time using implicit feedback.
 *
 * When a user successfully selects a key via dwell (they looked at a key long
 * enough for it to trigger), the center of that key and the gaze ratios at
 * selection time become an implicit calibration sample.
 *
 * This module:
 * 1. Collects implicit samples from key selections
 * 2. Buffers them until a threshold is reached
 * 3. Retrains / fine-tunes the model using both original + implicit samples
 * 4. Stores implicit samples in IndexedDB for persistence across sessions
 *
 * Design Decision: We fine-tune (not retrain from scratch) to preserve the
 * high-quality explicit calibration as the foundation, while allowing the
 * model to adapt to gradual head drift and posture changes.
 */

import { CalibrationModel, CalibrationSample, GazeRatios, HeadPose, NeuralGazeModel, Point2D } from './types';
import {
  addImplicitSample,
  loadImplicitSamples,
  clearImplicitSamples,
  getImplicitSampleCount,
  loadCalibrationSamples,
  saveRidgeModel,
  saveNeuralModel,
} from './idb';
import { fitCalibrationModel } from './calibration';
import { fineTuneNeuralModel } from './neuralGaze';

/** Default configuration */
const DEFAULT_CONFIG = {
  /** Minimum number of implicit samples before retraining */
  retrainThreshold: 20,
  /** Maximum implicit samples to keep (FIFO) */
  maxSamples: 200,
  /** Weight of implicit samples vs original (0-1). Lower = trust original more */
  implicitWeight: 0.5,
  /** Minimum time between retrains (ms) to avoid thrashing */
  minRetrainInterval: 30_000,
};

export type ContinuousCalibrationCallback = (
  updatedRidge: CalibrationModel | null,
  updatedNeural: NeuralGazeModel | null
) => void;

/**
 * Continuous calibration manager.
 * Collects implicit samples and triggers model retraining when threshold is met.
 */
export class ContinuousCalibrator {
  private pendingSamples: CalibrationSample[] = [];
  private lastRetrainTime = 0;
  private retrainThreshold: number;
  private maxSamples: number;
  private onRetrain: ContinuousCalibrationCallback | null = null;
  private currentRidgeModel: CalibrationModel | null = null;
  private currentNeuralModel: NeuralGazeModel | null = null;
  private isRetraining = false;

  constructor(config?: Partial<typeof DEFAULT_CONFIG>) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.retrainThreshold = cfg.retrainThreshold;
    this.maxSamples = cfg.maxSamples;
  }

  /**
   * Set the callback for when retraining completes.
   */
  setCallback(cb: ContinuousCalibrationCallback): void {
    this.onRetrain = cb;
  }

  /**
   * Set current models (from initial calibration).
   */
  setModels(
    ridge: CalibrationModel | null,
    neural: NeuralGazeModel | null
  ): void {
    this.currentRidgeModel = ridge;
    this.currentNeuralModel = neural;
  }

  /**
   * Record an implicit calibration sample.
   * Called when the user successfully selects a key via dwell.
   *
   * @param keyCenter - Center coordinates of the selected key on screen
   * @param ratios - Gaze ratios at the time of selection
   * @param headPose - Head pose at the time of selection
   */
  async recordImplicitSample(
    keyCenter: Point2D,
    ratios: GazeRatios,
    headPose?: HeadPose | null
  ): Promise<void> {
    const sample: CalibrationSample = {
      target: keyCenter,
      ratios,
      headPose: headPose || undefined,
      timestamp: Date.now(),
    };

    // Add to pending buffer
    this.pendingSamples.push(sample);

    // Persist to IndexedDB
    try {
      await addImplicitSample(sample);
    } catch (e) {
      console.warn('Failed to persist implicit sample:', e);
    }

    // Check if we should retrain
    if (
      this.pendingSamples.length >= this.retrainThreshold &&
      !this.isRetraining &&
      Date.now() - this.lastRetrainTime > DEFAULT_CONFIG.minRetrainInterval
    ) {
      await this.retrain();
    }
  }

  /**
   * Get the number of pending (unretrainable) implicit samples.
   */
  getPendingCount(): number {
    return this.pendingSamples.length;
  }

  /**
   * Force a retrain even if threshold isn't met (e.g., user-triggered).
   */
  async forceRetrain(): Promise<void> {
    if (this.pendingSamples.length > 0 && !this.isRetraining) {
      await this.retrain();
    }
  }

  /**
   * Retrain models using original + implicit samples.
   */
  private async retrain(): Promise<void> {
    this.isRetraining = true;
    this.lastRetrainTime = Date.now();

    try {
      // Load original calibration samples from IndexedDB
      const originalSamples = await loadCalibrationSamples();
      const implicitSamples = await loadImplicitSamples();

      // Trim implicit samples to maxSamples (keep most recent)
      const trimmedImplicit = implicitSamples.slice(-this.maxSamples);

      // Combine: all original + recent implicit
      const combined = [...originalSamples, ...trimmedImplicit];

      if (combined.length < 9) {
        console.warn('Not enough samples for retraining');
        this.isRetraining = false;
        return;
      }

      let updatedRidge: CalibrationModel | null = null;
      let updatedNeural: NeuralGazeModel | null = null;

      // Retrain ridge model
      try {
        updatedRidge = fitCalibrationModel(combined);
        await saveRidgeModel(updatedRidge);
        this.currentRidgeModel = updatedRidge;
      } catch (e) {
        console.warn('Ridge retraining failed:', e);
      }

      // Fine-tune neural model
      if (this.currentNeuralModel) {
        try {
          updatedNeural = fineTuneNeuralModel(
            this.currentNeuralModel,
            combined,
            50,   // fewer epochs for fine-tuning
            0.0003 // lower learning rate
          );
          await saveNeuralModel(updatedNeural);
          this.currentNeuralModel = updatedNeural;
        } catch (e) {
          console.warn('Neural fine-tuning failed:', e);
        }
      }

      // Clear pending samples (they're now in IndexedDB)
      this.pendingSamples = [];

      // Notify caller
      this.onRetrain?.(updatedRidge, updatedNeural);
    } catch (e) {
      console.error('Continuous calibration retrain failed:', e);
    } finally {
      this.isRetraining = false;
    }
  }

  /**
   * Reset: clear all implicit samples and pending buffer.
   */
  async reset(): Promise<void> {
    this.pendingSamples = [];
    this.lastRetrainTime = 0;
    try {
      await clearImplicitSamples();
    } catch (e) {
      console.warn('Failed to clear implicit samples:', e);
    }
  }

  /**
   * Load persisted implicit sample count (for UI display).
   */
  async getPersistedCount(): Promise<number> {
    try {
      return await getImplicitSampleCount();
    } catch {
      return 0;
    }
  }
}
