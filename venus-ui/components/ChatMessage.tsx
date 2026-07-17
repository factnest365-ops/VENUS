import React from "react";
import { Box, Text } from "ink";

interface Props {
  message: string;
  isUser: boolean;
  timestamp: string;
}

export function ChatMessage({ message, isUser, timestamp }: Props) {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box
        borderStyle="round"
        borderColor={isUser ? "gray" : "green"}
        paddingX={1}
        flexDirection="column"
      >
        <Text color={isUser ? "gray" : "green"} bold>
          {isUser ? "You" : "VENUS"}
        </Text>
        <Text>{message}</Text>
      </Box>
      <Text color="gray" dimColor>{timestamp}</Text>
    </Box>
  );
}
