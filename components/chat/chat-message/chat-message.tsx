"use client";

import type { AskQuestionOutput } from "@/agent/tools/ask-question";
import { type UIMessage } from "ai";
import { AssistantMessage } from "./assistent-message";
import { UserMessage } from "./user-message";

type ChatMessageProps = {
  message: UIMessage;
  onAskQuestionSubmit: (toolCallId: string, output: AskQuestionOutput) => Promise<void>;
  showToolDebug: boolean;
};

export function ChatMessage({
  message,
  onAskQuestionSubmit,
  showToolDebug,
}: ChatMessageProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }
  return (
    <AssistantMessage
      message={message}
      onAskQuestionSubmit={onAskQuestionSubmit}
      showToolDebug={showToolDebug}
    />
  );
}