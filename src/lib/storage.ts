/**
 * Storage utilities for persisting user settings and calibration data.
 * Uses localStorage for simplicity (works offline, no backend needed).
 */

import { CalibrationModel, UserSettings, DEFAULT_SETTINGS } from './types';

const STORAGE_KEYS = {
  settings: 'gazetype_settings',
  calibration: 'gazetype_calibration',
  userName: 'gazetype_username',
} as const;

/**
 * Save user settings to localStorage.
 */
export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

/**
 * Load user settings from localStorage.
 * Returns defaults if nothing is stored.
 */
export function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.settings);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new settings added in updates
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save calibration model to localStorage.
 */
export function saveCalibration(model: CalibrationModel): void {
  try {
    localStorage.setItem(STORAGE_KEYS.calibration, JSON.stringify(model));
  } catch (e) {
    console.warn('Failed to save calibration:', e);
  }
}

/**
 * Load calibration model from localStorage.
 * Returns null if no calibration is stored.
 */
export function loadCalibration(): CalibrationModel | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.calibration);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load calibration:', e);
  }
  return null;
}

/**
 * Clear all stored data.
 */
export function clearAllData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (e) {
    console.warn('Failed to clear data:', e);
  }
}

/**
 * Check if calibration data exists and is recent (less than 24 hours old).
 */
export function hasRecentCalibration(): boolean {
  const model = loadCalibration();
  if (!model) return false;
  const ageMs = Date.now() - model.calibratedAt;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  return ageMs < maxAge;
}
