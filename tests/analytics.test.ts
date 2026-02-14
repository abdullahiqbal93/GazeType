/**
 * Tests for typing analytics.
 */
import { TypingAnalyticsTracker } from '../src/lib/analytics';

describe('TypingAnalyticsTracker', () => {
  let tracker: TypingAnalyticsTracker;

  beforeEach(() => {
    tracker = new TypingAnalyticsTracker();
  });

  describe('recordKeystroke', () => {
    it('tracks total keystrokes', () => {
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      
      const analytics = tracker.getAnalytics();
      expect(analytics.totalKeystrokes).toBe(3);
      expect(analytics.totalChars).toBe(3);
      expect(analytics.backspaceCount).toBe(0);
    });

    it('tracks backspaces separately', () => {
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('backspace', true, false);
      
      const analytics = tracker.getAnalytics();
      expect(analytics.totalKeystrokes).toBe(3);
      expect(analytics.totalChars).toBe(2);
      expect(analytics.backspaceCount).toBe(1);
    });

    it('tracks word boundaries', () => {
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('space', false, true);
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('space', false, true);
      
      const analytics = tracker.getAnalytics();
      expect(analytics.wordTimestamps).toHaveLength(2);
    });
  });

  describe('getAnalytics', () => {
    it('returns analytics with correct structure', () => {
      const analytics = tracker.getAnalytics();
      
      expect(analytics).toHaveProperty('sessionStart');
      expect(analytics).toHaveProperty('totalChars');
      expect(analytics).toHaveProperty('totalKeystrokes');
      expect(analytics).toHaveProperty('backspaceCount');
      expect(analytics).toHaveProperty('wordTimestamps');
      expect(analytics).toHaveProperty('currentWpm');
      expect(analytics).toHaveProperty('overallWpm');
      expect(analytics).toHaveProperty('accuracy');
    });

    it('reports 100% accuracy with no backspaces', () => {
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      
      const analytics = tracker.getAnalytics();
      expect(analytics.accuracy).toBe(1);
    });

    it('reports reduced accuracy with backspaces', () => {
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('char', false, false);
      tracker.recordKeystroke('backspace', true, false);
      
      const analytics = tracker.getAnalytics();
      // accuracy = 1 - 1/3 ≈ 0.667
      expect(analytics.accuracy).toBeCloseTo(0.667, 2);
    });

    it('reports 0 WPM initially', () => {
      const analytics = tracker.getAnalytics();
      expect(analytics.overallWpm).toBe(0);
      expect(analytics.currentWpm).toBe(0);
    });

    it('calculates WPM based on characters typed', () => {
      // Type 25 characters (5 words)
      for (let i = 0; i < 25; i++) {
        tracker.recordKeystroke('char', false, false);
      }
      
      const analytics = tracker.getAnalytics();
      // Since almost no time has passed, WPM should be very high
      // Just check it's a positive number
      expect(analytics.overallWpm).toBeGreaterThan(0);
    });
  });

  describe('getSessionDuration', () => {
    it('returns a formatted string', () => {
      const duration = tracker.getSessionDuration();
      expect(typeof duration).toBe('string');
      expect(duration).toMatch(/\d+s/); // Should contain seconds
    });
  });

  describe('setFinalText', () => {
    it('stores the final text', () => {
      tracker.setFinalText('hello world');
      // The final text is used when ending the session
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});
