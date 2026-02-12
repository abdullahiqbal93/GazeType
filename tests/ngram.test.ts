/**
 * Tests for n-gram word prediction module
 */
import { getPredictions, extractCurrentAndPrevWord } from '@/lib/ngram';

describe('getPredictions', () => {
  it('should return empty for empty input', () => {
    expect(getPredictions('', '')).toEqual([]);
  });

  it('should return prefix matches', () => {
    const preds = getPredictions('hel', '', 5);
    expect(preds.length).toBeGreaterThan(0);
    for (const p of preds) {
      expect(p.startsWith('hel')).toBe(true);
    }
  });

  it('should not include the exact prefix word', () => {
    const preds = getPredictions('the', '');
    expect(preds).not.toContain('the');
  });

  it('should return contextual suggestions based on previous word', () => {
    const preds = getPredictions('', 'i', 5);
    expect(preds.length).toBeGreaterThan(0);
    // Should include common bigrams of "i"
    expect(preds.some((p) => ['am', 'want', 'need', 'like', 'have'].includes(p))).toBe(true);
  });

  it('should boost bigram-matching completions', () => {
    // "good m" → should suggest "morning" highly
    const preds = getPredictions('m', 'good', 5);
    expect(preds).toContain('morning');
  });

  it('should limit number of suggestions', () => {
    const preds = getPredictions('a', '', 3);
    expect(preds.length).toBeLessThanOrEqual(3);
  });
});

describe('extractCurrentAndPrevWord', () => {
  it('should extract current word from single word', () => {
    const result = extractCurrentAndPrevWord('hel');
    expect(result.currentWord).toBe('hel');
    expect(result.previousWord).toBe('');
  });

  it('should extract both words from two words', () => {
    const result = extractCurrentAndPrevWord('hello wor');
    expect(result.currentWord).toBe('wor');
    expect(result.previousWord).toBe('hello');
  });

  it('should handle trailing space (finished word)', () => {
    const result = extractCurrentAndPrevWord('hello ');
    expect(result.currentWord).toBe('');
    expect(result.previousWord).toBe('hello');
  });

  it('should handle empty text', () => {
    const result = extractCurrentAndPrevWord('');
    expect(result.currentWord).toBe('');
    expect(result.previousWord).toBe('');
  });
});
