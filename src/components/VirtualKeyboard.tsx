'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { KEYBOARD_ROWS } from '@/lib/keyboardLayout';
import { KeyDef, Point2D, UserSettings } from '@/lib/types';
import { playClick } from '@/lib/tts';

interface VirtualKeyboardProps {
  gazePoint: Point2D | null;
  settings: UserSettings;
  onKeySelect: (key: KeyDef, keyCenter?: Point2D) => void;
  shifted: boolean;
  onShiftToggle: () => void;
}

/**
 * Virtual on-screen keyboard with dwell-to-select functionality.
 * Keys are highlighted when the gaze point hovers over them,
 * and selected after dwellTime ms of continuous hovering.
 */
export default function VirtualKeyboard({
  gazePoint,
  settings,
  onKeySelect,
  shifted,
  onShiftToggle,
}: VirtualKeyboardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const dwellStartRef = useRef<number>(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const keySizeClass = {
    small: 'min-w-[56px] h-14 text-base',
    medium: 'min-w-[72px] h-[72px] text-xl',
    large: 'min-w-[88px] h-[88px] text-2xl',
  }[settings.keySize];

  // Check which key the gaze point is over
  const findKeyUnderGaze = useCallback((): { id: string; def: KeyDef; center: Point2D } | null => {
    if (!gazePoint || !containerRef.current) return null;

    const keys = containerRef.current.querySelectorAll('[data-key-id]');
    for (const keyEl of keys) {
      const rect = keyEl.getBoundingClientRect();
      if (
        gazePoint.x >= rect.left &&
        gazePoint.x <= rect.right &&
        gazePoint.y >= rect.top &&
        gazePoint.y <= rect.bottom
      ) {
        const id = keyEl.getAttribute('data-key-id') || '';
        const rowIdx = parseInt(keyEl.getAttribute('data-row') || '0');
        const colIdx = parseInt(keyEl.getAttribute('data-col') || '0');
        const center: Point2D = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        return { id, def: KEYBOARD_ROWS[rowIdx][colIdx], center };
      }
    }
    return null;
  }, [gazePoint]);

  // Handle gaze-based dwell selection
  useEffect(() => {
    const keyUnderGaze = findKeyUnderGaze();
    const currentKeyId = keyUnderGaze?.id || null;

    if (currentKeyId !== hoveredKey) {
      // Clear existing dwell timer
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setDwellProgress(0);
      setHoveredKey(currentKeyId);

      if (currentKeyId && keyUnderGaze) {
        dwellStartRef.current = Date.now();

        // Progress animation
        progressIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - dwellStartRef.current;
          setDwellProgress(Math.min(1, elapsed / settings.dwellTime));
        }, 30);

        // Dwell timer
        dwellTimerRef.current = setTimeout(() => {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setDwellProgress(0);
          setHoveredKey(null);

          // Handle special keys
          if (keyUnderGaze.def.type === 'shift') {
            onShiftToggle();
          } else {
            onKeySelect(keyUnderGaze.def, keyUnderGaze.center);
          }

          if (settings.audioFeedback) {
            playClick();
          }
        }, settings.dwellTime);
      }
    }

    return () => {
      // don't clear on every render, only when key changes
    };
  }, [gazePoint, findKeyUnderGaze, hoveredKey, settings.dwellTime, settings.audioFeedback, onKeySelect, onShiftToggle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const hcBg = settings.highContrast ? 'bg-black' : 'bg-gray-900';
  const hcKey = settings.highContrast ? 'bg-yellow-400 text-black border-yellow-300' : 'bg-gray-700 text-white border-gray-600';
  const hcHover = settings.highContrast ? 'bg-yellow-200 text-black' : 'bg-cyan-500 text-white';

  return (
    <div
      ref={containerRef}
      className={`${hcBg} p-4 rounded-xl shadow-xl select-none`}
    >
      {KEYBOARD_ROWS.map((row, rowIdx) => (
        <div key={rowIdx} className="flex justify-center gap-2 mb-2">
          {row.map((key, colIdx) => {
            const keyId = `${rowIdx}-${colIdx}`;
            const isHovered = hoveredKey === keyId;
            const widthMultiplier = key.width || 1;
            const label = key.type === 'char' && shifted ? key.label.toUpperCase() : key.label;

            return (
              <button
                key={keyId}
                data-key-id={keyId}
                data-row={rowIdx}
                data-col={colIdx}
                className={`
                  ${keySizeClass} rounded-lg border font-medium
                  transition-all duration-100 relative overflow-hidden
                  flex items-center justify-center
                  ${isHovered ? hcHover : hcKey}
                  hover:bg-cyan-600 active:bg-cyan-700
                `}
                style={{
                  minWidth: `${(settings.keySize === 'small' ? 56 : settings.keySize === 'medium' ? 72 : 88) * widthMultiplier}px`,
                }}
                onClick={() => {
                  if (key.type === 'shift') {
                    onShiftToggle();
                  } else {
                    const rect = (document.querySelector(`[data-key-id="${keyId}"]`) as HTMLElement)?.getBoundingClientRect();
                    const center = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined;
                    onKeySelect(key, center);
                  }
                  if (settings.audioFeedback) playClick();
                }}
              >
                {/* Dwell progress bar */}
                {isHovered && dwellProgress > 0 && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-cyan-300 transition-all"
                    style={{ width: `${dwellProgress * 100}%` }}
                  />
                )}
                <span className={key.type === 'space' ? 'text-sm' : ''}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
