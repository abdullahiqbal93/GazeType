'use client';

import React from 'react';
import { Point2D, UserSettings } from '@/lib/types';

interface PredictionBarProps {
  predictions: string[];
  gazePoint: Point2D | null;
  settings: UserSettings;
  onSelect: (word: string) => void;
}

/**
 * Displays word predictions above the keyboard.
 * Predictions can be selected by gaze dwell or click.
 */
export default function PredictionBar({
  predictions,
  gazePoint,
  settings,
  onSelect,
}: PredictionBarProps) {
  if (!settings.predictionsEnabled || predictions.length === 0) return null;

  const hcBg = settings.highContrast ? 'bg-yellow-900' : 'bg-gray-800';
  const hcBtn = settings.highContrast
    ? 'bg-yellow-500 text-black hover:bg-yellow-300'
    : 'bg-gray-700 text-white hover:bg-cyan-600';

  return (
    <div className={`flex justify-center gap-2 p-2 ${hcBg} rounded-lg mb-2`}>
      {predictions.map((word, i) => (
        <button
          key={`${word}-${i}`}
          onClick={() => onSelect(word)}
          className={`
            px-4 py-2 rounded-lg font-medium text-sm
            transition-colors ${hcBtn}
          `}
          data-prediction={word}
        >
          {word}
        </button>
      ))}
    </div>
  );
}
