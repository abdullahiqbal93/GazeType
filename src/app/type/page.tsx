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
import AnalyticsPanel from '@/components/AnalyticsPanel';
import { GazeTracker, GazeFrame } from '@/lib/gazeTracker';
import { CalibrationModel, KeyDef, NeuralGazeModel, Point2D, TypingAnalytics, UserSettings, DEFAULT_SETTINGS } from '@/lib/types';
import { loadCalibration, loadSettings, saveSettings } from '@/lib/storage';
import { loadRidgeModel, loadNeuralModel } from '@/lib/idb';
import { getPredictions, extractCurrentAndPrevWord } from '@/lib/ngram';
import { speak, playClick } from '@/lib/tts';
import { TypingAnalyticsTracker } from '@/lib/analytics';
import { ContinuousCalibrator } from '@/lib/continuousCalibration';

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
  const [cursorPos, setCursorPos] = useState(0);
  const [gazePoint, setGazePoint] = useState<Point2D | null>(null);
  const [shifted, setShifted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [noCalibration, setNoCalibration] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);

  // Analytics state
  const analyticsRef = useRef<TypingAnalyticsTracker | null>(null);
  const [liveAnalytics, setLiveAnalytics] = useState<TypingAnalytics | null>(null);
  const [sessionDuration, setSessionDuration] = useState('0s');
  const analyticsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Continuous calibration state
  const continuousCalibratorRef = useRef<ContinuousCalibrator | null>(null);
  const [implicitSampleCount, setImplicitSampleCount] = useState(0);
  const trackerRef = useRef<GazeTracker | null>(null);

  // Neural model state
  const [neuralModel, setNeuralModel] = useState<NeuralGazeModel | null>(null);

  // Debug state
  const [debugFps, setDebugFps] = useState(0);
  const [debugRatios, setDebugRatios] = useState<{ avgX: number; avgY: number } | null>(null);

  // Load calibration, settings, and models on mount
  useEffect(() => {
    const cal = loadCalibration();
    const set = loadSettings();
    setSettings(set);

    if (cal) {
      setCalibration(cal);
    } else {
      setNoCalibration(true);
    }

    // Load models from IndexedDB
    loadRidgeModel()
      .then((ridge) => {
        if (ridge && !cal) {
          setCalibration(ridge);
        }
      })
      .catch(() => {});

    loadNeuralModel()
      .then((nn) => {
        if (nn) setNeuralModel(nn);
      })
      .catch(() => {});

    // Initialize analytics tracker
    const tracker = new TypingAnalyticsTracker();
    analyticsRef.current = tracker;

    // Initialize continuous calibrator
    const calibrator = new ContinuousCalibrator();
    continuousCalibratorRef.current = calibrator;

    // Set up continuous calibration callback
    calibrator.setCallback((updatedRidge, updatedNeural) => {
      if (updatedRidge) {
        setCalibration(updatedRidge);
      }
      if (updatedNeural) {
        setNeuralModel(updatedNeural);
      }
    });

    // Analytics refresh interval
    const interval = setInterval(() => {
      if (analyticsRef.current) {
        setLiveAnalytics(analyticsRef.current.getAnalytics());
        setSessionDuration(analyticsRef.current.getSessionDuration());
      }
    }, 1000);
    analyticsIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      // Save session on unmount
      if (analyticsRef.current) {
        analyticsRef.current.endSession().catch(() => {});
      }
    };
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
    // Update analytics with current text
    if (analyticsRef.current) {
      analyticsRef.current.setFinalText(typedText);
    }
  }, [typedText, settings.autoSpeak, settings.ttsVoice, settings.ttsRate]);

  // Keep continuous calibrator in sync with current models
  useEffect(() => {
    continuousCalibratorRef.current?.setModels(calibration, neuralModel);
  }, [calibration, neuralModel]);

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

  // Handle tracker ready (store reference for continuous calibration)
  const handleTrackerReady = useCallback((tracker: GazeTracker) => {
    trackerRef.current = tracker;
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
    const isBackspace = key.type === 'backspace';
    const isWordBoundary = key.type === 'space' || key.value === '.' || key.value === ',' || key.value === '!' || key.value === '?';

    // Track analytics
    analyticsRef.current?.recordKeystroke(key.type || 'char', isBackspace, isWordBoundary);

    switch (key.type) {
      case 'char':
      case 'space': {
        const char = key.type === 'char' && shifted ? key.value.toUpperCase() : key.value;
        setTypedText((prev) => prev.slice(0, cursorPos) + char + prev.slice(cursorPos));
        setCursorPos((pos) => pos + 1);
        if (shifted) setShifted(false);
        break;
      }
      case 'enter':
        setTypedText((prev) => prev.slice(0, cursorPos) + '\n' + prev.slice(cursorPos));
        setCursorPos((pos) => pos + 1);
        analyticsRef.current?.recordKeystroke('enter', false, true);
        break;
      case 'backspace':
        if (cursorPos > 0) {
          setTypedText((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
          setCursorPos((pos) => pos - 1);
        }
        break;
      case 'left':
        setCursorPos((pos) => Math.max(0, pos - 1));
        break;
      case 'right':
        setCursorPos((pos) => Math.min(typedText.length, pos + 1));
        break;
      case 'clear':
        setTypedText('');
        setCursorPos(0);
        break;
      case 'tts':
        if (typedText.trim()) {
          speak(typedText.trim(), settings.ttsVoice, settings.ttsRate);
        }
        break;
    }
  }, [shifted, typedText, cursorPos, settings.ttsVoice, settings.ttsRate]);

  // Handle key selection with continuous calibration feedback
  const handleKeySelectWithCalibration = useCallback((key: KeyDef, keyCenter?: Point2D) => {
    handleKeySelect(key);

    // Record implicit calibration sample if continuous calibration is enabled
    if (
      settings.continuousCalibration &&
      keyCenter &&
      trackerRef.current &&
      continuousCalibratorRef.current
    ) {
      const { ratios, headPose } = trackerRef.current.getLastRatios();
      if (ratios) {
        continuousCalibratorRef.current
          .recordImplicitSample(keyCenter, ratios, headPose)
          .then(() => {
            setImplicitSampleCount(
              continuousCalibratorRef.current?.getPendingCount() ?? 0
            );
          })
          .catch(() => {});
      }
    }
  }, [handleKeySelect, settings.continuousCalibration]);

  // Handle prediction selection
  const handlePredictionSelect = useCallback((word: string) => {
    setTypedText((prev) => {
      const beforeCursor = prev.slice(0, cursorPos);
      const afterCursor = prev.slice(cursorPos);
      const match = beforeCursor.match(/(\S+)$/);
      const partialLen = match ? match[1].length : 0;
      const newBefore = beforeCursor.slice(0, beforeCursor.length - partialLen) + word + ' ';
      setCursorPos(newBefore.length);
      return newBefore + afterCursor;
    });
    if (settings.audioFeedback) playClick();
  }, [settings.audioFeedback, cursorPos]);

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
              {typedText.length === 0 && cursorPos === 0 ? (
                <>
                  <span className="animate-pulse text-cyan-400">|</span>
                  <span className="text-gray-500 italic">
                    Start typing by looking at the keyboard below...
                  </span>
                </>
              ) : (
                <>
                  <span>{typedText.slice(0, cursorPos)}</span>
                  <span className="animate-pulse text-cyan-400">|</span>
                  <span>{typedText.slice(cursorPos)}</span>
                </>
              )}
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
            onKeySelect={handleKeySelectWithCalibration}
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
          onTrackerReady={handleTrackerReady}
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

      {/* Typing analytics panel */}
      <AnalyticsPanel
        liveAnalytics={liveAnalytics}
        sessionDuration={sessionDuration}
        implicitSampleCount={implicitSampleCount}
        visible={settings.showAnalytics}
      />
    </main>
  );
}
