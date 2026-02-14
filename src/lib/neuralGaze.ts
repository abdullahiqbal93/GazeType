/**
 * Neural network gaze model: a small MLP trained on calibration data.
 *
 * Architecture: 12 → 32 → 16 → 2 (x, y screen coordinates)
 * - ReLU activations on hidden layers
 * - Xavier initialization
 * - Mini-batch stochastic gradient descent with momentum
 * - MSE loss
 *
 * Why a neural network over ridge regression:
 * 1. Better handles non-linear eye-to-screen mapping
 * 2. Can be fine-tuned with continuous calibration (incremental learning)
 * 3. Captures complex interactions between features that polynomial terms miss
 * 4. Still lightweight enough to train in-browser in ~1 second
 */

import { CalibrationSample, GazeRatios, HeadPose, NeuralGazeModel, NNLayer, Point2D } from './types';
import { buildFeatureVector } from './gazeMath';

// ─── Network Architecture ────────────────────────────────────────────

const INPUT_DIM = 12;   // matches buildFeatureVector output
const HIDDEN1 = 32;
const HIDDEN2 = 16;
const OUTPUT_DIM = 2;    // x, y

// ─── Training Hyperparameters ────────────────────────────────────────

const DEFAULT_EPOCHS = 200;
const DEFAULT_LR = 0.001;
const MOMENTUM = 0.9;
const BATCH_SIZE = 32;
const L2_LAMBDA = 0.0001;  // Weight decay

// ─── Math Utilities ──────────────────────────────────────────────────

function relu(x: number): number {
  return x > 0 ? x : 0;
}

function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

/**
 * Normalize a value to [0, 1] given min/max bounds.
 */
function normalizeValue(v: number, min: number, max: number): number {
  const range = max - min;
  return range > 0 ? (v - min) / range : 0.5;
}

/**
 * Denormalize a value from [0, 1] back to original scale.
 */
function denormalizeValue(v: number, min: number, max: number): number {
  return v * (max - min) + min;
}

/**
 * Compute target normalization bounds from training data.
 */
function computeTargetNorm(data: TrainingData[]): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const d of data) {
    if (d.targetX < minX) minX = d.targetX;
    if (d.targetX > maxX) maxX = d.targetX;
    if (d.targetY < minY) minY = d.targetY;
    if (d.targetY > maxY) maxY = d.targetY;
  }
  // Add small padding to avoid exact 0/1 at boundaries
  const padX = (maxX - minX) * 0.05 || 1;
  const padY = (maxY - minY) * 0.05 || 1;
  return {
    minX: minX - padX, maxX: maxX + padX,
    minY: minY - padY, maxY: maxY + padY,
  };
}

/**
 * Xavier initialization: weights ~ N(0, sqrt(2 / (fanIn + fanOut)))
 */
function xavierInit(fanIn: number, fanOut: number): number[][] {
  const std = Math.sqrt(2.0 / (fanIn + fanOut));
  return Array.from({ length: fanOut }, () =>
    Array.from({ length: fanIn }, () => gaussianRandom() * std)
  );
}

/**
 * Box-Muller transform for Gaussian random numbers.
 */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Network Operations ──────────────────────────────────────────────

/**
 * Create a new neural network with Xavier-initialized weights.
 */
export function createNetwork(): NNLayer[] {
  return [
    {
      weights: xavierInit(INPUT_DIM, HIDDEN1),
      biases: new Array(HIDDEN1).fill(0),
    },
    {
      weights: xavierInit(HIDDEN1, HIDDEN2),
      biases: new Array(HIDDEN2).fill(0),
    },
    {
      weights: xavierInit(HIDDEN2, OUTPUT_DIM),
      biases: new Array(OUTPUT_DIM).fill(0),
    },
  ];
}

/**
 * Forward pass through the network.
 * Returns all layer activations for use in backpropagation.
 */
function forward(
  layers: NNLayer[],
  input: number[]
): { activations: number[][]; preActivations: number[][] } {
  const activations: number[][] = [input];
  const preActivations: number[][] = [input];

  let current = input;

  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    const n = layer.biases.length;
    const pre: number[] = new Array(n);
    const act: number[] = new Array(n);

    for (let j = 0; j < n; j++) {
      let sum = layer.biases[j];
      for (let i = 0; i < current.length; i++) {
        sum += layer.weights[j][i] * current[i];
      }
      pre[j] = sum;
      // ReLU on hidden layers, linear on output
      act[j] = l < layers.length - 1 ? relu(sum) : sum;
    }

    preActivations.push(pre);
    activations.push(act);
    current = act;
  }

  return { activations, preActivations };
}

/**
 * Predict screen coordinates from gaze ratios.
 * If targetNorm is provided, denormalizes the output from [0,1] to pixel space.
 */
