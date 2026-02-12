'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Webcam, { WebcamHandle } from '@/components/Webcam';
import { GazeTracker } from '@/lib/gazeTracker';
import { generateCalibrationPoints, fitCalibrationModel, SAMPLES_PER_POINT } from '@/lib/calibration';
import { CalibrationSample, GazeRatios, HeadPose, UserSettings, DEFAULT_SETTINGS } from '@/lib/types';
import { saveCalibration } from '@/lib/storage';

/**
 * Calibration page: 9-point calibration flow.
 * User looks at each dot while the system collects gaze samples.
 */
export default function CalibratePage() {
  const router = useRouter();
  const webcamRef = useRef<WebcamHandle>(null);
  const trackerRef = useRef<GazeTracker | null>(null);
  const [step, setStep] = useState<'intro' | 'loading' | 'calibrating' | 'done' | 'error'>('intro');
  const [currentPoint, setCurrentPoint] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [quality, setQuality] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const samplesRef = useRef<CalibrationSample[]>([]);
  const collectingRef = useRef(false);
  const collectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [screenSize, setScreenSize] = useState({ w: 1920, h: 1080 });

  useEffect(() => {
    setScreenSize({ w: window.innerWidth, h: window.innerHeight });
  }, []);

  const calibrationPoints = generateCalibrationPoints(screenSize.w, screenSize.h);

  // Initialize tracker after webcam is ready
  const handleWebcamStream = useCallback(async () => {
    setStep('loading');

    try {
      const video = webcamRef.current?.getVideo();
      if (!video) throw new Error('No video element');

      const tracker = new GazeTracker(DEFAULT_SETTINGS);
      await tracker.init(video);
      await tracker.start();
      trackerRef.current = tracker;

      // Wait a moment for the model to warm up
      await new Promise((r) => setTimeout(r, 1500));

      setStep('calibrating');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to initialize tracker');
      setStep('error');
    }
  }, []);

  // Collect samples for current calibration point
  const startCollecting = useCallback((pointIdx: number) => {
    const tracker = trackerRef.current;
    if (!tracker) return;

    collectingRef.current = true;
    let collected = 0;
    const target = calibrationPoints[pointIdx];

    collectIntervalRef.current = setInterval(() => {
      if (!collectingRef.current) {
        if (collectIntervalRef.current) clearInterval(collectIntervalRef.current);
        return;
      }

      const { ratios, headPose } = tracker.getLastRatios();
      if (ratios) {
        samplesRef.current.push({
          target,
          ratios,
          headPose: headPose || undefined,
          timestamp: Date.now(),
        });
        collected++;
        setSampleCount(collected);

        if (collected >= SAMPLES_PER_POINT) {
          collectingRef.current = false;
          if (collectIntervalRef.current) clearInterval(collectIntervalRef.current);

          // Move to next point or finish
          if (pointIdx < calibrationPoints.length - 1) {
            // Brief pause before next point
            setTimeout(() => {
              setCurrentPoint(pointIdx + 1);
              setSampleCount(0);
            }, 300);
          } else {
            // All points collected — fit model
            try {
              const model = fitCalibrationModel(samplesRef.current);
              saveCalibration(model);
              setQuality(model.quality);
              setStep('done');
            } catch (err) {
              setErrorMsg(err instanceof Error ? err.message : 'Calibration failed');
              setStep('error');
            }
          }
        }
      }
    }, 50); // Collect every 50ms (~20 samples/sec)
  }, [calibrationPoints]);

  // Start collecting when calibration point changes
  useEffect(() => {
    if (step === 'calibrating') {
      // Small delay before starting to collect, so user has time to look at the dot
      const timer = setTimeout(() => {
        startCollecting(currentPoint);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [step, currentPoint, startCollecting]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (collectIntervalRef.current) clearInterval(collectIntervalRef.current);
      trackerRef.current?.destroy();
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-gray-950 overflow-hidden">
      {/* Hidden webcam */}
      {step !== 'intro' && (
        <Webcam
          ref={webcamRef}
          onStream={handleWebcamStream}
          showPreview={false}
          width={640}
          height={480}
        />
      )}

      {/* Step: Intro */}
      {step === 'intro' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <span className="text-5xl mb-6">🎯</span>
          <h1 className="text-3xl font-bold mb-4">Calibration</h1>
          <p className="text-gray-400 max-w-lg text-center mb-4">
            You&apos;ll see 9 dots appear on screen one at a time.
            Look directly at each dot and hold your gaze steady until
            the progress fills up.
          </p>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-8 text-sm text-gray-400 max-w-md">
            <p className="font-medium text-gray-300 mb-2">Tips for best results:</p>
            <ul className="space-y-1">
              <li>• Sit about arm&apos;s length from your screen</li>
              <li>• Make sure your face is well-lit from the front</li>
              <li>• Keep your head relatively still during calibration</li>
              <li>• Try to only move your eyes, not your head</li>
            </ul>
          </div>
          <button
            onClick={() => {
              setStep('loading');
              // Trigger webcam mount
              setTimeout(() => {
                // The Webcam component auto-starts
              }, 100);
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-3 rounded-xl text-lg"
          >
            Start Calibration
          </button>
        </div>
      )}

      {/* Step: Loading */}
      {step === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Initializing eye tracker...</p>
          <p className="text-gray-600 text-sm mt-2">This may take a few seconds on first load.</p>
        </div>
      )}

      {/* Step: Calibrating */}
      {step === 'calibrating' && (
        <>
          {/* Progress bar */}
          <div className="fixed top-0 left-0 right-0 h-1 bg-gray-800 z-50">
            <div
              className="h-full bg-cyan-400 transition-all duration-300"
              style={{
                width: `${((currentPoint * SAMPLES_PER_POINT + sampleCount) /
                  (calibrationPoints.length * SAMPLES_PER_POINT)) * 100}%`,
              }}
            />
          </div>

          {/* Status */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/80 px-4 py-2 rounded-lg text-sm text-gray-300">
            Point {currentPoint + 1} of {calibrationPoints.length} — Look at the dot
          </div>

          {/* Calibration dot */}
          <div
            className="fixed z-40 transition-all duration-500 ease-out"
            style={{
              left: calibrationPoints[currentPoint].x - 24,
              top: calibrationPoints[currentPoint].y - 24,
            }}
          >
            {/* Outer ring with progress */}
            <svg width="48" height="48" className="animate-pulse">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#0e7490"
                strokeWidth="3"
                opacity="0.3"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - sampleCount / SAMPLES_PER_POINT)}`}
                transform="rotate(-90 24 24)"
                className="transition-all duration-100"
              />
            </svg>
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
          </div>
        </>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <span className="text-5xl mb-6">✅</span>
          <h1 className="text-3xl font-bold mb-4">Calibration Complete!</h1>
          <p className="text-gray-400 mb-2">
            Quality score: <span className={quality > 0.6 ? 'text-green-400' : quality > 0.3 ? 'text-yellow-400' : 'text-red-400'}>
              {(quality * 100).toFixed(0)}%
            </span>
          </p>
          <p className="text-gray-500 text-sm mb-8 max-w-md text-center">
            {quality > 0.6
              ? 'Great calibration! You should have accurate gaze tracking.'
              : quality > 0.3
              ? 'Decent calibration. You can recalibrate later for better accuracy.'
              : 'Low quality calibration. Consider recalibrating with better lighting.'}
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => {
                samplesRef.current = [];
                setCurrentPoint(0);
                setSampleCount(0);
                setStep('intro');
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl"
            >
              Recalibrate
            </button>
            <button
              onClick={() => router.push('/type')}
              className="bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-3 rounded-xl"
            >
              Start Typing →
            </button>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <span className="text-5xl mb-6">⚠️</span>
          <h1 className="text-3xl font-bold mb-4">Calibration Error</h1>
          <p className="text-red-400 mb-6">{errorMsg}</p>
          <button
            onClick={() => {
              samplesRef.current = [];
              setCurrentPoint(0);
              setSampleCount(0);
              setStep('intro');
            }}
            className="bg-cyan-500 hover:bg-cyan-400 text-white px-6 py-3 rounded-xl"
          >
            Try Again
          </button>
        </div>
      )}
    </main>
  );
}
