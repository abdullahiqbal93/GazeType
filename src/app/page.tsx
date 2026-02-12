'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Landing page: Brief explanation + Start button.
 */
export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-6">
          <span className="text-6xl">👁️</span>
        </div>
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          GazeType
        </h1>
        <p className="text-xl text-gray-300 mb-2">
          Eye-Controlled Keyboard + Text-to-Speech
        </p>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Type using only your eyes. GazeType uses your laptop&apos;s webcam to track
          where you&apos;re looking and lets you select keys by dwelling your gaze.
          No special hardware needed.
        </p>

        {/* Feature badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {[
            '👀 Gaze Tracking',
            '⌨️ Virtual Keyboard',
            '🔮 Word Prediction',
            '🔊 Text-to-Speech',
            '🔒 100% Private',
            '♿ Accessible',
          ].map((feature) => (
            <span
              key={feature}
              className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-full text-sm border border-gray-700"
            >
              {feature}
            </span>
          ))}
        </div>

        {/* Start Button */}
        <Link
          href="/permissions"
          className="inline-block bg-cyan-500 hover:bg-cyan-400 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg shadow-cyan-500/20"
        >
          Get Started →
        </Link>

        {/* Privacy note */}
        <p className="mt-6 text-sm text-gray-500">
          🔒 Your camera feed never leaves your device. All processing happens locally in the browser.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-16 max-w-3xl w-full">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Calibrate',
              desc: 'Follow 9 dots on screen so the app learns where your eyes are looking.',
            },
            {
              step: '2',
              title: 'Look & Type',
              desc: 'Look at a key on the virtual keyboard. Hold your gaze to select it.',
            },
            {
              step: '3',
              title: 'Speak',
              desc: 'Your typed text can be read aloud using text-to-speech.',
            },
          ].map(({ step, title, desc }) => (
            <div
              key={step}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center"
            >
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
                {step}
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-gray-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div className="mt-12 mb-8 flex gap-6 text-sm text-gray-500">
        <Link href="/help" className="hover:text-gray-300">
          Help & Tips
        </Link>
      </div>
    </main>
  );
}
