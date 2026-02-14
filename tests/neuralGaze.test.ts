/**
 * Tests for the neural network gaze model.
 */
import { createNetwork, trainNeuralModel, predict, predictFromFeatures, neuralGazeToScreen, computeMAE, fineTuneNeuralModel } from '../src/lib/neuralGaze';
import { CalibrationSample, GazeRatios, NeuralGazeModel } from '../src/lib/types';

// Helper to create a mock calibration sample
function mockSample(
  targetX: number,
  targetY: number,
  avgX: number,
  avgY: number
): CalibrationSample {
  return {
    target: { x: targetX, y: targetY },
    ratios: {
      leftEyeX: avgX + 0.01,
      leftEyeY: avgY + 0.01,
      rightEyeX: avgX - 0.01,
      rightEyeY: avgY - 0.01,
      avgX,
      avgY,
    },
    timestamp: Date.now(),
  };
}

// Generate a grid of calibration samples (3x3)
function generateSamples(): CalibrationSample[] {
  const samples: CalibrationSample[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const targetX = 192 + col * 768;   // ~10% to ~90% of 1920
      const targetY = 108 + row * 432;   // ~10% to ~90% of 1080
      const avgX = 0.1 + col * 0.4;      // 0.1 to 0.9
      const avgY = 0.1 + row * 0.4;      // 0.1 to 0.9
      // Multiple samples per point
      for (let i = 0; i < 10; i++) {
        samples.push(mockSample(
          targetX,
          targetY,
          avgX + (Math.random() - 0.5) * 0.02,
          avgY + (Math.random() - 0.5) * 0.02
        ));
      }
    }
  }
  return samples;
}

describe('Neural Network Gaze Model', () => {
  describe('createNetwork', () => {
    it('creates a 3-layer network with correct dimensions', () => {
      const layers = createNetwork();
      expect(layers).toHaveLength(3);
      
      // Layer 0: 12 → 32
      expect(layers[0].weights).toHaveLength(32);
      expect(layers[0].weights[0]).toHaveLength(12);
      expect(layers[0].biases).toHaveLength(32);
      
      // Layer 1: 32 → 16
      expect(layers[1].weights).toHaveLength(16);
      expect(layers[1].weights[0]).toHaveLength(32);
      expect(layers[1].biases).toHaveLength(16);
      
      // Layer 2: 16 → 2
      expect(layers[2].weights).toHaveLength(2);
      expect(layers[2].weights[0]).toHaveLength(16);
      expect(layers[2].biases).toHaveLength(2);
    });

    it('initializes with non-zero weights (Xavier)', () => {
      const layers = createNetwork();
      const hasNonZero = layers[0].weights.some((row) =>
        row.some((w) => Math.abs(w) > 1e-10)
      );
      expect(hasNonZero).toBe(true);
    });
  });

  describe('trainNeuralModel', () => {
    it('trains successfully on calibration samples', () => {
      const samples = generateSamples();
      const model = trainNeuralModel(samples, undefined, 50, 0.001);
      
      expect(model.layers).toHaveLength(3);
      expect(model.sampleCount).toBe(samples.length);
      expect(model.calibratedAt).toBeGreaterThan(0);
      expect(model.lossHistory).toHaveLength(50);
    });

    it('reduces loss during training', () => {
      const samples = generateSamples();
      const model = trainNeuralModel(samples, undefined, 100, 0.001);
      
      // Loss should decrease over training
      const firstLoss = model.lossHistory[0];
      const lastLoss = model.lossHistory[model.lossHistory.length - 1];
      expect(lastLoss).toBeLessThan(firstLoss);
    });

    it('throws if too few samples', () => {
      const samples = [mockSample(100, 100, 0.5, 0.5)];
      expect(() => trainNeuralModel(samples)).toThrow('Need at least 9 samples');
    });

    it('achieves reasonable quality (R² > 0) on training data', () => {
      const samples = generateSamples();
      const model = trainNeuralModel(samples, undefined, 200, 0.005);
      expect(model.quality).toBeGreaterThan(0);
    });
  });

  describe('predict', () => {
    it('returns a Point2D from gaze ratios', () => {
      const layers = createNetwork();
      const ratios: GazeRatios = {
        leftEyeX: 0.5, leftEyeY: 0.5,
        rightEyeX: 0.5, rightEyeY: 0.5,
        avgX: 0.5, avgY: 0.5,
      };
      const point = predict(layers, ratios);
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
      expect(isNaN(point.x)).toBe(false);
      expect(isNaN(point.y)).toBe(false);
    });
  });

  describe('predictFromFeatures', () => {
    it('returns a Point2D from raw feature vector', () => {
      const layers = createNetwork();
      const features = new Array(12).fill(0.5);
      features[11] = 1; // bias
      const point = predictFromFeatures(layers, features);
      expect(typeof point.x).toBe('number');
      expect(typeof point.y).toBe('number');
    });
  });

  describe('neuralGazeToScreen', () => {
    it('clamps output to screen bounds', () => {
      const samples = generateSamples();
      const model = trainNeuralModel(samples, undefined, 50, 0.001);
      
      const ratios: GazeRatios = {
        leftEyeX: 0.5, leftEyeY: 0.5,
        rightEyeX: 0.5, rightEyeY: 0.5,
        avgX: 0.5, avgY: 0.5,
      };
      
      const point = neuralGazeToScreen(ratios, model, null, 1920, 1080);
      expect(point.x).toBeGreaterThanOrEqual(-20);
      expect(point.x).toBeLessThanOrEqual(1940);
      expect(point.y).toBeGreaterThanOrEqual(-20);
      expect(point.y).toBeLessThanOrEqual(1100);
    });
  });

  describe('computeMAE', () => {
    it('computes mean absolute error', () => {
      const samples = generateSamples();
      const model = trainNeuralModel(samples, undefined, 100, 0.001);
      const mae = computeMAE(model.layers, samples, model.targetNorm);
      
      expect(typeof mae.maeX).toBe('number');
      expect(typeof mae.maeY).toBe('number');
      expect(typeof mae.maeTotal).toBe('number');
      expect(mae.maeX).toBeGreaterThanOrEqual(0);
      expect(mae.maeY).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fineTuneNeuralModel', () => {
    it('fine-tunes an existing model with new samples', () => {
      const samples = generateSamples();
      const initial = trainNeuralModel(samples, undefined, 50, 0.001);
      
      // Add some new samples
      const newSamples = [
        ...samples,
        mockSample(960, 540, 0.5, 0.5),
        mockSample(960, 540, 0.51, 0.49),
      ];
      
      const finetuned = fineTuneNeuralModel(initial, newSamples, 20, 0.0005);
      expect(finetuned.layers).toHaveLength(3);
      expect(finetuned.sampleCount).toBe(newSamples.length);
    });
  });
});
