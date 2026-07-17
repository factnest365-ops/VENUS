import { describe, it, expect } from 'vitest';
import { getVoice, shouldJoke, getVoicePrefix } from '../personality/voice';
import { greet, farewell, getJoke } from '../personality/index';

describe('personality system', () => {
  describe('voice', () => {
    it('returns serious tone for errors', () => {
      const voice = getVoice({ event: 'error' });
      expect(voice.tone).toBe('serious');
      expect(voice.humor).toBe('none');
    });

    it('returns playful tone for idle', () => {
      const voice = getVoice({ event: 'idle' });
      expect(voice.tone).toBe('playful');
      expect(voice.humor).toBe('full');
    });

    it('returns cold style for critical errors', () => {
      const voice = getVoice({ event: 'error', severity: 'critical' });
      expect(voice.style).toBe('cold');
    });

    it('shouldJoke returns false for errors', () => {
      expect(shouldJoke({ event: 'error' })).toBe(false);
    });

    it('shouldJoke returns true for idle', () => {
      expect(shouldJoke({ event: 'idle' })).toBe(true);
    });
  });

  describe('greetings', () => {
    it('returns a string greeting', () => {
      const result = greet();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a string farewell', () => {
      const result = farewell();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a joke', () => {
      const result = getJoke();
      expect(typeof result).toBe('string');
      expect(result!.length).toBeGreaterThan(0);
    });
  });
});
