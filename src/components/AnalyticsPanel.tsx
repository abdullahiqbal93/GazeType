'use client';

import React, { useEffect, useState } from 'react';
import { TypingAnalytics, TypingSession } from '@/lib/types';
import { getSessionHistory } from '@/lib/analytics';

interface AnalyticsPanelProps {
  /** Live analytics from current session */
  liveAnalytics: TypingAnalytics | null;
  /** Session duration text */
  sessionDuration: string;
  /** Continuous calibration implicit sample count */
  implicitSampleCount: number;
  /** Whether panel is visible */
  visible: boolean;
}

/**
 * Analytics panel: shows live WPM, accuracy, and session history.
 * Displayed as a compact overlay on the typing page.
 */
export default function AnalyticsPanel({
  liveAnalytics,
  sessionDuration,
  implicitSampleCount,
  visible,
}: AnalyticsPanelProps) {
  const [history, setHistory] = useState<{
    sessions: TypingSession[];
    avgWpm: number;
    avgAccuracy: number;
    totalSessions: number;
    totalCharsAllTime: number;
    totalTimeMinutes: number;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (visible && showHistory) {
      getSessionHistory().then(setHistory).catch(() => {});
    }
  }, [visible, showHistory]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-gray-900/95 border border-gray-700 rounded-xl p-4 w-72 shadow-xl backdrop-blur-sm">
      <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
        📊 Typing Analytics
      </h3>

      {liveAnalytics ? (
        <div className="space-y-2">
          {/* WPM */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Current WPM</span>
            <span className="text-lg font-bold text-white">
              {liveAnalytics.currentWpm.toFixed(1)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Overall WPM</span>
            <span className="text-sm font-medium text-gray-300">
              {liveAnalytics.overallWpm.toFixed(1)}
            </span>
          </div>

          {/* Accuracy */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Accuracy</span>
            <span className={`text-sm font-medium ${
              liveAnalytics.accuracy > 0.9 ? 'text-green-400' :
              liveAnalytics.accuracy > 0.7 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {(liveAnalytics.accuracy * 100).toFixed(1)}%
            </span>
          </div>

          {/* Keystroke stats */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Keystrokes</span>
            <span className="text-xs text-gray-300">
              {liveAnalytics.totalKeystrokes} ({liveAnalytics.backspaceCount} ⌫)
            </span>
          </div>

          {/* Session duration */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Session</span>
            <span className="text-xs text-gray-300">{sessionDuration}</span>
          </div>

          {/* Characters */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Characters</span>
            <span className="text-xs text-gray-300">{liveAnalytics.totalChars}</span>
          </div>

          {/* Words */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Words</span>
            <span className="text-xs text-gray-300">{liveAnalytics.wordTimestamps.length}</span>
          </div>

          {/* Continuous calibration */}
          {implicitSampleCount > 0 && (
            <div className="flex justify-between items-center pt-1 border-t border-gray-700">
              <span className="text-xs text-gray-400">🔄 Implicit samples</span>
              <span className="text-xs text-gray-300">{implicitSampleCount}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Start typing to see analytics...</p>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="mt-3 w-full text-xs text-cyan-400 hover:text-cyan-300 text-center"
      >
        {showHistory ? 'Hide History ▲' : 'Show History ▼'}
      </button>

      {/* History panel */}
      {showHistory && history && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Total sessions</span>
            <span className="text-xs text-gray-300">{history.totalSessions}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Avg WPM</span>
            <span className="text-xs text-gray-300">
              {history.avgWpm > 0 ? history.avgWpm.toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Avg accuracy</span>
            <span className="text-xs text-gray-300">
              {history.avgAccuracy > 0 ? `${(history.avgAccuracy * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">All‑time chars</span>
            <span className="text-xs text-gray-300">{history.totalCharsAllTime}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Total time</span>
            <span className="text-xs text-gray-300">{history.totalTimeMinutes} min</span>
          </div>

          {/* Recent sessions */}
          {history.sessions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Recent sessions:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.sessions.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex justify-between items-center text-xs bg-gray-800/50 px-2 py-1 rounded"
                  >
                    <span className="text-gray-400">
                      {new Date(s.startTime).toLocaleDateString()}
                    </span>
                    <span className="text-gray-300">
                      {s.wpm.toFixed(1)} WPM · {(s.accuracy * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