export function predict(
  layers: NNLayer[],
  ratios: GazeRatios,
  headPose?: HeadPose | null,
  targetNorm?: { minX: number; maxX: number; minY: number; maxY: number }
): Point2D {
  const features = buildFeatureVector(ratios, headPose);
  const { activations } = forward(layers, features);
  const output = activations[activations.length - 1];
  if (targetNorm) {
    return {
      x: denormalizeValue(output[0], targetNorm.minX, targetNorm.maxX),
      y: denormalizeValue(output[1], targetNorm.minY, targetNorm.maxY),
    };
  }
  return { x: output[0], y: output[1] };
}

/**
 * Predict from a raw feature vector.
 * If targetNorm is provided, denormalizes the output from [0,1] to pixel space.
 */
export function predictFromFeatures(
  layers: NNLayer[],
  features: number[],
  targetNorm?: { minX: number; maxX: number; minY: number; maxY: number }
): Point2D {
  const { activations } = forward(layers, features);
  const output = activations[activations.length - 1];
  if (targetNorm) {
    return {
      x: denormalizeValue(output[0], targetNorm.minX, targetNorm.maxX),
      y: denormalizeValue(output[1], targetNorm.minY, targetNorm.maxY),
    };
  }
  return { x: output[0], y: output[1] };
}

// ─── Training ────────────────────────────────────────────────────────

interface TrainingData {
  features: number[];
  targetX: number;
  targetY: number;
}

/**
 * Prepare calibration samples for training.
 */
