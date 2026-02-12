/**
 * Calibration module: collect samples, fit ridge regression, persist model.
 * 
 * Design Decision: Ridge regression is used instead of simple linear mapping because:
 * 1. It handles the non-linear relationship between eye ratios and screen position
 *    via polynomial features (quadratic terms + cross terms).
 * 2. Regularization (ridge penalty) prevents overfitting with limited calibration points.
 * 3. It's fast to compute in-browser (no iterative optimization needed).
 */

import { CalibrationModel, CalibrationSample, GazeRatios, HeadPose, Point2D } from './types';
import { buildFeatureVector } from './gazeMath';

/** Number of calibration points in the grid */
export const CALIBRATION_POINTS = 9;

/** Samples to collect per calibration point */
export const SAMPLES_PER_POINT = 30;

/** Ridge regression regularization parameter */
const RIDGE_LAMBDA = 1.0;

/**
 * Generate the 9 calibration target points (3x3 grid).
 * Points are positioned with some padding from screen edges.
 */
export function generateCalibrationPoints(
  screenWidth: number,
  screenHeight: number,
  padding = 0.1
): Point2D[] {
  const points: Point2D[] = [];
  const xStart = screenWidth * padding;
  const xEnd = screenWidth * (1 - padding);
  const yStart = screenHeight * padding;
  const yEnd = screenHeight * (1 - padding);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      points.push({
        x: xStart + (col / 2) * (xEnd - xStart),
        y: yStart + (row / 2) * (yEnd - yStart),
      });
    }
  }

  return points;
}

/**
 * Fit ridge regression model from calibration samples.
 * Solves: w = (X^T X + λI)^{-1} X^T y
 * 
 * @param samples - Collected calibration samples
 * @returns CalibrationModel with weights for X and Y prediction
 */
export function fitCalibrationModel(samples: CalibrationSample[]): CalibrationModel {
  if (samples.length < 9) {
    throw new Error(`Need at least 9 samples, got ${samples.length}`);
  }

  const n = samples.length;
  const featureVectors = samples.map((s) =>
    buildFeatureVector(s.ratios, s.headPose)
  );
  const d = featureVectors[0].length; // feature dimension

  // Build X matrix (n x d) and y vectors
  const targetX = samples.map((s) => s.target.x);
  const targetY = samples.map((s) => s.target.y);

  // Compute X^T X (d x d)
  const XtX: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += featureVectors[k][i] * featureVectors[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Add ridge penalty: X^T X + λI
  for (let i = 0; i < d; i++) {
    XtX[i][i] += RIDGE_LAMBDA;
  }

  // Compute X^T y for both x and y targets
  const XtYx: number[] = new Array(d).fill(0);
  const XtYy: number[] = new Array(d).fill(0);
  for (let i = 0; i < d; i++) {
    for (let k = 0; k < n; k++) {
      XtYx[i] += featureVectors[k][i] * targetX[k];
      XtYy[i] += featureVectors[k][i] * targetY[k];
    }
  }

  // Solve (X^T X + λI) w = X^T y using Gaussian elimination
  const weightsX = solveLinearSystem(XtX, XtYx);
  // Rebuild XtX since it's modified in place
  const XtX2: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += featureVectors[k][i] * featureVectors[k][j];
      }
      XtX2[i][j] = sum;
    }
  }
  for (let i = 0; i < d; i++) {
    XtX2[i][i] += RIDGE_LAMBDA;
  }
  const weightsY = solveLinearSystem(XtX2, XtYy);

  // Compute quality (R² score)
  const quality = computeR2(featureVectors, targetX, targetY, weightsX, weightsY);

  return {
    weightsX,
    weightsY,
    quality,
    calibratedAt: Date.now(),
    sampleCount: n,
  };
}

/**
 * Solve Ax = b using Gaussian elimination with partial pivoting.
 * Modifies A and b in place.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Augmented matrix
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    // Swap rows
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Eliminate below
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = Math.abs(aug[i][i]) > 1e-10 ? sum / aug[i][i] : 0;
  }

  return x;
}

/**
 * Compute R² score for the calibration model.
 */
function computeR2(
  features: number[][],
  targetX: number[],
  targetY: number[],
  weightsX: number[],
  weightsY: number[]
): number {
  const n = features.length;
  let ssResX = 0, ssTotX = 0;
  let ssResY = 0, ssTotY = 0;
  const meanX = targetX.reduce((a, b) => a + b, 0) / n;
  const meanY = targetY.reduce((a, b) => a + b, 0) / n;

  for (let i = 0; i < n; i++) {
    let predX = 0, predY = 0;
    for (let j = 0; j < features[i].length; j++) {
      predX += features[i][j] * weightsX[j];
      predY += features[i][j] * weightsY[j];
    }
    ssResX += (targetX[i] - predX) ** 2;
    ssTotX += (targetX[i] - meanX) ** 2;
    ssResY += (targetY[i] - predY) ** 2;
    ssTotY += (targetY[i] - meanY) ** 2;
  }

  const r2x = ssTotX > 0 ? 1 - ssResX / ssTotX : 0;
  const r2y = ssTotY > 0 ? 1 - ssResY / ssTotY : 0;

  return (r2x + r2y) / 2;
}

/**
 * Validate that a calibration model produces reasonable predictions.
 */
export function validateCalibration(
  model: CalibrationModel,
  screenWidth: number,
  screenHeight: number
): boolean {
  // Model should have reasonable quality
  if (model.quality < 0.3) return false;

  // Test a few sample ratios and check predictions are on screen
  const testRatios: GazeRatios = {
    leftEyeX: 0.5, leftEyeY: 0.5,
    rightEyeX: 0.5, rightEyeY: 0.5,
    avgX: 0.5, avgY: 0.5,
  };

  const features = buildFeatureVector(testRatios);
  let predX = 0, predY = 0;
  for (let i = 0; i < features.length; i++) {
    predX += features[i] * model.weightsX[i];
    predY += features[i] * model.weightsY[i];
  }

  // Center gaze should map roughly to center of screen (within generous bounds)
  const margin = 0.5;
  return (
    predX > -screenWidth * margin &&
    predX < screenWidth * (1 + margin) &&
    predY > -screenHeight * margin &&
    predY < screenHeight * (1 + margin)
  );
}
