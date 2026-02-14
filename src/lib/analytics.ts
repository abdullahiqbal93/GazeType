/**
 * Typing analytics: tracks WPM, accuracy, and session statistics.
 *
 * Metrics tracked:
 * - Words per minute (WPM): uses standard 5-char word definition
 * - Accuracy: 1 - (backspaces / total keystrokes)
 * - Rolling WPM: calculated over the last 60 seconds
 * - Session history: persisted to IndexedDB
 *
 * Design Decision: WPM uses the "gross WPM" formula (total chars / 5 / minutes)
 * which is the industry standard for typing speed measurement. We also track
 * "net WPM" which subtracts errors, but display gross by default.
 */

import { TypingAnalytics, TypingSession } from './types';
import { saveTypingSession, loadTypingSessions } from './idb';

/** Standard word length for WPM calculation */
const CHARS_PER_WORD = 5;

/** Rolling window for current WPM (ms) */
const ROLLING_WINDOW_MS = 60_000;

/**
 * Typing analytics tracker.
 * Create one per typing session.
 */
export class TypingAnalyticsTracker {
  private sessionStart: number;
  private totalChars = 0;
  private totalKeystrokes = 0;
  private backspaceCount = 0;
  private wordTimestamps: number[] = [];
  /** Per-keystroke timestamps for rolling WPM */
  private charTimestamps: number[] = [];
  private sessionId: string;
  private finalText = '';

  constructor() {
    this.sessionStart = Date.now();
    this.sessionId = `session_${this.sessionStart}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Record a keystroke.
   * @param keyType - The type of key pressed
   * @param isBackspace - Whether this was a backspace
   * @param isWordBoundary - Whether this completes a word (space, punctuation)
   */
  recordKeystroke(
    keyType: string,
    isBackspace: boolean,
    isWordBoundary: boolean
  ): void {
    const now = Date.now();
    this.totalKeystrokes++;

    if (isBackspace) {
      this.backspaceCount++;
    } else {
      this.totalChars++;
      this.charTimestamps.push(now);
    }

    if (isWordBoundary && !isBackspace) {
      this.wordTimestamps.push(now);
    }
  }

  /**
   * Get current analytics snapshot.
   */
  getAnalytics(): TypingAnalytics {
    const now = Date.now();
    const elapsedMs = now - this.sessionStart;
    const elapsedMinutes = Math.max(elapsedMs / 60_000, 1 / 60); // at least 1 second

    // Overall WPM
    const overallWpm = this.totalChars > 0
      ? (this.totalChars / CHARS_PER_WORD) / elapsedMinutes
      : 0;

    // Rolling WPM (last 60 seconds)
    const cutoff = now - ROLLING_WINDOW_MS;
    const recentChars = this.charTimestamps.filter((t) => t > cutoff).length;
    const rollingMinutes = Math.min(elapsedMs, ROLLING_WINDOW_MS) / 60_000;
    const currentWpm = recentChars > 0 && rollingMinutes > 0
      ? (recentChars / CHARS_PER_WORD) / rollingMinutes
      : 0;

    // Accuracy
    const accuracy = this.totalKeystrokes > 0
      ? 1 - this.backspaceCount / this.totalKeystrokes
      : 1;

    return {
      sessionStart: this.sessionStart,
      totalChars: this.totalChars,
      totalKeystrokes: this.totalKeystrokes,
      backspaceCount: this.backspaceCount,
      wordTimestamps: [...this.wordTimestamps],
      currentWpm: Math.round(currentWpm * 10) / 10,
      overallWpm: Math.round(overallWpm * 10) / 10,
      accuracy: Math.round(accuracy * 1000) / 1000,
    };
  }

  /**
   * Update the final text (for session saving).
   */
  setFinalText(text: string): void {
    this.finalText = text;
  }

  /**
   * End the session and persist to IndexedDB.
   */
  async endSession(): Promise<TypingSession> {
    const analytics = this.getAnalytics();
    const session: TypingSession = {
      id: this.sessionId,
      startTime: this.sessionStart,
      endTime: Date.now(),
      totalChars: analytics.totalChars,
      totalKeystrokes: analytics.totalKeystrokes,
      backspaceCount: analytics.backspaceCount,
      wpm: analytics.overallWpm,
      accuracy: analytics.accuracy,
      finalText: this.finalText,
    };

    try {
      await saveTypingSession(session);
    } catch (e) {
      console.warn('Failed to save typing session:', e);
    }

    return session;
  }

  /**
   * Get session duration in a human-readable format.
   */
  getSessionDuration(): string {
    const elapsed = Date.now() - this.sessionStart;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}

/**
 * Load historical session statistics.
 */
export async function getSessionHistory(): Promise<{
  sessions: TypingSession[];
  avgWpm: number;
  avgAccuracy: number;
  totalSessions: number;
  totalCharsAllTime: number;
  totalTimeMinutes: number;
}> {
  let sessions: TypingSession[] = [];
  try {
    sessions = await loadTypingSessions();
  } catch (e) {
    console.warn('Failed to load session history:', e);
  }

  if (sessions.length === 0) {
    return {
      sessions: [],
      avgWpm: 0,
      avgAccuracy: 0,
      totalSessions: 0,
      totalCharsAllTime: 0,
      totalTimeMinutes: 0,
    };
  }

  const avgWpm = sessions.reduce((a, s) => a + s.wpm, 0) / sessions.length;
  const avgAccuracy = sessions.reduce((a, s) => a + s.accuracy, 0) / sessions.length;
  const totalCharsAllTime = sessions.reduce((a, s) => a + s.totalChars, 0);
  const totalTimeMinutes = sessions.reduce(
    (a, s) => a + (s.endTime - s.startTime) / 60_000,
    0
  );

  return {
    sessions,
    avgWpm: Math.round(avgWpm * 10) / 10,
    avgAccuracy: Math.round(avgAccuracy * 1000) / 1000,
    totalSessions: sessions.length,
    totalCharsAllTime,
    totalTimeMinutes: Math.round(totalTimeMinutes * 10) / 10,
  };
}
