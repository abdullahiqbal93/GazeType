'use client';

import React, { useEffect, useState } from 'react';
import { UserSettings } from '@/lib/types';
import { getVoices } from '@/lib/tts';
import { saveSettings } from '@/lib/storage';

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdate: (updates: Partial<UserSettings>) => void;
  onRecalibrate: () => void;
  onClose: () => void;
}

export default function SettingsPanel({
  settings,
  onUpdate,
  onRecalibrate,
  onClose,
}: SettingsPanelProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => setVoices(getVoices());
    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleChange = (updates: Partial<UserSettings>) => {
    onUpdate(updates);
    saveSettings({ ...settings, ...updates });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">⚙️ Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Dwell Time */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">
            Dwell Time: {settings.dwellTime}ms
          </label>
          <input
            type="range"
            min={300}
            max={2000}
            step={100}
            value={settings.dwellTime}
            onChange={(e) => handleChange({ dwellTime: parseInt(e.target.value) })}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Fast (300ms)</span><span>Slow (2000ms)</span>
          </div>
        </div>

        {/* Smoothing */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">
            Smoothing: {settings.smoothingFactor.toFixed(2)}
          </label>
          <input
            type="range"
            min={5}
            max={80}
            step={5}
            value={settings.smoothingFactor * 100}
            onChange={(e) => handleChange({ smoothingFactor: parseInt(e.target.value) / 100 })}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>More smooth</span><span>More responsive</span>
          </div>
        </div>

        {/* Key Size */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-2">Key Size</label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                onClick={() => handleChange({ keySize: size })}
                className={`px-4 py-2 rounded-lg capitalize ${
                  settings.keySize === size
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3 mb-5">
          {[
            { key: 'blinkSelectEnabled', label: 'Blink to Select' },
            { key: 'showGazeCursor', label: 'Show Gaze Cursor' },
            { key: 'highContrast', label: 'High Contrast Mode' },
            { key: 'audioFeedback', label: 'Audio Feedback' },
            { key: 'predictionsEnabled', label: 'Word Predictions' },
            { key: 'autoSpeak', label: 'Auto-Speak Sentences' },
            { key: 'debugMode', label: 'Debug Mode' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">{label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings[key as keyof UserSettings] as boolean}
                  onChange={(e) => handleChange({ [key]: e.target.checked })}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings[key as keyof UserSettings] ? 'bg-cyan-500' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
                      settings[key as keyof UserSettings] ? 'translate-x-5.5 ml-1' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* TTS Voice */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">TTS Voice</label>
          <select
            value={settings.ttsVoice}
            onChange={(e) => handleChange({ ttsVoice: e.target.value })}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        {/* TTS Rate */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">
            Speech Rate: {settings.ttsRate.toFixed(1)}x
          </label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.ttsRate}
            onChange={(e) => handleChange({ ttsRate: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500"
          />
        </div>

        {/* Blink Threshold */}
        {settings.blinkSelectEnabled && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1">
              Blink Threshold (EAR): {settings.blinkThreshold.toFixed(2)}
            </label>
            <input
              type="range"
              min={15}
              max={30}
              step={1}
              value={settings.blinkThreshold * 100}
              onChange={(e) => handleChange({ blinkThreshold: parseInt(e.target.value) / 100 })}
              className="w-full accent-cyan-500"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onRecalibrate}
            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg font-medium"
          >
            Recalibrate
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded-lg font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
