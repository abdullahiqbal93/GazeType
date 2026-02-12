'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Webcam, { WebcamHandle } from '@/components/Webcam';
import GazeEngine from '@/components/GazeEngine';
import GazeCursor from '@/components/GazeCursor';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import PredictionBar from '@/components/PredictionBar';
import SettingsPanel from '@/components/SettingsPanel';
import DebugOverlay from '@/components/DebugOverlay';
import { GazeFrame } from '@/lib/gazeTracker';
import { CalibrationModel, KeyDef, Point2D, UserSettings, DEFAULT_SETTINGS } from '@/lib/types';
import { loadCalibration, loadSettings, saveSettings } from '@/lib/storage';
import { getPredictions, extractCurrentAndPrevWord } from '@/lib/ngram';
import { speak, playClick } from '@/lib/tts';

/**
 * Main typing page: camera preview, gaze cursor, keyboard, text area,
 * prediction bar, and settings.
 */
export default function TypePage() {
  const router = useRouter();
  const webcamRef = useRef<WebcamHandle>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [calibration, setCalibration] = useState<CalibrationModel | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [typedText, setTypedText] = useState('');
  const [gazePoint, setGazePoint] = useState<Point2D | null>(null);
  const [shifted, setShifted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [noCalibration, setNoCalibration] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  // Debug state
  const [debugFps, setDebugFps] = useState(0);
  const [debugRatios, setDebugRatios] = useState<{ avgX: number; avgY: number } | null>(null);

  // Load calibration and settings on mount
  useEffect(() => {
    const cal = loadCalibration();
    const set = loadSettings();
    setSettings(set);

    if (cal) {
      setCalibration(cal);
    } else {
      setNoCalibration(true);
    }
  }, []);

  // Update predictions when text changes
  useEffect(() => {
    if (settings.predictionsEnabled) {
      const { currentWord, previousWord } = extractCurrentAndPrevWord(typedText);
      const preds = getPredictions(currentWord, previousWord, 3);
      setPredictions(preds);
    } else {
      setPredictions([]);
    }
  }, [typedText, settings.predictionsEnabled]);

  // Auto-speak on sentence end
  useEffect(() => {
    if (settings.autoSpeak && typedText.endsWith('.')) {
      const sentences = typedText.split('.');
      const lastSentence = sentences[sentences.length - 2]?.trim();
      if (lastSentence) {
        speak(lastSentence, settings.ttsVoice, settings.ttsRate);
      }
    }
  }, [typedText, settings.autoSpeak, settings.ttsVoice, settings.ttsRate]);

  // Handle webcam ready
  const handleWebcamStream = useCallback(() => {
    const video = webcamRef.current?.getVideo();
    if (video) {
      setVideoEl(video);
      setIsReady(true);
    }
  }, []);

  // Handle gaze update from engine
  const handleGazeUpdate = useCallback((point: Point2D | null, frame: GazeFrame) => {
    setGazePoint(point);
    setDebugFps(frame.fps);
    if (frame.ratios) {
      setDebugRatios({ avgX: frame.ratios.avgX, avgY: frame.ratios.avgY });
    }
  }, []);

  // Handle blink selection
  const handleBlink = useCallback(() => {
    if (settings.blinkSelectEnabled) {
      // Blink acts as a "click" at current gaze position
      // The keyboard's dwell logic handles actual selection
      if (settings.audioFeedback) playClick();
    }
  }, [settings.blinkSelectEnabled, settings.audioFeedback]);

  // Handle key selection
  const handleKeySelect = useCallback((key: KeyDef) => {
    switch (key.type) {
      case 'char':
      case 'space':
        const char = key.type === 'char' && shifted ? key.value.toUpperCase() : key.value;
        setTypedText((prev) => prev + char);
        if (shifted) setShifted(false);
        break;
      case 'enter':
        setTypedText((prev) => prev + '\n');
        break;
      case 'backspace':
        setTypedText((prev) => prev.slice(0, -1));
        break;
      case 'clear':
        setTypedText('');
        break;
      case 'tts':
        if (typedText.trim()) {
          speak(typedText.trim(), settings.ttsVoice, settings.ttsRate);
        }
        break;
    }
  }, [shifted, typedText, settings.ttsVoice, settings.ttsRate]);

  // Handle prediction selection
  const handlePredictionSelect = useCallback((word: string) => {
    setTypedText((prev) => {
      // Replace partial word with prediction
      const words = prev.split(/(\s+)/);
      // Find last actual word (skip trailing whitespace)
      let lastWordIdx = words.length - 1;
      while (lastWordIdx >= 0 && /^\s*$/.test(words[lastWordIdx])) {
        lastWordIdx--;
      }
      if (lastWordIdx >= 0) {
        words[lastWordIdx] = word;
      }
      return words.join('') + ' ';
    });
    if (settings.audioFeedback) playClick();
  }, [settings.audioFeedback]);

  // Handle settings update
  const handleSettingsUpdate = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  // Stop camera
  const handleStopCamera = useCallback(() => {
    webcamRef.current?.stop();
    setCameraActive(false);
  }, []);

  // No calibration redirect
  if (noCalibration) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <span className="text-5xl mb-6">⚠️</span>
        <h1 className="text-2xl font-bold mb-4">No Calibration Found</h1>
        <p className="text-gray-400 mb-6">
          You need to complete calibration before you can start typing.
        </p>
        <button
          onClick={() => router.push('/calibrate')}
          className="bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-3 rounded-xl"
        >
          Go to Calibration
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl">👁️</span>
          <h1 className="font-bold text-lg">GazeType</h1>
        </div>
        <div className="flex items-center gap-2">
          {cameraActive && (
            <button
              onClick={handleStopCamera}
              className="text-xs bg-red-600/80 hover:bg-red-500 px-3 py-1.5 rounded-lg"
            >
              Stop Camera
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => router.push('/help')}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg"
          >
            ❓ Help
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        {/* Top section: Webcam preview + Text area */}
        <div className="flex gap-4">
          {/* Webcam */}
          <div className="flex-shrink-0">
            <Webcam
              ref={webcamRef}
              onStream={handleWebcamStream}
              showPreview={true}
              width={240}
              height={180}
              className="rounded-lg overflow-hidden"
            />
          </div>

          {/* Text area */}
          <div className="flex-1">
            <div
              className={`w-full h-full min-h-[120px] rounded-xl p-4 text-lg leading-relaxed whitespace-pre-wrap break-words ${
                settings.highContrast
                  ? 'bg-black border-2 border-yellow-400 text-yellow-100'
                  : 'bg-gray-800 border border-gray-700 text-white'
              }`}
            >
              {typedText || (
                <span className="text-gray-500 italic">
                  Start typing by looking at the keyboard below...
                </span>
              )}
              <span className="animate-pulse text-cyan-400">|</span>
            </div>
          </div>
        </div>

        {/* Prediction bar */}
        <PredictionBar
          predictions={predictions}
          gazePoint={gazePoint}
          settings={settings}
          onSelect={handlePredictionSelect}
        />

        {/* Virtual keyboard */}
        <div className="mt-auto">
          <VirtualKeyboard
            gazePoint={gazePoint}
            settings={settings}
            onKeySelect={handleKeySelect}
            shifted={shifted}
            onShiftToggle={() => setShifted((s) => !s)}
          />
        </div>
      </div>

      {/* Gaze tracking engine (invisible) */}
      {videoEl && calibration && (
        <GazeEngine
          videoElement={videoEl}
          calibration={calibration}
          settings={settings}
          onGazeUpdate={handleGazeUpdate}
          onBlink={handleBlink}
          enabled={isReady && cameraActive}
        />
      )}

      {/* Gaze cursor overlay */}
      <GazeCursor
        point={gazePoint}
        visible={settings.showGazeCursor && cameraActive}
        debug={settings.debugMode}
      />

      {/* Debug overlay */}
      <DebugOverlay
        fps={debugFps}
        ratios={debugRatios}
        gazeX={gazePoint?.x ?? null}
        gazeY={gazePoint?.y ?? null}
        calibrated={!!calibration}
        visible={settings.debugMode}
      />

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={handleSettingsUpdate}
          onRecalibrate={() => router.push('/calibrate')}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
