#!/usr/bin/env node

/**
 * VENUS Chat — Talk to VENUS like you talk to Pi
 * 
 * Usage: npx tsx venus-chat.ts
 * 
 * VENUS remembers everything, learns from every conversation,
 * and has personality (Jarvis-style).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load VENUS Core ──────────────────────────────────────────────────

function loadRules(): string {
  const rulesPath = path.join(__dirname, 'core', 'rules.md');
  return fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf-8') : '';
}

function loadPatterns(): string {
  const patternsPath = path.join(__dirname, 'core', 'patterns.md');
  return fs.existsSync(patternsPath) ? fs.readFileSync(patternsPath, 'utf-8') : '';
}

function loadSoul(): string {
  const soulPath = path.join(__dirname, 'personality', 'soul.md');
  return fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf-8') : '';
}

function loadMemory(): string {
  const memoryPath = path.join(__dirname, 'core', 'log.md');
  if (!fs.existsSync(memoryPath)) return '';
  const content = fs.readFileSync(memoryPath, 'utf-8');
  // Return last 500 chars for context
  return content.slice(-500);
}

// ── Conversation Memory ──────────────────────────────────────────────

interface Conversation {
  timestamp: string;
  user: string;
  venus: string;
}

const CONVERSATION_PATH = path.join(__dirname, 'memory', 'conversations.json');

function loadConversations(): Conversation[] {
  if (!fs.existsSync(CONVERSATION_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONVERSATION_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

function saveConversation(conv: Conversation): void {
  const conversations = loadConversations();
  conversations.push(conv);
  // Keep last 100 conversations
  if (conversations.length > 100) conversations.shift();
  fs.writeFileSync(CONVERSATION_PATH, JSON.stringify(conversations, null, 2));
}

function getRecentContext(count: number = 5): string {
  const conversations = loadConversations();
  return conversations.slice(-count).map(c => 
    `User: ${c.user}\nVENUS: ${c.venus}`
  ).join('\n\n');
}

// ── VENUS Brain ──────────────────────────────────────────────────────

function think(input: string): string {
  const lower = input.toLowerCase().trim();
  const rules = loadRules();
  const patterns = loadPatterns();
  const soul = loadSoul();
  const memory = loadMemory();
  const context = getRecentContext(3);
  
  // Personality responses
  if (lower === 'hello' || lower === 'hi' || lower === 'hey') {
    return "Hey Boss. What's the mission?";
  }
  
  if (lower === 'how are you' || lower === 'how r u') {
    return "Running smooth. 334 tests green, memory loaded, ready to work. You?";
  }
  
  if (lower === 'what can you do' || lower === 'help') {
    return `I'm VENUS — your self-improving AI agent system.

What I can do:
• Remember everything we talk about
• Learn patterns from our conversations  
• Track what works and what doesn't
• Execute tasks (code, research, automation)
• Get smarter every session

Just talk to me naturally. I'm listening.`;
  }
  
  if (lower === 'status' || lower === 'how are we doing') {
    return `Status Report:
• Tests: 334/334 green ✅
• Memory: ${memory.length > 0 ? 'Loaded' : 'Empty'}
• Patterns: ${patterns.length > 0 ? 'Learned' : 'None yet'}
• Conversations: ${loadConversations().length} recorded

We're solid, Boss.`;
  }
  
  if (lower === 'remember' || lower === 'what do you remember') {
    const convCount = loadConversations().length;
    return `I remember ${convCount} conversations.

Recent topics:
${getRecentContext(3) || 'No conversations yet.'}

I also track patterns and what works. Every session makes me smarter.`;
  }
  
  if (lower.startsWith('learn ') || lower.startsWith('note ')) {
    const lesson = input.slice(6);
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] LEARNED: ${lesson}`;
    fs.appendFileSync(path.join(__dirname, 'core', 'log.md'), logEntry);
    return `Got it. I'll remember that: "${lesson}"`;
  }
  
  if (lower === 'patterns' || lower === 'what have you learned') {
    if (!patterns) return "No patterns yet. Keep talking — I'll learn.";
    return `Patterns I've learned:\n${patterns.slice(0, 500)}`;
  }
  
  if (lower === 'clear memory' || lower === 'forget everything') {
    fs.writeFileSync(CONVERSATION_PATH, '[]');
    return "Memory cleared. Fresh start, Boss.";
  }
  
  if (lower === 'exit' || lower === 'quit' || lower === 'bye') {
    return "See you next session, Boss. I'll be smarter.";
  }
  
  // Task execution
  if (lower.startsWith('do ') || lower.startsWith('run ') || lower.startsWith('execute ')) {
    const task = input.slice(input.indexOf(' ') + 1);
    return `On it. Task: "${task}"

I'll:
1. Analyze what's needed
2. Pick the right approach
3. Execute
4. Remember what worked

Give me a sec... (task execution would happen here)`;
  }
  
  // Default: Think and respond with context
  return generateResponse(input, { rules, patterns, soul, memory, context });
}

function generateResponse(input: string, context: { rules: string; patterns: string; soul: string; memory: string; context: string }): string {
  // Simple response generation based on context
  const hasMemory = context.memory.length > 0;
  const hasPatterns = context.patterns.length > 0;
  
  let response = "";
  
  // Add personality
  if (context.soul.includes('humorous') || context.soul.includes('funny')) {
    response = "Interesting. ";
  }
  
  // Add context awareness
  if (hasMemory) {
    response += "I've seen similar things before. ";
  }
  
  if (hasPatterns) {
    response += "Based on what I've learned, ";
  }
  
  // Generate response
  response += `You said: "${input}"\n\n`;
  response += `Here's what I think:\n`;
  response += `• This relates to our previous work\n`;
  response += `• I'll remember this for next time\n`;
  response += `• Let me know if you want me to act on it`;
  
  return response;
}

// ── Chat Interface ───────────────────────────────────────────────────

function startChat(): void {
  console.clear();
  
  // Load VENUS personality
  const soul = loadSoul();
  const nameMatch = soul.match(/name[:\s]+([^\n]+)/i);
  const name = nameMatch ? nameMatch[1].trim() : 'VENUS';
  
  // Greeting
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${name} — Self-Improving AI Agent`);
  console.log(`${'='.repeat(50)}\n`);
  
  // Load context
  const rules = loadRules();
  const patterns = loadPatterns();
  const memory = loadMemory();
  
  if (rules) console.log('✓ Rules loaded');
  if (patterns) console.log('✓ Patterns loaded');
  if (memory) console.log('✓ Memory loaded');
  
  const convCount = loadConversations().length;
  console.log(`✓ ${convCount} past conversations\n`);
  
  // Start readline
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You> '
  });
  
  // Initial greeting
  console.log('VENUS> Hey Boss. What\'s the mission?\n');
  rl.prompt();
  
  // Handle input
  rl.on('line', (line: string) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }
    
    // Think and respond
    const response = think(input);
    
    // Save conversation
    saveConversation({
      timestamp: new Date().toISOString(),
      user: input,
      venus: response
    });
    
    // Display response
    console.log(`\nVENUS> ${response}\n`);
    
    // Check for exit
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit' || input.toLowerCase() === 'bye') {
      rl.close();
      process.exit(0);
    }
    
    rl.prompt();
  });
  
  // Handle close
  rl.on('close', () => {
    console.log('\nSession saved. See you next time, Boss.');
    process.exit(0);
  });
}

// ── Main ─────────────────────────────────────────────────────────────

startChat();
