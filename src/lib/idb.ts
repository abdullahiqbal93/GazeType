/**
 * IndexedDB storage for GazeType.
 *
 * Replaces localStorage for large data (calibration samples, neural model weights,
 * typing session history). Settings remain in localStorage for simplicity.
 *
 * Database schema:
 * - calibration_samples: raw calibration data for retraining
 * - models: trained model weights (ridge + neural)
 * - sessions: typing session history for analytics
 * - implicit_samples: continuous calibration implicit samples
 */

import { CalibrationModel, CalibrationSample, NeuralGazeModel, TypingSession } from './types';

const DB_NAME = 'gazetype_db';
const DB_VERSION = 1;

const STORES = {
  calibrationSamples: 'calibration_samples',
  models: 'models',
  sessions: 'sessions',
  implicitSamples: 'implicit_samples',
} as const;

/**
 * Open (or create) the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Calibration samples: keyed by auto-increment id
      if (!db.objectStoreNames.contains(STORES.calibrationSamples)) {
        db.createObjectStore(STORES.calibrationSamples, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }

      // Models: keyed by type ('ridge' | 'neural')
      if (!db.objectStoreNames.contains(STORES.models)) {
        db.createObjectStore(STORES.models, { keyPath: 'type' });
      }

      // Typing sessions: keyed by session id
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const sessionStore = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        sessionStore.createIndex('startTime', 'startTime', { unique: false });
      }

      // Implicit calibration samples (continuous calibration)
      if (!db.objectStoreNames.contains(STORES.implicitSamples)) {
        db.createObjectStore(STORES.implicitSamples, {
          keyPath: 'id',
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic helper: put a value into a store.
 */
async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Generic helper: get a value by key.
 */
async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result as T | undefined); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/**
 * Generic helper: get all values from a store.
 */
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result as T[]); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/**
 * Generic helper: clear a store.
 */
async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ─── Calibration Samples ──────────────────────────────────────────────

/**
 * Save an array of calibration samples (replaces existing).
 */
export async function saveCalibrationSamples(
  samples: CalibrationSample[]
): Promise<void> {
  await clearStore(STORES.calibrationSamples);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.calibrationSamples, 'readwrite');
    const store = tx.objectStore(STORES.calibrationSamples);
    for (const sample of samples) {
      store.add({ ...sample });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Load all stored calibration samples.
 */
export async function loadCalibrationSamples(): Promise<CalibrationSample[]> {
  return getAll<CalibrationSample>(STORES.calibrationSamples);
}

// ─── Models ───────────────────────────────────────────────────────────

/**
 * Save the ridge regression calibration model.
 */
export async function saveRidgeModel(model: CalibrationModel): Promise<void> {
  await put(STORES.models, { type: 'ridge', ...model });
}

/**
 * Load the ridge regression calibration model.
 */
export async function loadRidgeModel(): Promise<CalibrationModel | null> {
  const result = await get<CalibrationModel & { type: string }>(STORES.models, 'ridge');
  if (!result) return null;
  const { type: _type, ...model } = result;
  return model as CalibrationModel;
}

/**
 * Save the neural network gaze model.
 */
export async function saveNeuralModel(model: NeuralGazeModel): Promise<void> {
  await put(STORES.models, { type: 'neural', ...model });
}

/**
 * Load the neural network gaze model.
 */
export async function loadNeuralModel(): Promise<NeuralGazeModel | null> {
  const result = await get<NeuralGazeModel & { type: string }>(STORES.models, 'neural');
  if (!result) return null;
  const { type: _type, ...model } = result;
  return model as NeuralGazeModel;
}

// ─── Implicit Samples (Continuous Calibration) ───────────────────────

/**
 * Add an implicit calibration sample from successful key selection.
 */
export async function addImplicitSample(sample: CalibrationSample): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.implicitSamples, 'readwrite');
    tx.objectStore(STORES.implicitSamples).add({ ...sample });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/**
 * Load all implicit calibration samples.
 */
export async function loadImplicitSamples(): Promise<CalibrationSample[]> {
  return getAll<CalibrationSample>(STORES.implicitSamples);
}

/**
 * Clear implicit samples (after retraining).
 */
export async function clearImplicitSamples(): Promise<void> {
  await clearStore(STORES.implicitSamples);
}

/**
 * Get count of implicit samples.
 */
export async function getImplicitSampleCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.implicitSamples, 'readonly');
    const request = tx.objectStore(STORES.implicitSamples).count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// ─── Typing Sessions ─────────────────────────────────────────────────

/**
 * Save a typing session.
 */
export async function saveTypingSession(session: TypingSession): Promise<void> {
  await put(STORES.sessions, session);
}

/**
 * Load all typing sessions, most recent first.
 */
export async function loadTypingSessions(): Promise<TypingSession[]> {
  const sessions = await getAll<TypingSession>(STORES.sessions);
  return sessions.sort((a, b) => b.startTime - a.startTime);
}

/**
 * Get typing session count.
 */
export async function getSessionCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.sessions, 'readonly');
    const request = tx.objectStore(STORES.sessions).count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// ─── Utilities ────────────────────────────────────────────────────────

/**
 * Clear all IndexedDB data.
 */
export async function clearAllIDBData(): Promise<void> {
  await Promise.all([
    clearStore(STORES.calibrationSamples),
    clearStore(STORES.models),
    clearStore(STORES.sessions),
    clearStore(STORES.implicitSamples),
  ]);
}

/**
 * Check if IndexedDB is available.
 */
export function isIDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
