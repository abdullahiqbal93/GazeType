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

    expect(features).toHaveLength(8); // 5 base + 2 pose + 1 bias
    expect(features[0]).toBeCloseTo(0.45); // avgX
    expect(features[1]).toBeCloseTo(0.55); // avgY
    expect(features[2]).toBeCloseTo(0.45 * 0.45); // avgX²
    expect(features[3]).toBeCloseTo(0.55 * 0.55); // avgY²
    expect(features[4]).toBeCloseTo(0.45 * 0.55); // avgX*avgY
    expect(features[5]).toBe(0); // yaw (no pose)
    expect(features[6]).toBe(0); // pitch (no pose)
    expect(features[7]).toBe(1); // bias
  });

  it('should include head pose when provided', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    };

    const features = buildFeatureVector(ratios, { yaw: 10, pitch: -5, roll: 0 });

    expect(features[5]).toBeCloseTo(10 / 45); // normalized yaw
    expect(features[6]).toBeCloseTo(-5 / 45); // normalized pitch
  });
});

describe('gazeToScreen', () => {
  it('should compute screen coordinates using weights', () => {
    const ratios: GazeRatios = {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    };

    // Simple identity-like weights: x = avgX * 1000, y = avgY * 1000
    const weightsX = [1000, 0, 0, 0, 0, 0, 0, 0];
    const weightsY = [0, 1000, 0, 0, 0, 0, 0, 0];

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

    const weightsX = [0, 0, 0, 0, 0, 0, 0, 100]; // bias = 100
    const weightsY = [0, 0, 0, 0, 0, 0, 0, 200]; // bias = 200

    const point = gazeToScreen(ratios, weightsX, weightsY);

    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(200);
  });
});
