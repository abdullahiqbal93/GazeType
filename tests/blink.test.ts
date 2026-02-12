/**
 * Tests for blink detection module
 */
import { BlinkDetector } from '@/lib/blink';

describe('BlinkDetector', () => {
  it('should not trigger on high EAR (eyes open)', () => {
    const detector = new BlinkDetector(0.21);
    let blinked = false;
    detector.setCallback(() => { blinked = true; });

    // Simulate open eyes
    for (let i = 0; i < 10; i++) {
      detector.update(0.3, 0.3);
    }

    expect(blinked).toBe(false);
  });

  it('should detect a blink (low EAR followed by high)', (done) => {
    const detector = new BlinkDetector(0.21);
    detector.setCallback(() => { 
      done(); // Test passes when blink is detected
    });

    // Simulate open eyes
    for (let i = 0; i < 5; i++) {
      detector.update(0.3, 0.3);
    }

    // Simulate blink start
    detector.update(0.15, 0.15);
    detector.update(0.15, 0.15);
    detector.update(0.15, 0.15);

    // Wait for minimum blink duration (50ms) then open eyes
    setTimeout(() => {
      detector.update(0.15, 0.15);
      detector.update(0.15, 0.15);
      // Eyes open again → should trigger blink
      detector.update(0.3, 0.3);
    }, 80);
  }, 2000);

  it('should reset properly', () => {
    const detector = new BlinkDetector(0.21);

    // Start a blink
    detector.update(0.3, 0.3);
    detector.update(0.15, 0.15);
    detector.update(0.15, 0.15);

    detector.reset();

    // After reset, should start fresh
    let blinked = false;
    detector.setCallback(() => { blinked = true; });
    detector.update(0.3, 0.3);
    expect(blinked).toBe(false);
  });

  it('should allow threshold to be updated', () => {
    const detector = new BlinkDetector(0.21);
    detector.setThreshold(0.10); // Very low threshold

    let blinked = false;
    detector.setCallback(() => { blinked = true; });

    // EAR of 0.15 is above 0.10 threshold, should NOT trigger
    for (let i = 0; i < 5; i++) {
      detector.update(0.3, 0.3);
    }
    for (let i = 0; i < 5; i++) {
      detector.update(0.15, 0.15);
    }
    detector.update(0.3, 0.3);

    expect(blinked).toBe(false);
  });
});
