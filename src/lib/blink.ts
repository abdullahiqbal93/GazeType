/**
 * Blink detection using Eye Aspect Ratio (EAR).
 * 
 * Design Decision: EAR threshold-based detection is used because:
 * 1. It's computationally simple (just landmark distances).
 * 2. Works well with MediaPipe Face Mesh landmarks.
 * 3. The threshold can be calibrated per user.
 * 
 * Blink detection flow:
 * 1. Compute EAR for each frame
 * 2. If EAR drops below threshold → potential blink start
 * 3. If EAR rises above threshold → blink end
 * 4. If blink duration is within valid range → register blink
 * 5. Debounce to prevent double-counting
 */

import { BlinkEvent } from './types';

export class BlinkDetector {
  private threshold: number;
  private minBlinkDuration = 50;   // ms - too short = noise
  private maxBlinkDuration = 500;  // ms - too long = intentional close
  private debounceTime = 300;      // ms between registered blinks

  private isBlinking = false;
  private blinkStartTime = 0;
  private lastBlinkTime = 0;
  private onBlink: ((event: BlinkEvent) => void) | null = null;

  // For tracking consecutive low EAR frames
  private consecutiveLowFrames = 0;
  private readonly minLowFrames = 2; // need at least 2 consecutive low-EAR frames

  constructor(threshold = 0.21) {
    this.threshold = threshold;
  }

  /**
   * Set the blink callback.
   */
  setCallback(callback: (event: BlinkEvent) => void): void {
    this.onBlink = callback;
  }

  /**
   * Update threshold.
   */
  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  /**
   * Process a new EAR value.
   * Call this every frame with the average EAR of both eyes.
   */
  update(leftEAR: number, rightEAR: number): BlinkEvent | null {
    const avgEAR = (leftEAR + rightEAR) / 2;
    const now = performance.now();

    if (avgEAR < this.threshold) {
      this.consecutiveLowFrames++;

      if (!this.isBlinking && this.consecutiveLowFrames >= this.minLowFrames) {
        this.isBlinking = true;
        this.blinkStartTime = now - (this.consecutiveLowFrames * 16); // approximate
      }
    } else {
      if (this.isBlinking) {
        const duration = now - this.blinkStartTime;
        this.isBlinking = false;
        this.consecutiveLowFrames = 0;

        // Check if it's a valid blink
        if (
          duration >= this.minBlinkDuration &&
          duration <= this.maxBlinkDuration &&
          now - this.lastBlinkTime > this.debounceTime
        ) {
          this.lastBlinkTime = now;

          // Determine which eye(s) blinked
          const eye: 'left' | 'right' | 'both' =
            leftEAR < this.threshold && rightEAR < this.threshold
              ? 'both'
              : leftEAR < this.threshold
              ? 'left'
              : 'right';

          const event: BlinkEvent = {
            eye: 'both', // For selection, we mainly care about both-eye blinks
            duration,
            timestamp: now,
          };

          this.onBlink?.(event);
          return event;
        }
      }
      this.consecutiveLowFrames = 0;
    }

    return null;
  }

  /**
   * Reset the detector state.
   */
  reset(): void {
    this.isBlinking = false;
    this.blinkStartTime = 0;
    this.lastBlinkTime = 0;
    this.consecutiveLowFrames = 0;
  }
}
