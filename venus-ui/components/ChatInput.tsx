import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme";

interface Props {
  onSubmit: (input: string) => void;
}

export function ChatInput({ onSubmit }: Props) {
  const [input, setInput] = useState("");

  useInput((inputChar, key) => {
    if (key.return && input.trim()) {
      onSubmit(input);
      setInput("");
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
    } else if (!key.ctrl && !key.meta) {
      setInput(input + inputChar);
    }
  });

  return (
    <Box borderStyle="single" borderColor="green" paddingX={1}>
      <Text color={theme.colors.primary} bold>
        {theme.symbols.prompt}{" "}
      </Text>
      <Text>{input}</Text>
    </Box>
  );
}
