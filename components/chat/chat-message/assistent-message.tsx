"use client";

import type { AskQuestionOutput } from "@/agent/tools/ask-question";
import { isToolUIPart, type UIMessage } from "ai";
import { MemoizedMarkdown } from "./markdown";
import { ToolArtifact } from "./tool-artifact";

export function AssistantMessage({
  message,
  onAskQuestionSubmit,
  showToolDebug,
}: {
  message: UIMessage;
  onAskQuestionSubmit: (toolCallId: string, output: AskQuestionOutput) => Promise<void>;
  showToolDebug: boolean;
}) {
  const seenText = new Set<string>();
  const dedupedParts = message.parts.filter((part) => {
    if (part.type === "text") {
      const trimmed = part.text.trim();
      if (!trimmed || seenText.has(trimmed)) return false;
      seenText.add(trimmed);
    }
    return true;
  });

  return (
    <div className="flex min-w-0">
      <div className="text-sm text-foreground flex min-w-0 flex-col gap-2 overflow-x-auto">
        {dedupedParts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div key={i}>
                <MemoizedMarkdown
                  id={`${message.id}-part-${i}`}
                  content={part.text}
                />
              </div>
            );
          }
          if (isToolUIPart(part)) {
            return (
              <ToolArtifact 
                key={i} 
                part={part} 
                onAskQuestionSubmit={onAskQuestionSubmit}
                showToolDebug={showToolDebug}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
