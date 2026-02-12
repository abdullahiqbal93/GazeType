/**
 * Gaze point smoothing using Exponential Moving Average (EMA).
 * 
 * Design Decision: EMA was chosen over Kalman filtering for MVP because:
 * 1. Simpler to implement and tune (single parameter).
 * 2. Good enough for reducing jitter at 20+ FPS.
 * 3. Lower computational overhead.
 * 4. The smoothing factor can be easily adjusted by users.
 * 
 * The smoothing formula: smoothed = α * new + (1-α) * previous
 * Where α (smoothingFactor) controls responsiveness vs stability.
 * Lower α = more smoothing (stable but laggy)
 * Higher α = less smoothing (responsive but jittery)
 */

import { Point2D } from './types';

export class GazeSmoother {
  private prevPoint: Point2D | null = null;
  private alpha: number;

  /**
   * @param alpha - Smoothing factor (0-1). Default 0.3 for good balance.
   */
  constructor(alpha = 0.3) {
    this.alpha = Math.max(0.05, Math.min(1, alpha));
  }

  /**
   * Update smoothing factor.
   */
  setAlpha(alpha: number): void {
    this.alpha = Math.max(0.05, Math.min(1, alpha));
  }

  /**
   * Apply EMA smoothing to a new gaze point.
   */
  smooth(point: Point2D): Point2D {
    if (!this.prevPoint) {
      this.prevPoint = { ...point };
      return point;
    }

    const smoothed: Point2D = {
      x: this.alpha * point.x + (1 - this.alpha) * this.prevPoint.x,
      y: this.alpha * point.y + (1 - this.alpha) * this.prevPoint.y,
    };

    this.prevPoint = smoothed;
    return smoothed;
  }

  /**
   * Reset the smoother (e.g., after recalibration).
   */
  reset(): void {
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
