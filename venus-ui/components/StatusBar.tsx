import React from "react";
import { Box, Text } from "ink";

interface Props {
  conversations: number;
  memoryActive: boolean;
  patterns: number;
}

export function StatusBar({ conversations, memoryActive, patterns }: Props) {
  return (
    <Box borderStyle="single" borderColor="green" paddingX={1} justifyContent="space-between">
      <Text color="green">💬 {conversations}</Text>
      <Text color="cyan">🧠 {memoryActive ? "ON" : "OFF"}</Text>
      <Text color="yellow">📊 {patterns} patterns</Text>
    </Box>
  );
}