function prepareData(samples: CalibrationSample[]): TrainingData[] {
  return samples.map((s) => ({
    features: buildFeatureVector(s.ratios, s.headPose),
    targetX: s.target.x,
    targetY: s.target.y,
  }));
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Train the neural network on calibration samples.
 *
 * @param samples - Calibration samples (target + ratios)
 * @param existingLayers - Optional pre-trained layers for fine-tuning
 * @param epochs - Number of training epochs
 * @param lr - Learning rate
 * @returns Trained NeuralGazeModel
 */
export function trainNeuralModel(
  samples: CalibrationSample[],
  existingLayers?: NNLayer[],
  epochs = DEFAULT_EPOCHS,
  lr = DEFAULT_LR,
  existingNorm?: { minX: number; maxX: number; minY: number; maxY: number }
): NeuralGazeModel {
  if (samples.length < 9) {
    throw new Error(`Need at least 9 samples, got ${samples.length}`);
  }

  const data = prepareData(samples);
  const layers = existingLayers ? deepCopyLayers(existingLayers) : createNetwork();
  const lossHistory: number[] = [];

  // Compute target normalization bounds (or reuse existing from fine-tuning)
  const targetNorm = existingNorm ?? computeTargetNorm(data);

  // Normalize targets to [0,1]
  const normData = data.map((d) => ({
    ...d,
    targetX: normalizeValue(d.targetX, targetNorm.minX, targetNorm.maxX),
    targetY: normalizeValue(d.targetY, targetNorm.minY, targetNorm.maxY),
  }));

  // Initialize momentum buffers
  const velocityW: number[][][] = layers.map((l) =>
    l.weights.map((row) => new Array(row.length).fill(0))
  );
  const velocityB: number[][] = layers.map((l) =>
    new Array(l.biases.length).fill(0)
  );

  for (let epoch = 0; epoch < epochs; epoch++) {
    const shuffled = shuffle([...normData]);
    let epochLoss = 0;

    // Mini-batch training
    for (let b = 0; b < shuffled.length; b += BATCH_SIZE) {
      const batch = shuffled.slice(b, b + BATCH_SIZE);
      const batchSize = batch.length;

      // Accumulate gradients
      const gradW: number[][][] = layers.map((l) =>
        l.weights.map((row) => new Array(row.length).fill(0))
      );
      const gradB: number[][] = layers.map((l) =>
        new Array(l.biases.length).fill(0)
      );

      for (const sample of batch) {
        const target = [sample.targetX, sample.targetY];
        const { activations, preActivations } = forward(layers, sample.features);
        const output = activations[activations.length - 1];

        // MSE loss for this sample
        let sampleLoss = 0;
        for (let i = 0; i < OUTPUT_DIM; i++) {
          sampleLoss += (output[i] - target[i]) ** 2;
        }
        epochLoss += sampleLoss / OUTPUT_DIM;

        // Backpropagation
        // Output layer error
        let delta: number[] = new Array(OUTPUT_DIM);
        for (let i = 0; i < OUTPUT_DIM; i++) {
          delta[i] = 2 * (output[i] - target[i]) / OUTPUT_DIM;
        }

        // Backprop through layers (reverse order)
        for (let l = layers.length - 1; l >= 0; l--) {
          const layerInput = activations[l];
          const n = layers[l].biases.length;

          // Apply ReLU derivative for hidden layers
          if (l < layers.length - 1) {
            for (let j = 0; j < n; j++) {
              delta[j] *= reluDerivative(preActivations[l + 1][j]);
            }
          }

          // Accumulate gradients
          for (let j = 0; j < n; j++) {
            for (let i = 0; i < layerInput.length; i++) {
              gradW[l][j][i] += delta[j] * layerInput[i];
            }
            gradB[l][j] += delta[j];
          }

          // Compute delta for previous layer
          if (l > 0) {
            const prevDelta = new Array(layerInput.length).fill(0);
            for (let i = 0; i < layerInput.length; i++) {
              for (let j = 0; j < n; j++) {
                prevDelta[i] += layers[l].weights[j][i] * delta[j];
              }
            }
            delta = prevDelta;
          }
        }
      }

      // Update weights with momentum + L2 regularization
      for (let l = 0; l < layers.length; l++) {
        for (let j = 0; j < layers[l].biases.length; j++) {
          for (let i = 0; i < layers[l].weights[j].length; i++) {
            const grad = gradW[l][j][i] / batchSize + L2_LAMBDA * layers[l].weights[j][i];
            velocityW[l][j][i] = MOMENTUM * velocityW[l][j][i] - lr * grad;
            layers[l].weights[j][i] += velocityW[l][j][i];
          }
          const bGrad = gradB[l][j] / batchSize;
          velocityB[l][j] = MOMENTUM * velocityB[l][j] - lr * bGrad;
          layers[l].biases[j] += velocityB[l][j];
        }
      }
    }

    lossHistory.push(epochLoss / normData.length);
  }

  // Compute quality (R² on training data — in normalized space)
  const quality = computeNNR2(layers, normData);

  return {
    layers,
    quality,
    calibratedAt: Date.now(),
    sampleCount: samples.length,
    lossHistory,
    targetNorm,
  };
}

/**
 * Fine-tune an existing neural model with new samples.
 * Uses a lower learning rate and fewer epochs than initial training.
 */
export function fineTuneNeuralModel(
  model: NeuralGazeModel,
  newSamples: CalibrationSample[],
  epochs = 50,
  lr = 0.0005
): NeuralGazeModel {
  return trainNeuralModel(
    newSamples,
    model.layers,
    epochs,
    lr,
    model.targetNorm
  );
}

// ─── Evaluation ──────────────────────────────────────────────────────

/**
 * Compute R² score for the neural network model.
 */
function computeNNR2(layers: NNLayer[], data: TrainingData[]): number {
  const n = data.length;
  let ssResX = 0, ssTotX = 0;
  let ssResY = 0, ssTotY = 0;
  const meanX = data.reduce((a, d) => a + d.targetX, 0) / n;
  const meanY = data.reduce((a, d) => a + d.targetY, 0) / n;

  for (const d of data) {
    const pred = predictFromFeatures(layers, d.features);
    ssResX += (d.targetX - pred.x) ** 2;
    ssTotX += (d.targetX - meanX) ** 2;
    ssResY += (d.targetY - pred.y) ** 2;
    ssTotY += (d.targetY - meanY) ** 2;
  }

  const r2x = ssTotX > 0 ? 1 - ssResX / ssTotX : 0;
  const r2y = ssTotY > 0 ? 1 - ssResY / ssTotY : 0;

  return (r2x + r2y) / 2;
}

/**
 * Compute mean absolute error in pixels.
 * If targetNorm is provided, denormalizes predictions before comparison.
 */
export function computeMAE(
  layers: NNLayer[],
  samples: CalibrationSample[],
  targetNorm?: { minX: number; maxX: number; minY: number; maxY: number }
): { maeX: number; maeY: number; maeTotal: number } {
  const data = prepareData(samples);
  let totalX = 0, totalY = 0;

  for (const d of data) {
    const pred = predictFromFeatures(layers, d.features, targetNorm);
    totalX += Math.abs(d.targetX - pred.x);
    totalY += Math.abs(d.targetY - pred.y);
  }

  const n = data.length;
  return {
    maeX: totalX / n,
    maeY: totalY / n,
    maeTotal: (totalX + totalY) / (2 * n),
  };
}

// ─── Utility ─────────────────────────────────────────────────────────

/**
 * Deep copy network layers (for fine-tuning without mutating original).
 */
function deepCopyLayers(layers: NNLayer[]): NNLayer[] {
  return layers.map((l) => ({
    weights: l.weights.map((row) => [...row]),
    biases: [...l.biases],
  }));
}

/**
 * Use a neural model for gaze-to-screen mapping (drop-in for gazeToScreen).
 */
export function neuralGazeToScreen(
  ratios: GazeRatios,
  model: NeuralGazeModel,
  headPose?: HeadPose | null,
  screenWidth = 1920,
  screenHeight = 1080
): Point2D {
  const point = predict(model.layers, ratios, headPose, model.targetNorm);

  // Clamp to screen bounds with small margin
  const margin = 20;
  point.x = Math.max(-margin, Math.min(screenWidth + margin, point.x));
  point.y = Math.max(-margin, Math.min(screenHeight + margin, point.y));

  return point;
}
