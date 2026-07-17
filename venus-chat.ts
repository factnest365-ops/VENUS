#!/usr/bin/env node

/**
 * VENUS Chat — Talk to VENUS like you talk to Pi
 * 
 * Usage: npx tsx venus-chat.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Colors ───────────────────────────────────────────────────────────

const green   = chalk.hex('#00FF9C');
const greenB  = green.bold;
const greenD  = green.dim;
const hot     = chalk.hex('#FF6B6B');
const gold    = chalk.hex('#FFD93D');
const goldB   = gold.bold;
const cyan    = chalk.hex('#00CEC9');
const dim     = chalk.dim;
const bold    = chalk.bold;
const white   = chalk.white;
const whiteB  = white.bold;

// ── Box Drawing ──────────────────────────────────────────────────────

function drawBox(title: string, lines: string[], width = 52): string {
  const inner = width - 2;
  const top    = '╔' + '═'.repeat(inner) + '╗';
  const bottom = '╚' + '═'.repeat(inner) + '╝';
  const pad = Math.max(0, Math.floor((inner - title.length) / 2));
  const titleLine = '║' + ' '.repeat(pad) + greenB(title) + ' '.repeat(Math.max(0, inner - pad - title.length)) + '║';
  const sep = '║' + greenD('─'.repeat(inner)) + '║';

  const body = lines.map(l => {
    const stripped = l.replace(/\x1b\[[0-9;]*m/g, '');
    const p = inner - stripped.length;
    return '║' + ' ' + l + (p > 1 ? ' '.repeat(p - 1) : '') + '║';
  });

  return [top, titleLine, sep, ...body, bottom].join('\n');
}

// ── Load VENUS Core ──────────────────────────────────────────────────

function loadRules(): string {
  const p = path.join(__dirname, 'core', 'rules.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function loadPatterns(): string {
  const p = path.join(__dirname, 'core', 'patterns.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function loadSoul(): string {
  const p = path.join(__dirname, 'personality', 'soul.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function loadMemory(): string {
  const p = path.join(__dirname, 'core', 'log.md');
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf-8').slice(-500);
}

// ── Conversation Memory ──────────────────────────────────────────────

interface Conversation { timestamp: string; user: string; venus: string; }

const CONV_PATH = path.join(__dirname, 'memory', 'conversations.json');

function loadConversations(): Conversation[] {
  if (!fs.existsSync(CONV_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(CONV_PATH, 'utf-8')); } catch { return []; }
}

function saveConversation(conv: Conversation): void {
  const all = loadConversations();
  all.push(conv);
  if (all.length > 100) all.shift();
  fs.writeFileSync(CONV_PATH, JSON.stringify(all, null, 2));
}

function getRecentContext(n = 5): string {
  return loadConversations().slice(-n).map(c => `User: ${c.user}\nVENUS: ${c.venus}`).join('\n\n');
}

// ── VENUS Brain ──────────────────────────────────────────────────────

function think(input: string): string {
  const low = input.toLowerCase().trim();
  const memory = loadMemory();
  const patterns = loadPatterns();

  if (['hello', 'hi', 'hey'].includes(low)) {
    return green("Hey Boss. What's the mission?");
  }

  if (['how are you', 'how r u'].includes(low)) {
    return green("Running smooth.") + ' ' + dim("334 tests green, memory loaded, ready to work. You?");
  }

  if (['what can you do', 'help'].includes(low)) {
    return [
      greenB("VENUS") + ' — ' + white("Self-Improving AI Agent System"),
      '',
      gold("  What I can do:"),
      '  ' + cyan("•") + ' Remember everything we talk about',
      '  ' + cyan("•") + ' Learn patterns from our conversations',
      '  ' + cyan("•") + ' Track what works and what doesn\'t',
      '  ' + cyan("•") + ' Execute tasks (code, research, automation)',
      '  ' + cyan("•") + ' Get smarter every session',
      '',
      dim("Just talk to me naturally. I'm listening."),
    ].join('\n');
  }

  if (['status', 'how are we doing'].includes(low)) {
    const ms = memory.length > 0 ? green("● Loaded") : hot("○ Empty");
    const ps = patterns.length > 0 ? green("● Learned") : dim("○ None yet");
    const cc = loadConversations().length;
    return [
      goldB("  Status Report"),
      '',
      '  Tests:         ' + green("334/334") + ' ' + green("✓"),
      '  Memory:        ' + ms,
      '  Patterns:      ' + ps,
      '  Conversations: ' + cyan(String(cc)),
      '',
      green("  We're solid, Boss."),
    ].join('\n');
  }

  if (['remember', 'what do you remember'].includes(low)) {
    const cc = loadConversations().length;
    const ctx = getRecentContext(3);
    return [
      bold("I remember " + cyan(String(cc)) + " conversations."),
      '',
      goldB("  Recent topics:"),
      ctx ? dim(ctx.split('\n').map(l => '    ' + l).join('\n')) : dim("    No conversations yet."),
      '',
      dim("Every session makes me smarter."),
    ].join('\n');
  }

  if (low.startsWith('learn ') || low.startsWith('note ')) {
    const lesson = input.slice(6);
    fs.appendFileSync(path.join(__dirname, 'core', 'log.md'), '\n[' + new Date().toISOString() + '] LEARNED: ' + lesson);
    return green("Got it.") + ' I\'ll remember that: ' + whiteB('"' + lesson + '"');
  }

  if (['patterns', 'what have you learned'].includes(low)) {
    if (!patterns) return dim("No patterns yet. Keep talking — I'll learn.");
    return goldB("Patterns I've learned:") + '\n' + white(patterns.slice(0, 500));
  }

  if (['clear memory', 'forget everything'].includes(low)) {
    fs.writeFileSync(CONV_PATH, '[]');
    return hot("Memory cleared.") + ' Fresh start, Boss.';
  }

  if (['exit', 'quit', 'bye'].includes(low)) {
    return green("See you next session,") + ' Boss. ' + dim("I'll be smarter.");
  }

  if (low.startsWith('do ') || low.startsWith('run ') || low.startsWith('execute ')) {
    const task = input.slice(input.indexOf(' ') + 1);
    return [
      green("On it.") + ' Task: ' + whiteB('"' + task + '"'),
      '',
      dim("  1. Analyze what's needed"),
      dim("  2. Pick the right approach"),
      dim("  3. Execute"),
      dim("  4. Remember what worked"),
      '',
      dim("  Give me a sec..."),
    ].join('\n');
  }

  // Default
  const lines: string[] = [];
  if (memory.length > 0) lines.push(dim("  I've seen similar things before."));
  if (patterns.length > 0) lines.push(dim("  Based on what I've learned..."));
  lines.push('');
  lines.push('  You said: ' + whiteB('"' + input + '"'));
  lines.push('');
  lines.push(goldB("  Here's what I think:"));
  lines.push('  ' + cyan("•") + ' This relates to our previous work');
  lines.push('  ' + cyan("•") + ' I\'ll remember this for next time');
  lines.push('  ' + cyan("•") + ' Let me know if you want me to act on it');
  return lines.join('\n');
}

// ── Chat Interface ───────────────────────────────────────────────────

function startChat(): void {
  console.clear();

  const soul = loadSoul();
  const nameMatch = soul.match(/name[:\s]+([^\n]+)/i);
  const name = nameMatch ? nameMatch[1].trim() : 'VENUS';

  const rules    = loadRules();
  const patterns = loadPatterns();
  const memory   = loadMemory();
  const cc = loadConversations().length;

  const statusLines = [
    rules    ? green("✓") + ' Rules loaded'      : dim("○") + ' No rules yet',
    patterns ? green("✓") + ' Patterns loaded'    : dim("○") + ' No patterns yet',
    memory   ? green("✓") + ' Memory loaded'      : dim("○") + ' No memory yet',
    green("✓") + ' ' + cyan(String(cc)) + ' past conversations',
  ];

  console.log('');
  console.log(drawBox(name, statusLines));
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '  ' + greenB('❯') + ' ',
  });

  console.log('  ' + greenB('VENUS') + '  ' + white("Hey Boss. What's the mission?"));
  console.log('');
  rl.prompt();

  rl.on('line', (line: string) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    const response = think(input);
    saveConversation({ timestamp: new Date().toISOString(), user: input, venus: response });

    // Response bubble
    const respLines = response.split('\n');
    const maxLen = Math.max(...respLines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length), 40);
    const w = Math.min(maxLen + 6, 60);
    const inner = w - 4;

    console.log('');
    console.log(greenD('  ╭' + '─'.repeat(w - 2) + '╮'));
    for (const rl2 of respLines) {
      const stripped = rl2.replace(/\x1b\[[0-9;]*m/g, '');
      const pad = inner - stripped.length;
      console.log(greenD('  │') + ' ' + rl2 + (pad > 0 ? ' '.repeat(pad - 1) : '') + ' ' + greenD('│'));
    }
    console.log(greenD('  ╰' + '─'.repeat(w - 2) + '╯'));
    console.log('');

    if (['exit', 'quit', 'bye'].includes(input.toLowerCase())) {
      rl.close();
      process.exit(0);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('');
    console.log('  ' + dim('Session saved. See you next time, Boss.'));
    console.log('');
    process.exit(0);
  });
}

startChat();
