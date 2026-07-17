import { describe, it, expect, beforeEach } from 'vitest';
import { Personality } from '../personality/core.js';

describe('Personality', () => {
  let personality: Personality;

  beforeEach(() => {
    personality = new Personality();
  });

  it('should have default traits', () => {
    const traits = personality.getTraits();
    expect(traits).toHaveProperty('curiosity');
    expect(traits).toHaveProperty('caution');
    expect(traits).toHaveProperty('creativity');
  });

  it('should adjust traits based on feedback', () => {
    const before = personality.getTrait('curiosity');
    personality.adjustTrait('curiosity', 0.1);
    const after = personality.getTrait('curiosity');
    expect(after).toBeGreaterThan(before);
  });

  it('should clamp traits between 0 and 1', () => {
    personality.adjustTrait('caution', 10);
    expect(personality.getTrait('caution')).toBe(1);

    personality.adjustTrait('caution', -10);
    expect(personality.getTrait('caution')).toBe(0);
  });

  it('should generate system prompt incorporating traits', () => {
    const prompt = personality.toSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(10);
  });

  it('should evolve personality over time', () => {
    const initial = { ...personality.getTraits() };
    
    // Simulate many interactions
    for (let i = 0; i < 100; i++) {
      personality.recordInteraction({
        outcome: Math.random() > 0.5 ? 'success' : 'failure',
        complexity: Math.random(),
      });
    }

    const evolved = personality.getTraits();
    // At least one trait should have changed
    const changed = Object.keys(initial).some(
      (key) => initial[key] !== evolved[key]
    );
    expect(changed).toBe(true);
  });

  it('should serialize and deserialize', () => {
    personality.adjustTrait('creativity', 0.8);
    const json = personality.toJSON();
    const restored = Personality.fromJSON(json);

    expect(restored.getTrait('creativity')).toBe(0.8);
  });
});
