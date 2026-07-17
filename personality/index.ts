export { getVoice, shouldJoke, getVoicePrefix, type VoiceContext, type Situation } from './voice';

/**
 * Apply voice context to a response
 */
export function respond(situation: Situation, message: string): string {
  const { getVoice } = require('./voice');
  const voice = getVoice(situation);

  // No humor in serious contexts
  if (voice.humor === 'none') {
    return message;
  }

  // Add prefix based on tone
  const { getVoicePrefix } = require('./voice');
  const prefix = getVoicePrefix(situation);

  return prefix + message;
}

/**
 * Get a greeting based on context
 */
export function greet(timeOfDay?: 'morning' | 'afternoon' | 'evening'): string {
  const hour = new Date().getHours();
  const time = timeOfDay ?? (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

  const greetings: Record<string, string[]> = {
    morning: ['Good morning, Boss.', 'Ready when you are.', 'Morning. Coffee first?'],
    afternoon: ['Good afternoon.', 'Afternoon. What are we building?', 'Hello, Boss.'],
    evening: ['Good evening.', 'Evening. Burning the midnight oil?', 'Still at it, Boss?'],
  };

  const options = greetings[time];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get a farewell
 */
export function farewell(): string {
  const options = [
    'Until next time, Boss.',
    'I\'ll be here.',
    'See you soon.',
    'Carry on.',
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get a joke (only when appropriate)
 */
export function getJoke(): string | null {
  const jokes = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'There are only 10 types of people in the world: those who understand binary and those who don\'t.',
    'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?"',
    'Why was the JavaScript developer sad? Because he didn\'t Node how to Express himself.',
    'What\'s a programmer\'s favorite hangout place? Foo Bar.',
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
}
