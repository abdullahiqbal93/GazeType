/**
 * Gaze point smoothing using the One-Euro Filter.
 *
 * Design Decision: One-Euro Filter replaces simple EMA because:
 * 1. It adapts smoothing based on movement speed — smooth when still,
 *    responsive when moving, which is exactly what gaze tracking needs.
 * 2. Eliminates the lag-vs-jitter tradeoff of fixed-alpha EMA.
 * 3. Only two intuitive parameters: minCutoff (jitter) and beta (lag).
 * 4. Industry standard for pointer / gaze smoothing.
 *
 * Reference: Casiez et al., "1€ Filter: A Simple Speed-based Low-pass Filter
 * for Noisy Input in Interactive Systems" (CHI 2012).
 */

import { Point2D } from './types';

/** Low-pass filter for a single axis */
class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.y = value;
      this.s = value;
      return value;
    }
    this.s = alpha * value + (1 - alpha) * this.s!;
    this.y = value;
    return this.s;
  }

  lastValue(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

/**
 * One-Euro Filter for a single axis.
 * Adaptive low-pass filter: low cutoff when still, high cutoff when moving fast.
 */
class OneEuroFilter1D {
  private freq: number;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  /**
   * @param freq - Expected sample rate (Hz).
   * @param minCutoff - Minimum cutoff frequency. Lower = more smoothing when still.
   * @param beta - Speed coefficient. Higher = less lag when moving fast.
   * @param dCutoff - Cutoff for derivative filter.
   */
  constructor(freq = 30, minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number): number {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp?: number): number {
    // Update frequency based on actual frame timing
    if (timestamp !== undefined && this.lastTime !== null) {
      const dt = (timestamp - this.lastTime) / 1000; // ms to seconds
      if (dt > 0) this.freq = 1.0 / dt;
    }
    this.lastTime = timestamp ?? null;

    // Estimate speed (derivative)
    const prevValue = this.xFilter.lastValue();
    const dx = this.xFilter.lastValue() !== undefined
      ? (value - prevValue) * this.freq
      : 0;

    // Smooth the derivative
    const edx = this.dxFilter.filter(dx, this.alpha(this.dCutoff));

    // Adaptive cutoff based on speed
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);

    // Filter the value
    return this.xFilter.filter(value, this.alpha(cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }

  setParams(minCutoff: number, beta: number): void {
    this.minCutoff = minCutoff;
    this.beta = beta;
  }
}

/**
 * One-Euro Filter for 2D gaze points.
 * Adaptive: smooth cursor when eyes are still, responsive when eyes jump.
 */
export class GazeSmoother {
  private filterX: OneEuroFilter1D;
  private filterY: OneEuroFilter1D;
  private prevPoint: Point2D | null = null;
  /** Minimum pixel movement to report (jitter gate) */
  private jitterThreshold: number;

  /**
   * @param alpha - Controls responsiveness (maps to One-Euro beta parameter).
   *   Higher alpha = more responsive (less lag). Range 0.05-1.0.
   *   Default 0.5 for good balance. The alpha param is kept for API compat.
   * @param jitterThreshold - Minimum px movement to avoid micro-jitter. Default 2.
   */
  constructor(alpha = 0.5, jitterThreshold = 1.5) {
    // Map alpha to One-Euro params:
    // Higher alpha → higher beta (less lag) and higher minCutoff (less smoothing)
    // Beta must be large enough to make the cursor responsive to eye movements
    const minCutoff = 1.0 + alpha * 3.0;   // 1.0 – 4.0 Hz
    const beta = 0.3 + alpha * 0.7;        // 0.3 – 1.0
    this.filterX = new OneEuroFilter1D(30, minCutoff, beta);
    this.filterY = new OneEuroFilter1D(30, minCutoff, beta);
    this.jitterThreshold = jitterThreshold;
  }

  /**
   * Update responsiveness. Higher alpha = more responsive.
   */
  setAlpha(alpha: number): void {
    const clamped = Math.max(0.05, Math.min(1, alpha));
    const minCutoff = 1.0 + clamped * 3.0;
    const beta = 0.3 + clamped * 0.7;
    this.filterX.setParams(minCutoff, beta);
    this.filterY.setParams(minCutoff, beta);
  }

  /**
   * Apply One-Euro smoothing to a raw gaze point.
   */
  smooth(point: Point2D): Point2D {
    const now = performance.now();
    const sx = this.filterX.filter(point.x, now);
    const sy = this.filterY.filter(point.y, now);
    const smoothed = { x: sx, y: sy };

    // Jitter gate: ignore tiny movements
    if (this.prevPoint) {
      const dx = smoothed.x - this.prevPoint.x;
      const dy = smoothed.y - this.prevPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.jitterThreshold) {
        return { ...this.prevPoint };
      }
    }

    this.prevPoint = smoothed;
    return smoothed;
  }

  /**
   * Reset the filter (e.g., after recalibration).
   */
  reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.prevPoint = null;
  }

  /**
   * Get the current smoothed point without updating.
   */
  current(): Point2D | null {
    return this.prevPoint ? { ...this.prevPoint } : null;
  }
}

/**
 * Moving average smoother using a fixed-size window.
 * Provides more stable output than EMA at the cost of more latency.
 */
export class MovingAverageSmoother {
  private buffer: Point2D[] = [];
  private windowSize: number;

  constructor(windowSize = 5) {
    this.windowSize = Math.max(1, windowSize);
  }

  smooth(point: Point2D): Point2D {
    this.buffer.push(point);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }

    const avg: Point2D = { x: 0, y: 0 };
    for (const p of this.buffer) {
      avg.x += p.x;
      avg.y += p.y;
    }
    avg.x /= this.buffer.length;
    avg.y /= this.buffer.length;

    return avg;
  }

  reset(): void {
    this.buffer = [];
  }
}
