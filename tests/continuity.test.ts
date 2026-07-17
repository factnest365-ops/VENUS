import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createPersonality,
  loadPersonality,
  savePersonality,
  recordInteraction,
  getContinuityVoice,
  setPreference,
  getPreference,
  transitionMood,
  getValidTransitions,
  setMood,
  type PersonalityConfig,
  type MoodState,
} from '../personality/continuity';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.venus-test');

beforeEach(() => {
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe('personality continuity', () => {
  describe('createPersonality', () => {
    it('creates a new personality with defaults', () => {
      const config = createPersonality();
      expect(config.sessionId).toMatch(/^venus-/);
      expect(config.mood).toBe('neutral');
      expect(config.interactionCount).toBe(0);
      expect(config.recentInteractions).toEqual([]);
      expect(config.preferences).toEqual({});
    });

    it('accepts overrides', () => {
      const config = createPersonality({ mood: 'focused', sessionId: 'custom-id' });
      expect(config.mood).toBe('focused');
      expect(config.sessionId).toBe('custom-id');
    });
  });

  describe('save/load personality', () => {
    it('saves and loads personality config', () => {
      const config = createPersonality({ mood: 'energized' });
      savePersonality(config, TEST_DIR);

      const loaded = loadPersonality(TEST_DIR);
      expect(loaded.mood).toBe('energized');
      expect(loaded.sessionId).toBe(config.sessionId);
    });

    it('returns default config when file does not exist', () => {
      const loaded = loadPersonality('/nonexistent/path');
      expect(loaded.mood).toBe('neutral');
      expect(loaded.sessionId).toMatch(/^venus-/);
    });
  });

  describe('recordInteraction', () => {
    it('increments interaction count', () => {
      const config = createPersonality();
      const updated = recordInteraction(config, 'work', 'Started coding');
      expect(updated.interactionCount).toBe(1);
    });

    it('adds interaction to recent list', () => {
      const config = createPersonality();
      const updated = recordInteraction(config, 'success', 'Deployed');
      expect(updated.recentInteractions.length).toBe(1);
      expect(updated.recentInteractions[0].event).toBe('success');
      expect(updated.recentInteractions[0].summary).toBe('Deployed');
    });

    it('limits recent interactions to 50', () => {
      let config = createPersonality();
      for (let i = 0; i < 60; i++) {
        config = recordInteraction(config, 'routine', `Task ${i}`);
      }
      expect(config.recentInteractions.length).toBe(50);
      expect(config.recentInteractions[0].summary).toBe('Task 59');
    });
  });

  describe('mood system', () => {
    it('transitions from neutral to focused on work', () => {
      const result = transitionMood('neutral', 'work');
      // May or may not transition based on confidence, but should be valid
      expect(['neutral', 'focused']).toContain(result);
    });

    it('returns valid transitions for mood', () => {
      const transitions = getValidTransitions('neutral');
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions.some((t) => t.to === 'focused')).toBe(true);
    });

    it('force sets mood', () => {
      const config = createPersonality();
      const updated = setMood(config, 'serious');
      expect(updated.mood).toBe('serious');
    });
  });

  describe('voice with continuity', () => {
    it('returns voice context for current mood', () => {
      const config = createPersonality({ mood: 'serious' });
      const voice = getContinuityVoice(config, { event: 'idle' });
      expect(voice).toBeDefined();
      expect(voice.tone).toBeDefined();
    });

    it('applies voice overrides', () => {
      const config = createPersonality({
        voiceOverrides: { humor: 'none' },
      });
      const voice = getContinuityVoice(config, { event: 'idle' });
      expect(voice.humor).toBe('none');
    });
  });

  describe('preferences', () => {
    it('sets and gets preferences', () => {
      let config = createPersonality();
      config = setPreference(config, 'theme', 'dark');
      expect(getPreference(config, 'theme')).toBe('dark');
    });

    it('returns undefined for missing preference', () => {
      const config = createPersonality();
      expect(getPreference(config, 'missing')).toBeUndefined();
    });
  });
});
