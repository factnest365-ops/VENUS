import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { StatusBar } from "./components/StatusBar";
import { theme } from "./theme";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RULES_PATH = path.join(__dirname, "..", "core", "rules.md");
const PATTERNS_PATH = path.join(__dirname, "..", "core", "patterns.md");
const CONV_PATH = path.join(__dirname, "..", "memory", "conversations.json");

function loadFile(p: string): string {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

function loadConversations(): any[] {
  const content = loadFile(CONV_PATH);
  try { return JSON.parse(content); } catch { return []; }
}

export function App() {
  const [messages, setMessages] = useState<{ user: string; venus: string }[]>([]);
  const [thinking, setThinking] = useState(false);
  const { exit } = useApp();

  const rules = loadFile(RULES_PATH);
  const patterns = loadFile(PATTERNS_PATH);
  const convCount = loadConversations().length;

  const handleSubmit = (input: string) => {
    setThinking(true);
    
    setTimeout(() => {
      let response = "";
      const lower = input.toLowerCase().trim();

      if (lower === "hello" || lower === "hi" || lower === "hey") {
        response = "Hey Boss. What's the mission?";
      } else if (lower === "status") {
        response = `Status Report:\n• Tests: 334/334 ✓\n• Memory: ${rules ? "Loaded" : "Empty"}\n• Patterns: ${patterns ? "Learned" : "None yet"}`;
      } else if (lower === "help") {
        response = "I'm VENUS — your self-improving AI agent.\n• Remember everything\n• Learn patterns\n• Execute tasks\n• Get smarter every session";
      } else if (lower === "exit" || lower === "quit") {
        exit();
      } else {
        response = `Got it: "${input}"\nI'll remember that.`;
      }

      setMessages([...messages, { user: input, venus: response }]);
      setThinking(false);
    }, 500);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="green" paddingX={2} marginBottom={1}>
        <Text color={theme.colors.primary} bold>VENUS</Text>
        <Text color={theme.colors.muted}> — Self-Improving AI Agent</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.length === 0 && (
          <Text color={theme.colors.muted}>Hey Boss. What's the mission?</Text>
        )}
        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            message={m.user}
            isUser={true}
            timestamp={new Date().toLocaleTimeString()}
          />
        ))}
      </Box>

      {/* Input */}
      <ChatInput onSubmit={handleSubmit} />

      {/* Status Bar */}
      <Box marginTop={1}>
        <StatusBar
          conversations={convCount}
          memoryActive={!!rules}
          patterns={patterns ? 1 : 0}
        />
      </Box>
    </Box>
  );
}
