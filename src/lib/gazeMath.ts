/**
 * Gaze math utilities: extract iris ratios, head pose, and gaze features
 * from MediaPipe Face Mesh landmarks.
 * 
 * MediaPipe Face Mesh provides 478 landmarks (468 face + 10 iris).
 * Iris landmarks: 468-472 (right eye iris), 473-477 (left eye iris)
 */

import { GazeRatios, HeadPose, Point2D } from './types';

// MediaPipe Face Mesh landmark indices
// Left eye contour (from user's perspective, but MediaPipe uses mirrored)
const LEFT_EYE_INDICES = {
  leftCorner: 263,   // outer corner
  rightCorner: 362,  // inner corner (near nose)
  top: 386,          // upper eyelid center
  bottom: 374,       // lower eyelid center
  // For EAR calculation (vertical pairs)
  upperLid1: 385,
  lowerLid1: 380,
  upperLid2: 387,
  lowerLid2: 373,
};

const RIGHT_EYE_INDICES = {
  leftCorner: 133,   // inner corner (near nose)
  rightCorner: 33,   // outer corner
  top: 159,          // upper eyelid center
  bottom: 145,       // lower eyelid center
  upperLid1: 158,
  lowerLid1: 153,
  upperLid2: 160,
  lowerLid2: 144,
};

// Iris center landmark indices (MediaPipe 478 model)
const LEFT_IRIS_CENTER = 473;
const RIGHT_IRIS_CENTER = 468;

// Head pose estimation landmarks
const NOSE_TIP = 1;
const CHIN = 152;
const LEFT_EYE_OUTER = 263;
const RIGHT_EYE_OUTER = 33;
const LEFT_MOUTH = 287;
const RIGHT_MOUTH = 57;

interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute the distance between two 2D points
 */
