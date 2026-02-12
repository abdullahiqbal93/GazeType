'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GazeTracker, GazeFrame } from '@/lib/gazeTracker';
import { CalibrationModel, UserSettings, Point2D } from '@/lib/types';

interface GazeEngineProps {
  videoElement: HTMLVideoElement | null;
  calibration: CalibrationModel | null;
  settings: UserSettings;
  onGazeUpdate: (point: Point2D | null, frame: GazeFrame) => void;
  onBlink?: () => void;
  enabled: boolean;
  /** Expose a function to get current ratios for calibration */
  onTrackerReady?: (tracker: GazeTracker) => void;
}

/**
 * GazeEngine: manages the gaze tracking lifecycle.
 * Renders nothing visible — just processes frames and calls back.
 */
export default function GazeEngine({
  videoElement,
  calibration,
  settings,
  onGazeUpdate,
  onBlink,
  enabled,
  onTrackerReady,
}: GazeEngineProps) {
  const trackerRef = useRef<GazeTracker | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize tracker when video is ready
  useEffect(() => {
    if (!videoElement || !enabled) return;

    let destroyed = false;
    const tracker = new GazeTracker(settings);
    trackerRef.current = tracker;

    async function setup() {
      try {
        await tracker.init(videoElement!);

        if (destroyed) return;

        tracker.setCallbacks(
          (frame) => {
            onGazeUpdate(frame.gazePoint, frame);
          },
          onBlink
        );

        if (calibration) {
          tracker.setCalibration(calibration);
        }

        await tracker.start();
        setInitialized(true);
        onTrackerReady?.(tracker);
      } catch (err) {
        console.error('GazeEngine init error:', err);
      }
    }

    setup();

    return () => {
      destroyed = true;
      tracker.destroy();
      trackerRef.current = null;
      setInitialized(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement, enabled]);

  // Update calibration when it changes
  useEffect(() => {
    if (trackerRef.current && calibration) {
      trackerRef.current.setCalibration(calibration);
    }
  }, [calibration]);

  // Update settings when they change
  useEffect(() => {
    if (trackerRef.current) {
      trackerRef.current.updateSettings(settings);
    }
  }, [settings]);

  return null; // Invisible processing component
}
