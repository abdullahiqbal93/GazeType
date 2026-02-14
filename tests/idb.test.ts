/**
 * Tests for IndexedDB storage module.
 * Uses a mock IndexedDB (via jest-environment-jsdom's "fake-indexeddb").
 */

// Mock indexedDB for jsdom
import 'fake-indexeddb/auto';
import {
  saveCalibrationSamples,
  loadCalibrationSamples,
  saveRidgeModel,
  loadRidgeModel,
  saveNeuralModel,
  loadNeuralModel,
  addImplicitSample,
  loadImplicitSamples,
  clearImplicitSamples,
  getImplicitSampleCount,
  saveTypingSession,
  loadTypingSessions,
  clearAllIDBData,
  isIDBAvailable,
} from '../src/lib/idb';
import { CalibrationModel, CalibrationSample, NeuralGazeModel, TypingSession } from '../src/lib/types';

// Helper to create a sample
function mockSample(x: number, y: number): CalibrationSample {
  return {
    target: { x, y },
    ratios: {
      leftEyeX: 0.5, leftEyeY: 0.5,
      rightEyeX: 0.5, rightEyeY: 0.5,
      avgX: 0.5, avgY: 0.5,
    },
    timestamp: Date.now(),
  };
}

function mockCalibrationModel(): CalibrationModel {
  return {
    weightsX: [1, 2, 3],
    weightsY: [4, 5, 6],
    quality: 0.85,
    calibratedAt: Date.now(),
    sampleCount: 90,
  };
}

function mockNeuralModel(): NeuralGazeModel {
  return {
    layers: [
      { weights: [[1, 2]], biases: [0] },
    ],
    quality: 0.9,
    calibratedAt: Date.now(),
    sampleCount: 90,
    lossHistory: [1.0, 0.5, 0.1],
  };
}

function mockSession(): TypingSession {
  return {
    id: `test_${Date.now()}`,
    startTime: Date.now() - 60000,
    endTime: Date.now(),
    totalChars: 50,
    totalKeystrokes: 55,
    backspaceCount: 5,
    wpm: 10,
    accuracy: 0.909,
    finalText: 'hello world',
  };
}

describe('IndexedDB Storage', () => {
  beforeEach(async () => {
    await clearAllIDBData();
  });

  describe('isIDBAvailable', () => {
    it('returns true in test environment', () => {
      expect(isIDBAvailable()).toBe(true);
    });
  });

  describe('calibration samples', () => {
    it('saves and loads calibration samples', async () => {
      const samples = [mockSample(100, 200), mockSample(300, 400)];
      await saveCalibrationSamples(samples);
      
      const loaded = await loadCalibrationSamples();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].target.x).toBe(100);
      expect(loaded[1].target.x).toBe(300);
    });

    it('replaces existing samples on save', async () => {
      await saveCalibrationSamples([mockSample(1, 1)]);
      await saveCalibrationSamples([mockSample(2, 2), mockSample(3, 3)]);
      
      const loaded = await loadCalibrationSamples();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].target.x).toBe(2);
    });
  });

  describe('ridge model', () => {
    it('saves and loads ridge model', async () => {
      const model = mockCalibrationModel();
      await saveRidgeModel(model);
      
      const loaded = await loadRidgeModel();
      expect(loaded).not.toBeNull();
      expect(loaded!.quality).toBe(0.85);
      expect(loaded!.weightsX).toEqual([1, 2, 3]);
    });

    it('returns null when no model exists', async () => {
      const loaded = await loadRidgeModel();
      expect(loaded).toBeNull();
    });
  });

  describe('neural model', () => {
    it('saves and loads neural model', async () => {
      const model = mockNeuralModel();
      await saveNeuralModel(model);
      
      const loaded = await loadNeuralModel();
      expect(loaded).not.toBeNull();
      expect(loaded!.quality).toBe(0.9);
      expect(loaded!.lossHistory).toHaveLength(3);
    });

    it('returns null when no model exists', async () => {
      const loaded = await loadNeuralModel();
      expect(loaded).toBeNull();
    });
  });

  describe('implicit samples', () => {
    it('adds and loads implicit samples', async () => {
      await addImplicitSample(mockSample(10, 20));
      await addImplicitSample(mockSample(30, 40));
      
      const loaded = await loadImplicitSamples();
      expect(loaded).toHaveLength(2);
    });

    it('counts implicit samples', async () => {
      await addImplicitSample(mockSample(10, 20));
      await addImplicitSample(mockSample(30, 40));
      await addImplicitSample(mockSample(50, 60));
      
      const count = await getImplicitSampleCount();
      expect(count).toBe(3);
    });

    it('clears implicit samples', async () => {
      await addImplicitSample(mockSample(10, 20));
      await addImplicitSample(mockSample(30, 40));
      
      await clearImplicitSamples();
      
      const count = await getImplicitSampleCount();
      expect(count).toBe(0);
    });
  });

  describe('typing sessions', () => {
    it('saves and loads typing sessions', async () => {
      const session = mockSession();
      await saveTypingSession(session);
      
      const loaded = await loadTypingSessions();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].wpm).toBe(10);
    });

    it('loads sessions sorted by most recent first', async () => {
      const s1 = { ...mockSession(), id: 's1', startTime: 1000 };
      const s2 = { ...mockSession(), id: 's2', startTime: 3000 };
      const s3 = { ...mockSession(), id: 's3', startTime: 2000 };
      
      await saveTypingSession(s1);
      await saveTypingSession(s2);
      await saveTypingSession(s3);
      
      const loaded = await loadTypingSessions();
      expect(loaded).toHaveLength(3);
      expect(loaded[0].id).toBe('s2');
      expect(loaded[1].id).toBe('s3');
      expect(loaded[2].id).toBe('s1');
    });
  });

  describe('clearAllIDBData', () => {
    it('clears all stores', async () => {
      await saveCalibrationSamples([mockSample(1, 1)]);
      await saveRidgeModel(mockCalibrationModel());
      await addImplicitSample(mockSample(10, 20));
      await saveTypingSession(mockSession());
      
      await clearAllIDBData();
      
      const samples = await loadCalibrationSamples();
      const ridge = await loadRidgeModel();
      const implicit = await loadImplicitSamples();
      const sessions = await loadTypingSessions();
      
      expect(samples).toHaveLength(0);
      expect(ridge).toBeNull();
      expect(implicit).toHaveLength(0);
      expect(sessions).toHaveLength(0);
    });
  });
});
