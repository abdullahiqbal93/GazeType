'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Permissions page: Request webcam access with clear privacy note.
 */
export default function PermissionsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  async function requestCamera() {
    setRequesting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      // Stop the test stream immediately
      stream.getTracks().forEach((t) => t.stop());
      // Navigate to calibration
      router.push('/calibrate');
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access was denied. Please allow camera access in your browser settings and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a webcam and try again.');
        } else {
          setError(`Camera error: ${err.message}`);
        }
      }
    } finally {
      setRequesting(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-6">
          <span className="text-5xl">📷</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">Camera Access Required</h1>
        <p className="text-gray-400 mb-6">
          GazeType needs access to your webcam to track your eye movements.
          We need to see your face to detect where you&apos;re looking.
        </p>

        {/* Privacy Box */}
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-5 mb-8 text-left">
          <h3 className="font-semibold text-green-400 mb-3">🔒 Your Privacy Is Protected</h3>
          <ul className="space-y-2 text-sm text-green-300/80">
            <li>✓ All processing happens <strong>locally in your browser</strong></li>
            <li>✓ No video frames are ever sent to any server</li>
            <li>✓ No images or recordings are stored</li>
            <li>✓ You can stop the camera at any time</li>
            <li>✓ Calibration data is saved only on your device</li>
          </ul>
        </div>

        <button
          onClick={requestCamera}
          disabled={requesting}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors w-full mb-4"
        >
          {requesting ? 'Requesting access...' : 'Allow Camera Access'}
        </button>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        <p className="text-xs text-gray-600">
          You can revoke camera access at any time through your browser settings.
        </p>
      </div>
    </main>
  );
}
