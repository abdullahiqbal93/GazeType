'use client';

import React from 'react';

interface DebugOverlayProps {
  fps: number;
  ratios: { avgX: number; avgY: number } | null;
  gazeX: number | null;
  gazeY: number | null;
  calibrated: boolean;
  visible: boolean;
}

/**
 * Debug overlay showing real-time tracking info.
 */
export default function DebugOverlay({
  fps,
  ratios,
  gazeX,
  gazeY,
  calibrated,
  visible,
}: DebugOverlayProps) {
  if (!visible) return null;

  return (
    <div className="fixed top-2 right-2 z-50 bg-black/80 text-green-400 text-xs font-mono p-3 rounded-lg min-w-[200px]">
      <div className="font-bold text-green-300 mb-1">DEBUG</div>
      <div>FPS: {fps}</div>
      <div>Calibrated: {calibrated ? '✓' : '✗'}</div>
      {ratios && (
        <>
          <div>Gaze X ratio: {ratios.avgX.toFixed(3)}</div>
          <div>Gaze Y ratio: {ratios.avgY.toFixed(3)}</div>
        </>
      )}
      {gazeX !== null && gazeY !== null && (
        <div>
          Screen: ({Math.round(gazeX)}, {Math.round(gazeY)})
        </div>
      )}
    </div>
  );
}
