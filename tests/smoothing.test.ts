/**
 * Tests for smoothing module: GazeSmoother (One-Euro Filter), MovingAverageSmoother
 */
import { GazeSmoother, MovingAverageSmoother } from '@/lib/smoothing';

// Helper: mock performance.now for deterministic timestamps
let mockTime = 0;
const originalPerfNow = performance.now;

beforeEach(() => {
  mockTime = 0;
  performance.now = () => mockTime;
});

afterEach(() => {
  performance.now = originalPerfNow;
});

describe('GazeSmoother (One-Euro Filter)', () => {
  it('should return the first point close to input', () => {
    const smoother = new GazeSmoother(0.5);
    const result = smoother.smooth({ x: 100, y: 200 });
    expect(result.x).toBeCloseTo(100, 0);
    expect(result.y).toBeCloseTo(200, 0);
  });

  it('should smooth subsequent points (not jump immediately)', () => {
    const smoother = new GazeSmoother(0.5, 0); // disable jitter gate
    mockTime = 0;
    smoother.smooth({ x: 100, y: 100 });
    mockTime = 33; // ~30fps
    const result = smoother.smooth({ x: 200, y: 200 });
    // One-Euro filter shouldn't jump straight to 200; should be between 100 and 200
    expect(result.x).toBeGreaterThan(100);
    expect(result.x).toBeLessThan(200);
  });

  it('should converge to constant input', () => {
    const smoother = new GazeSmoother(0.5, 0);
    let result = { x: 0, y: 0 };

    for (let i = 0; i < 60; i++) {
      mockTime = i * 33;
      result = smoother.smooth({ x: 500, y: 300 });
    }

    // After many frames of constant input, should be very close
    expect(result.x).toBeCloseTo(500, 0);
    expect(result.y).toBeCloseTo(300, 0);
  });

  it('should reset properly', () => {
    const smoother = new GazeSmoother(0.5, 0);
    mockTime = 0;
    smoother.smooth({ x: 100, y: 100 });
    mockTime = 33;
    smoother.smooth({ x: 200, y: 200 });

    smoother.reset();
    expect(smoother.current()).toBeNull();

    // After reset, first point should be returned close to input
    mockTime = 66;
    const result = smoother.smooth({ x: 500, y: 500 });
    expect(result.x).toBeCloseTo(500, 0);
    expect(result.y).toBeCloseTo(500, 0);
  });

  it('should suppress jitter below threshold', () => {
    const smoother = new GazeSmoother(0.5, 5); // 5px jitter gate
    mockTime = 0;
    const first = smoother.smooth({ x: 100, y: 100 });
    mockTime = 33;
    // Move only 1px — below jitter gate
    const second = smoother.smooth({ x: 101, y: 101 });
    expect(second.x).toBeCloseTo(first.x, 0);
    expect(second.y).toBeCloseTo(first.y, 0);
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
