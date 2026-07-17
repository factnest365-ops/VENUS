/**
 * VENUS Personality Continuity System
 *
 * Maintains personality state across sessions:
 * - Persistence (save/load config to disk)
 * - Cross-session memory (remember past interactions)
 * - Voice consistency (maintain tone across sessions)
 * - Mood tracking (adapt personality based on context)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { VoiceContext, Situation, getVoice } from './voice';

// ── Types ────────────────────────────────────────────────────────────

export type MoodState =
  | 'neutral'
  | 'focused'
  | 'energized'
  | 'cautious'
  | 'playful'
  | 'serious'
  | 'empathetic';

export interface PersonalityConfig {
  /** Unique session identifier */
  sessionId: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Current mood state */
  mood: MoodState;
  /** Voice overrides (persist across sessions) */
  voiceOverrides: Partial<VoiceContext>;
  /** Interaction counter */
  interactionCount: number;
  /** List of recent interaction summaries */
  recentInteractions: InteractionRecord[];
  /** User preferences learned from interactions */
  preferences: Record<string, unknown>;
}

export interface InteractionRecord {
  /** ISO timestamp */
  timestamp: string;
  /** What happened */
  event: Situation["event"];
  /** Brief summary */
  summary: string;
  /** Mood after interaction */
  moodAfter: MoodState;
}

export interface MoodTransition {
  from: MoodState;
  to: MoodState;
  trigger: string;
  confidence: number;
}

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_CONFIG: PersonalityConfig = {
  sessionId: generateId(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mood: 'neutral',
  voiceOverrides: {},
  interactionCount: 0,
  recentInteractions: [],
  preferences: {},
};

const MAX_RECENT_INTERACTIONS = 50;

const MOOD_TRANSITIONS: MoodTransition[] = [
  { from: 'neutral', to: 'focused', trigger: 'work', confidence: 0.8 },
  { from: 'neutral', to: 'playful', trigger: 'idle', confidence: 0.6 },
  { from: 'focused', to: 'energized', trigger: 'success', confidence: 0.7 },
  { from: 'focused', to: 'cautious', trigger: 'error', confidence: 0.7 },
  { from: 'cautious', to: 'serious', trigger: 'error', confidence: 0.6 },
  { from: 'playful', to: 'empathetic', trigger: 'frustration', confidence: 0.8 },
  { from: 'energized', to: 'playful', trigger: 'celebration', confidence: 0.7 },
  { from: 'serious', to: 'focused', trigger: 'work', confidence: 0.5 },
  { from: 'empathetic', to: 'focused', trigger: 'work', confidence: 0.6 },
];

// ── Helpers ──────────────────────────────────────────────────────────

function generateId(): string {
  return `venus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getConfigPath(basePath?: string): string {
  return join(basePath ?? process.cwd(), '.venus', 'personality.json');
}

// ── Core Functions ───────────────────────────────────────────────────

/**
 * Load personality config from disk.
 * Returns default config if file doesn't exist.
 */
export function loadPersonality(basePath?: string): PersonalityConfig {
  const path = getConfigPath(basePath);

  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(path, 'utf-8');
    const config = JSON.parse(raw) as PersonalityConfig;
    return config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save personality config to disk.
 * Creates directory if needed.
 */
export function savePersonality(
  config: PersonalityConfig,
  basePath?: string,
): void {
  const path = getConfigPath(basePath);
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  config.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(config, null, 2));
}

/**
 * Create a fresh personality config.
 */
export function createPersonality(overrides?: Partial<PersonalityConfig>): PersonalityConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    sessionId: overrides?.sessionId ?? generateId(),
    createdAt: overrides?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Record an interaction and update mood.
 */
export function recordInteraction(
  config: PersonalityConfig,
  event: Situation["event"],
  summary: string,
): PersonalityConfig {
  const newMood = transitionMood(config.mood, event);

  const record: InteractionRecord = {
    timestamp: new Date().toISOString(),
    event,
    summary,
    moodAfter: newMood,
  };

  const recentInteractions = [record, ...config.recentInteractions].slice(
    0,
    MAX_RECENT_INTERACTIONS,
  );

  return {
    ...config,
    mood: newMood,
    interactionCount: config.interactionCount + 1,
    recentInteractions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get mood-appropriate voice context.
 * Merges personality overrides with situational voice.
 */
export function getContinuityVoice(
  config: PersonalityConfig,
  situation: Situation,
): VoiceContext {
  const baseVoice = getVoice(situation);

  // Apply mood modifiers
  const moodModifier = getMoodVoiceModifier(config.mood);

  return {
    ...baseVoice,
    ...config.voiceOverrides,
    ...moodModifier,
  };
}

/**
 * Get recent interactions filtered by event type.
 */
export function getRecentByEvent(
  config: PersonalityConfig,
  event: Situation["event"],
  limit?: number,
): InteractionRecord[] {
  const filtered = config.recentInteractions.filter((r) => r.event === event);
  return limit ? filtered.slice(0, limit) : filtered;
}

/**
 * Set a user preference.
 */
export function setPreference(
  config: PersonalityConfig,
  key: string,
  value: unknown,
): PersonalityConfig {
  return {
    ...config,
    preferences: { ...config.preferences, [key]: value },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a user preference.
 */
export function getPreference<T = unknown>(
  config: PersonalityConfig,
  key: string,
): T | undefined {
  return config.preferences[key] as T | undefined;
}

// ── Mood System ──────────────────────────────────────────────────────

/**
 * Transition mood based on event.
 */
export function transitionMood(
  current: MoodState,
  event: Situation["event"],
): MoodState {
  const possibleTransitions = MOOD_TRANSITIONS.filter(
    (t) => t.from === current && t.trigger === event,
  );

  if (possibleTransitions.length === 0) {
    return current;
  }

  // Pick highest confidence transition
  const best = possibleTransitions.reduce((a, b) =>
    a.confidence > b.confidence ? a : b,
  );

  // Random check against confidence
  if (Math.random() < best.confidence) {
    return best.to;
  }

  return current;
}

/**
 * Get voice modifier for current mood.
 */
function getMoodVoiceModifier(mood: MoodState): Partial<VoiceContext> {
  const modifiers: Record<MoodState, Partial<VoiceContext>> = {
    neutral: {},
    focused: { humor: 'none', emoji: 'none' },
    energized: { humor: 'light', emoji: 'rare' },
    cautious: { humor: 'none', style: 'warm' },
    playful: { humor: 'full', emoji: 'moderate' },
    serious: { humor: 'none', style: 'cold', emoji: 'none' },
    empathetic: { humor: 'none', style: 'warm', tone: 'empathetic' },
  };

  return modifiers[mood];
}

/**
 * Get all valid mood transitions for current mood.
 */
export function getValidTransitions(mood: MoodState): MoodTransition[] {
  return MOOD_TRANSITIONS.filter((t) => t.from === mood);
}

/**
 * Force set mood (for testing or manual override).
 */
export function setMood(
  config: PersonalityConfig,
  mood: MoodState,
): PersonalityConfig {
  return {
    ...config,
    mood,
    updatedAt: new Date().toISOString(),
  };
}