function dist2D(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Compute the iris position ratio within eye bounding box.
 * Returns (hRatio, vRatio) where:
 *   hRatio: 0 = looking right, 1 = looking left (normalized)
 *   vRatio: 0 = looking up, 1 = looking down
 */
function computeIrisRatio(
  irisCenter: Landmark,
  leftCorner: Landmark,
  rightCorner: Landmark,
  topLid: Landmark,
  bottomLid: Landmark
): { hRatio: number; vRatio: number } {
  // Horizontal: position of iris between left and right corners
  const eyeWidth = dist2D(leftCorner, rightCorner);
  if (eyeWidth < 1e-6) return { hRatio: 0.5, vRatio: 0.5 };

  // Project iris onto the line between corners
  const dx = rightCorner.x - leftCorner.x;
  const dy = rightCorner.y - leftCorner.y;
  const t = ((irisCenter.x - leftCorner.x) * dx + (irisCenter.y - leftCorner.y) * dy) / (dx * dx + dy * dy);
  const hRatio = Math.max(0, Math.min(1, t));

  // Vertical: position between top and bottom lids
  const eyeHeight = dist2D(topLid, bottomLid);
  if (eyeHeight < 1e-6) return { hRatio, vRatio: 0.5 };

  const vdx = bottomLid.x - topLid.x;
  const vdy = bottomLid.y - topLid.y;
  const vt = ((irisCenter.x - topLid.x) * vdx + (irisCenter.y - topLid.y) * vdy) / (vdx * vdx + vdy * vdy);
  const vRatio = Math.max(0, Math.min(1, vt));

  return { hRatio, vRatio };
}

/**
 * Extract gaze ratios from MediaPipe Face Mesh landmarks.
 * Requires the 478-landmark model (with iris tracking).
 */
export function extractGazeRatios(landmarks: Landmark[]): GazeRatios | null {
  if (!landmarks || landmarks.length < 478) {
    return null;
  }

  try {
    // Left eye iris ratio
    const leftIris = landmarks[LEFT_IRIS_CENTER];
    const leftResult = computeIrisRatio(
      leftIris,
      landmarks[LEFT_EYE_INDICES.leftCorner],
      landmarks[LEFT_EYE_INDICES.rightCorner],
      landmarks[LEFT_EYE_INDICES.top],
      landmarks[LEFT_EYE_INDICES.bottom]
    );

    // Right eye iris ratio
    const rightIris = landmarks[RIGHT_IRIS_CENTER];
    const rightResult = computeIrisRatio(
      rightIris,
      landmarks[RIGHT_EYE_INDICES.leftCorner],
      landmarks[RIGHT_EYE_INDICES.rightCorner],
      landmarks[RIGHT_EYE_INDICES.top],
      landmarks[RIGHT_EYE_INDICES.bottom]
    );

    return {
      leftEyeX: leftResult.hRatio,
      leftEyeY: leftResult.vRatio,
      rightEyeX: rightResult.hRatio,
      rightEyeY: rightResult.vRatio,
      avgX: (leftResult.hRatio + rightResult.hRatio) / 2,
      avgY: (leftResult.vRatio + rightResult.vRatio) / 2,
    };
  } catch {
    return null;
  }
}

/**
 * Estimate head pose from face landmarks.
 * Uses a simplified approach based on key landmark positions.
 */
export function estimateHeadPose(landmarks: Landmark[]): HeadPose | null {
  if (!landmarks || landmarks.length < 468) return null;

  try {
    const nose = landmarks[NOSE_TIP];
    const chin = landmarks[CHIN];
    const leftEye = landmarks[LEFT_EYE_OUTER];
    const rightEye = landmarks[RIGHT_EYE_OUTER];
    const leftMouth = landmarks[LEFT_MOUTH];
    const rightMouth = landmarks[RIGHT_MOUTH];

    // Yaw: horizontal asymmetry between nose and eye midpoint
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const mouthMidX = (leftMouth.x + rightMouth.x) / 2;
    const faceCenterX = (eyeMidX + mouthMidX) / 2;
    const yaw = (nose.x - faceCenterX) * 180; // rough degrees

    // Pitch: vertical position of nose relative to eyes and chin
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const faceHeight = chin.y - eyeMidY;
    if (faceHeight < 1e-6) return null;
    const noseRelative = (nose.y - eyeMidY) / faceHeight;
    const pitch = (noseRelative - 0.4) * 90; // rough degrees

    // Roll: angle of eye line
    const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    return { yaw, pitch, roll };
  } catch {
    return null;
  }
}

/**
 * Compute Eye Aspect Ratio (EAR) for blink detection.
 * EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 * Low EAR indicates a blink.
 */
export function computeEAR(landmarks: Landmark[], eye: 'left' | 'right'): number {
  const indices = eye === 'left' ? LEFT_EYE_INDICES : RIGHT_EYE_INDICES;

  const p1 = landmarks[indices.leftCorner];
  const p4 = landmarks[indices.rightCorner];
  const p2 = landmarks[indices.upperLid1];
  const p6 = landmarks[indices.lowerLid1];
  const p3 = landmarks[indices.upperLid2];
  const p5 = landmarks[indices.lowerLid2];

  const horizontal = dist2D(p1, p4);
  if (horizontal < 1e-6) return 0.3; // default open

  const v1 = dist2D(p2, p6);
  const v2 = dist2D(p3, p5);

  return (v1 + v2) / (2 * horizontal);
}

/**
 * Build the feature vector used for calibration regression.
 * Features: [avgX, avgY, avgX², avgY², avgX*avgY, headYaw, headPitch, 1(bias)]
 */
export function buildFeatureVector(ratios: GazeRatios, headPose?: HeadPose | null): number[] {
  const features = [
    ratios.avgX,
    ratios.avgY,
    ratios.avgX * ratios.avgX,
    ratios.avgY * ratios.avgY,
    ratios.avgX * ratios.avgY,
  ];

  if (headPose) {
    features.push(headPose.yaw / 45);  // normalize
    features.push(headPose.pitch / 45);
  } else {
    features.push(0, 0);
  }

  features.push(1); // bias term

  return features;
}

/**
 * Get the gaze point on screen given calibration weights.
 */
export function gazeToScreen(
  ratios: GazeRatios,
  weightsX: number[],
  weightsY: number[],
  headPose?: HeadPose | null
): Point2D {
  const features = buildFeatureVector(ratios, headPose);

  let x = 0;
  let y = 0;
  for (let i = 0; i < features.length && i < weightsX.length; i++) {
    x += features[i] * weightsX[i];
    y += features[i] * weightsY[i];
  }

  return { x, y };
}
