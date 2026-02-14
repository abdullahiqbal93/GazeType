'use client';

import React from 'react';
import { Point2D } from '@/lib/types';

interface GazeCursorProps {
  point: Point2D | null;
  visible: boolean;
}

/**
 * Renders a floating gaze cursor that follows the estimated gaze position.
 */
export default function GazeCursor({ point, visible }: GazeCursorProps) {
  if (!visible || !point) return null;

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: point.x - 16,
        top: point.y - 16,
      }}
    >
      {/* Main cursor dot */}
      <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-400" />
      </div>
    </div>
  );
}
