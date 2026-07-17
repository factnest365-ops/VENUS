/**
 * VENUS Voice System
 *
 * Returns tone/style context based on situation.
 * Error → serious. Success → brief. Idle → playful.
 */

export interface VoiceContext {
  tone: "serious" | "brief" | "playful" | "focused" | "empathetic";
  style: "concise" | "verbose" | "warm" | "cold" | "dry";
  humor: "none" | "minimal" | "light" | "full";
  emoji: "none" | "rare" | "moderate" | "heavy";
}

export interface Situation {
  /** What happened */
  event: "error" | "success" | "idle" | "work" | "frustration" | "celebration" | "routine";
  /** Optional severity for errors (default: "normal") */
  severity?: "low" | "normal" | "critical";
  /** Whether user is waiting for response */
  waiting?: boolean;
}

const voices: Record<Situation["event"], VoiceContext> = {
  error: {
    tone: "serious",
    style: "concise",
    humor: "none",
    emoji: "none",
  },
  success: {
    tone: "brief",
    style: "concise",
    humor: "minimal",
    emoji: "rare",
  },
  idle: {
    tone: "playful",
    style: "warm",
    humor: "full",
    emoji: "moderate",
  },
  work: {
    tone: "focused",
    style: "concise",
    humor: "none",
    emoji: "none",
  },
  frustration: {
    tone: "empathetic",
    style: "warm",
    humor: "none",
    emoji: "none",
  },
  celebration: {
    tone: "playful",
    style: "dry",
    humor: "light",
    emoji: "rare",
  },
  routine: {
    tone: "focused",
    style: "concise",
    humor: "minimal",
    emoji: "none",
  },
};

/**
 * Get voice context for a given situation.
 *
 * @example
 * const voice = getVoice({ event: "error", severity: "critical" });
 * // → { tone: "serious", humor: "none", ... }
 *
 * @example
 * const voice = getVoice({ event: "idle" });
 * // → { tone: "playful", humor: "full", ... }
 */
export function getVoice(context: Situation): VoiceContext {
  const base = voices[context.event];

  // Critical errors override everything
  if (context.event === "error" && context.severity === "critical") {
    return { ...base, style: "cold" as const };
  }

  // Frustrated user in error state → empathetic
  if (context.event === "error" && context.severity === "low") {
    return { ...base, tone: "serious" as const, style: "warm" as const };
  }

  return base;
}

/**
 * Helper: should I include humor in this response?
 */
export function shouldJoke(context: Situation): boolean {
  const voice = getVoice(context);
  return voice.humor !== "none";
}

/**
 * Helper: get a one-liner prompt prefix based on voice.
 */
export function getVoicePrefix(context: Situation): string {
  const voice = getVoice(context);

  const prefixes: Record<VoiceContext["tone"], string> = {
    serious: "",
    brief: "",
    playful: "",
    focused: "",
    empathetic: "I understand this is frustrating. ",
  };

  return prefixes[voice.tone];
}
