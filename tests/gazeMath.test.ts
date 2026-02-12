/**
 * Tests for gaze math utilities
 */
import { buildFeatureVector, gazeToScreen } from '@/lib/gazeMath';
import { GazeRatios } from '@/lib/types';

describe('buildFeatureVector', () => {
  it('should produce correct feature vector without head pose', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.4, leftEyeY: 0.6,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.45, avgY: 0.55,
    };

    const features = buildFeatureVector(ratios);

    expect(features).toHaveLength(12); // 4 per-eye + 5 avg-based + 2 pose + 1 bias
    expect(features[0]).toBeCloseTo(0.4);  // leftEyeX
    expect(features[1]).toBeCloseTo(0.6);  // leftEyeY
    expect(features[2]).toBeCloseTo(0.5);  // rightEyeX
    expect(features[3]).toBeCloseTo(0.5);  // rightEyeY
    expect(features[4]).toBeCloseTo(0.45); // avgX
    expect(features[5]).toBeCloseTo(0.55); // avgY
    expect(features[6]).toBeCloseTo(0.45 * 0.45); // avgX²
    expect(features[7]).toBeCloseTo(0.55 * 0.55); // avgY²
    expect(features[8]).toBeCloseTo(0.45 * 0.55); // avgX*avgY
    expect(features[9]).toBe(0); // yaw (no pose)
    expect(features[10]).toBe(0); // pitch (no pose)
    expect(features[11]).toBe(1); // bias
  });

  it('should include head pose when provided', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    };

    const features = buildFeatureVector(ratios, { yaw: 10, pitch: -5, roll: 0 });

    expect(features[9]).toBeCloseTo(10 / 45); // normalized yaw
    expect(features[10]).toBeCloseTo(-5 / 45); // normalized pitch
  });
});

describe('gazeToScreen', () => {
  it('should compute screen coordinates using weights', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    };

    // Weight on avgX (index 4) maps to screen X, avgY (index 5) maps to screen Y
    const weightsX = [0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 0, 0];
    const weightsY = [0, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 0];

    const point = gazeToScreen(ratios, weightsX, weightsY);

    expect(point.x).toBeCloseTo(500); // 0.5 * 1000
    expect(point.y).toBeCloseTo(500); // 0.5 * 1000
  });

  it('should account for bias term', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0, leftEyeY: 0,
      rightEyeX: 0, rightEyeY: 0,
      avgX: 0, avgY: 0,
    };

    const weightsX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100]; // bias = 100
    const weightsY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 200]; // bias = 200

    const point = gazeToScreen(ratios, weightsX, weightsY);

    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(200);
  });

  it('should clamp output to screen bounds', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    };

    // Weights that produce very large output
    const weightsX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50000];
    const weightsY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -50000];

    const point = gazeToScreen(ratios, weightsX, weightsY, null, 1920, 1080);

    // Should be clamped within bounds + margin
    expect(point.x).toBeLessThanOrEqual(1940);
    expect(point.y).toBeGreaterThanOrEqual(-20);
  });
});
