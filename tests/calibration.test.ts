/**
 * Tests for calibration module: fitCalibrationModel, generateCalibrationPoints
 */
import { generateCalibrationPoints, fitCalibrationModel } from '@/lib/calibration';
import { CalibrationSample, GazeRatios } from '@/lib/types';

describe('generateCalibrationPoints', () => {
  it('should generate 9 points in a 3x3 grid', () => {
    const points = generateCalibrationPoints(1920, 1080);
    expect(points).toHaveLength(9);
  });

  it('should have points within screen bounds', () => {
    const w = 1920, h = 1080;
    const points = generateCalibrationPoints(w, h);

    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(w);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(h);
    }
  });

  it('should place corner points with padding', () => {
    const w = 1000, h = 1000;
    const padding = 0.1;
    const points = generateCalibrationPoints(w, h, padding);

    // Top-left
    expect(points[0].x).toBeCloseTo(100);
    expect(points[0].y).toBeCloseTo(100);

    // Bottom-right
    expect(points[8].x).toBeCloseTo(900);
    expect(points[8].y).toBeCloseTo(900);

    // Center
    expect(points[4].x).toBeCloseTo(500);
    expect(points[4].y).toBeCloseTo(500);
  });
});

describe('fitCalibrationModel', () => {
  function makeSample(
    targetX: number,
    targetY: number,
    ratioX: number,
    ratioY: number
  ): CalibrationSample {
    const ratios: GazeRatios = {
      leftEyeX: ratioX,
      leftEyeY: ratioY,
      rightEyeX: ratioX,
      rightEyeY: ratioY,
      avgX: ratioX,
      avgY: ratioY,
    };
    return {
      target: { x: targetX, y: targetY },
      ratios,
      timestamp: Date.now(),
    };
  }

  it('should throw with too few samples', () => {
    const samples = [makeSample(0, 0, 0.5, 0.5)];
    expect(() => fitCalibrationModel(samples)).toThrow();
  });

  it('should fit a model with sufficient samples', () => {
    // Create linearly-related samples: screen = ratio * 1000
    // Need enough samples per point for outlier rejection (first 5 discarded)
    const samples: CalibrationSample[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const rx = (i + 0.5) / 3;
        const ry = (j + 0.5) / 3;
        // Add 12 samples per point (5 discarded by outlier rejection + 7 kept)
        for (let k = 0; k < 12; k++) {
          samples.push(makeSample(rx * 1000, ry * 1000, rx, ry));
        }
      }
    }

    const model = fitCalibrationModel(samples);

    expect(model.weightsX).toBeDefined();
    expect(model.weightsY).toBeDefined();
    expect(model.weightsX.length).toBeGreaterThan(0);
    expect(model.weightsY.length).toBeGreaterThan(0);
    expect(model.quality).toBeGreaterThanOrEqual(0);
    expect(model.quality).toBeLessThanOrEqual(1);
    expect(model.sampleCount).toBeGreaterThan(0);
    expect(model.calibratedAt).toBeGreaterThan(0);
  });

  it('should produce good quality for a clean linear relationship', () => {
    const samples: CalibrationSample[] = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const rx = (i + 0.5) / 3;
        const ry = (j + 0.5) / 3;
        for (let k = 0; k < 15; k++) {
          samples.push(makeSample(rx * 1920, ry * 1080, rx, ry));
        }
      }
    }

    const model = fitCalibrationModel(samples);
    // For a perfectly linear relationship, R² should be very high
    expect(model.quality).toBeGreaterThan(0.8);
  });
});
