'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Help / Troubleshooting page: tips for lighting, camera, recalibration.
 */
export default function HelpPage() {
  return (
    <main className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">
            ← Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8">Help & Troubleshooting</h1>

        {/* Tips sections */}
        <div className="space-y-8">
          {/* Lighting */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">💡 Lighting Tips</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Ensure your face is well-lit from the <strong className="text-gray-200">front</strong>, not backlit</li>
              <li>• Avoid strong overhead lights that create shadows around your eyes</li>
              <li>• Avoid wearing glasses with reflective coatings if possible</li>
              <li>• Natural, diffused lighting works best</li>
              <li>• Avoid having a bright window directly behind you</li>
            </ul>
          </section>

          {/* Camera Position */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">📷 Camera Positioning</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• Position your webcam at the <strong className="text-gray-200">top center</strong> of your screen</li>
              <li>• Sit about <strong className="text-gray-200">arm&apos;s length</strong> (50-70cm) from the screen</li>
              <li>• Keep your head relatively centered in the camera view</li>
              <li>• The webcam preview will show if your face is detected</li>
              <li>• A built-in laptop webcam works fine</li>
            </ul>
          </section>

          {/* Calibration */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">🎯 Calibration Tips</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• <strong className="text-gray-200">Stay still</strong> during calibration — move only your eyes</li>
              <li>• Look directly at the center of each dot</li>
              <li>• If quality is low (&lt;50%), try again with better lighting</li>
              <li>• Recalibrate if you change your seating position or monitor</li>
              <li>• Calibration data is saved and persists across browser sessions</li>
              <li>• You can recalibrate from Settings at any time</li>
            </ul>
          </section>

          {/* Typing */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">⌨️ Typing Tips</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• <strong className="text-gray-200">Dwell selection</strong>: Look at a key and hold your gaze steady</li>
              <li>• The key will highlight and a progress bar appears</li>
              <li>• Increase dwell time in Settings if you&apos;re accidentally selecting keys</li>
              <li>• Decrease dwell time to type faster once you&apos;re comfortable</li>
              <li>• Use <strong className="text-gray-200">word predictions</strong> to speed up typing</li>
              <li>• The 🔊 key reads your typed text aloud</li>
            </ul>
          </section>

          {/* Troubleshooting */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">🔧 Troubleshooting</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-200">Camera not working?</p>
                <p className="text-gray-400 text-sm mt-1">
                  Make sure no other app is using your camera. Try refreshing the page.
                  Check your browser&apos;s site permissions for camera access.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Gaze cursor is jumpy?</p>
                <p className="text-gray-400 text-sm mt-1">
                  Increase the smoothing factor in Settings. Ensure good lighting on your face.
                  Try recalibrating.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Gaze is inaccurate?</p>
                <p className="text-gray-400 text-sm mt-1">
                  Recalibrate. Make sure you&apos;re sitting in a similar position as during calibration.
                  Use larger key sizes in Settings.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Selecting wrong keys?</p>
                <p className="text-gray-400 text-sm mt-1">
                  Increase dwell time to require longer gaze. Increase key size for bigger targets.
                  Recalibrate for better accuracy.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-200">Low FPS / laggy?</p>
                <p className="text-gray-400 text-sm mt-1">
                  Close other browser tabs. Make sure hardware acceleration is enabled in your browser.
                  The app targets 20+ FPS on typical laptops.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">🔒 Privacy</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• All camera processing happens <strong className="text-gray-200">locally in your browser</strong></li>
              <li>• No video frames are ever sent to any server</li>
              <li>• No images or recordings are stored</li>
              <li>• Calibration and settings are stored in your browser&apos;s localStorage</li>
              <li>• You can clear all data from Settings</li>
              <li>• The &quot;Camera On&quot; indicator shows when the camera is active</li>
              <li>• Use the &quot;Stop Camera&quot; button to disable the camera at any time</li>
            </ul>
          </section>

          {/* Accessibility */}
          <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">♿ Accessibility Settings</h2>
            <ul className="space-y-2 text-gray-400">
              <li>• <strong className="text-gray-200">Dwell time</strong>: How long you need to look at a key (300-2000ms)</li>
              <li>• <strong className="text-gray-200">Key size</strong>: Small, medium, or large keyboard keys</li>
              <li>• <strong className="text-gray-200">High contrast</strong>: Yellow-on-black color scheme</li>
              <li>• <strong className="text-gray-200">Audio feedback</strong>: Click sound on key selection</li>
              <li>• <strong className="text-gray-200">Text-to-speech</strong>: Read typed text aloud</li>
              <li>• <strong className="text-gray-200">Blink selection</strong>: Blink to select instead of dwell (optional)</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <Link href="/type" className="text-cyan-400 hover:text-cyan-300">
            Go to Typing →
          </Link>
        </div>
      </div>
    </main>
  );
}
