/**
 * Tests for smoothing module: GazeSmoother, MovingAverageSmoother
 */
import { GazeSmoother, MovingAverageSmoother } from '@/lib/smoothing';

describe('GazeSmoother (EMA)', () => {
  it('should return the first point unchanged', () => {
    const smoother = new GazeSmoother(0.3);
    const result = smoother.smooth({ x: 100, y: 200 });
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('should smooth subsequent points', () => {
    const smoother = new GazeSmoother(0.5);
    smoother.smooth({ x: 100, y: 100 });

    const result = smoother.smooth({ x: 200, y: 200 });
    // With alpha=0.5: result = 0.5*200 + 0.5*100 = 150
    expect(result.x).toBeCloseTo(150);
    expect(result.y).toBeCloseTo(150);
  });

  it('should apply more smoothing with lower alpha', () => {
    const smooth1 = new GazeSmoother(0.1); // Heavy smoothing
    const smooth2 = new GazeSmoother(0.9); // Light smoothing

    smooth1.smooth({ x: 0, y: 0 });
    smooth2.smooth({ x: 0, y: 0 });

    const r1 = smooth1.smooth({ x: 100, y: 100 });
    const r2 = smooth2.smooth({ x: 100, y: 100 });

    // Higher alpha = closer to new value
    expect(r2.x).toBeGreaterThan(r1.x);
    expect(r2.y).toBeGreaterThan(r1.y);
  });

  it('should converge to constant input', () => {
    const smoother = new GazeSmoother(0.3);
    let result = { x: 0, y: 0 };

    for (let i = 0; i < 50; i++) {
      result = smoother.smooth({ x: 500, y: 300 });
    }

    // After many iterations of constant input, should be very close
    expect(result.x).toBeCloseTo(500, 0);
    expect(result.y).toBeCloseTo(300, 0);
  });

  it('should reset properly', () => {
    const smoother = new GazeSmoother(0.3);
    smoother.smooth({ x: 100, y: 100 });
    smoother.smooth({ x: 200, y: 200 });

    smoother.reset();
    expect(smoother.current()).toBeNull();

    // After reset, first point should be returned unchanged
    const result = smoother.smooth({ x: 500, y: 500 });
    expect(result.x).toBe(500);
    expect(result.y).toBe(500);
  });

  it('should clamp alpha to valid range', () => {
    const smoother = new GazeSmoother(0); // Should clamp to 0.05
    smoother.smooth({ x: 0, y: 0 });
    const result = smoother.smooth({ x: 100, y: 100 });
    // With alpha=0.05: result = 0.05*100 + 0.95*0 = 5
    expect(result.x).toBeCloseTo(5);
  });
});

describe('MovingAverageSmoother', () => {
  it('should return exact point for window size 1', () => {
    const smoother = new MovingAverageSmoother(1);
    const r = smoother.smooth({ x: 42, y: 99 });
    expect(r.x).toBe(42);
    expect(r.y).toBe(99);
  });

  it('should average points in window', () => {
    const smoother = new MovingAverageSmoother(3);
    smoother.smooth({ x: 10, y: 10 });
    smoother.smooth({ x: 20, y: 20 });
    const r = smoother.smooth({ x: 30, y: 30 });
    expect(r.x).toBeCloseTo(20);
    expect(r.y).toBeCloseTo(20);
  });

  it('should drop old points beyond window size', () => {
    const smoother = new MovingAverageSmoother(2);
    smoother.smooth({ x: 0, y: 0 });
    smoother.smooth({ x: 100, y: 100 });
    // Window: [0, 100] → avg 50
    const r1 = smoother.smooth({ x: 100, y: 100 });
    // Window: [100, 100] → avg 100
    expect(r1.x).toBeCloseTo(100);
  });

  it('should reset properly', () => {
    const smoother = new MovingAverageSmoother(5);
    smoother.smooth({ x: 100, y: 100 });
    smoother.smooth({ x: 200, y: 200 });
    smoother.reset();

    const r = smoother.smooth({ x: 500, y: 500 });
    expect(r.x).toBe(500);
    expect(r.y).toBe(500);
  });
});
