"use client";

import type { AskQuestionOutput } from "@/agent/tools/ask-question";
import {
    createTerminalLogger,
    getTerminalLogs,
} from "@/components/debug-terminal/terminal-logger";
import {
    AgentToolLoop,
    applyAgentToolMiddleware,
    createRuntimeToolRunner,
    withToolFilter,
    withToolLifecycleHooks,
} from "@/lib/agent-loop";
import {
    useAiRunState,
    useTrackedAiRunState,
} from "@/lib/agent-run-state";
import { useChat } from "@ai-sdk/react";
import type { WebContainer } from "@webcontainer/api";
import {
    DefaultChatTransport,
    isToolUIPart,
    lastAssistantMessageIsCompleteWithToolCalls,
    type FileUIPart,
} from "ai";
import { useCallback, useEffect, useRef } from "react";

const transport = new DefaultChatTransport({ api: "/api/chat" });
const logToAgentTerminal = createTerminalLogger("agent-terminal");

const runtimeToolRunner = applyAgentToolMiddleware(
  createRuntimeToolRunner(),
  withToolFilter((toolName) => toolName !== "askQuestion"),
  withToolLifecycleHooks({})
);

export function useAgent(webcontainer: WebContainer | null) {
  const toolLoopRef = useRef(new AgentToolLoop(runtimeToolRunner));
  const {
    markToolCallRunning,
    markToolCallFinished,
    clearActiveToolCalls,
    reset,
  } = useAiRunState();

  const { messages, sendMessage, addToolOutput, status, stop, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      await toolLoopRef.current.handleToolCall(
        webcontainer,
        {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        },
        {
          onTerminalLog: logToAgentTerminal,
          getRuntimeDiagnostics: () => ({
            terminalLogs: getTerminalLogs("terminal"),
          }),
        },
        {
          onToolCallRunning: (toolCallId) => {
            markToolCallRunning(toolCallId);
          },
          onToolCallFinished: (toolCallId) => {
            markToolCallFinished(toolCallId);
          },
          onToolOutput: async (payload) => {
            // Important: do not await addToolOutput here.
            // AI SDK runs onToolCall inside a serial job executor, and addToolOutput
            // also enqueues a job on the same executor. Awaiting it here deadlocks.
            void addToolOutput(payload as never)
              .then(() => {
              })
              .catch((error) => {
                const message = error instanceof Error ? error.message : String(error);
                markToolPartAsError(payload.toolCallId, message);
              });
          },
          onUnhandledError: (error, failedToolCall) => {
            markToolPartAsError(failedToolCall.toolCallId, error.message);
          },
        }
      );
    },
  });

  function markToolPartAsError(toolCallId: string, errorText: string) {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.role !== "assistant") {
          return message;
        }
        let updated = false;
        const parts = message.parts.map((part) => {
          if (!isToolUIPart(part)) {
            return part;
          }
          if (part.toolCallId !== toolCallId) {
            return part;
          }
          if (part.state === "output-available" || part.state === "output-error") {
            return part;
          }
          updated = true;
          return {
            ...part,
            state: "output-error" as const,
            errorText,
          };
        }) as typeof message.parts;
        return updated ? ({ ...message, parts } as typeof message) : message;
      }) as typeof prev
    );
  }

  const handleAskQuestionOutput = useCallback(
    async (toolCallId: string, output: AskQuestionOutput) => {
      try {
        await addToolOutput({
          tool: "askQuestion",
          toolCallId,
          output,
        } as never);
      } finally {
        markToolCallFinished(toolCallId);
      }
    },
    [addToolOutput, markToolCallFinished]
  );

  const { isStreaming, isRunning } = useTrackedAiRunState(messages, status);

  useEffect(() => {
    return () => {
      toolLoopRef.current.reset();
      reset();
    };
  }, [reset]);

  const sendPreparedMessage = useCallback(
    (text: string, files: FileUIPart[]) => {
      if (files.length > 0) {
        sendMessage({ text, files });
        return;
      }

      sendMessage({ text });
    },
    [sendMessage]
  );

  const cancelActiveToolCalls = useCallback(() => {
    toolLoopRef.current.cancelActiveToolCalls();
    clearActiveToolCalls();
  }, [clearActiveToolCalls]);

  const cancelRun = useCallback(() => {
    cancelActiveToolCalls();
    stop();

    setMessages((prev) => {
      let didUpdate = false;
      const nextMessages = prev.map((message) => {
        if (message.role !== "assistant") {
          return message;
        }

        let messageDidUpdate = false;
        const updatedParts = message.parts.map((part) => {
          if (!isToolUIPart(part)) {
            return part;
          }
          if (part.state !== "input-available" && part.state !== "input-streaming") {
            return part;
          }
          didUpdate = true;
          messageDidUpdate = true;
          return {
            ...part,
            state: "output-error" as const,
            errorText: "Cancelled by user.",
          };
        });

        return messageDidUpdate ? { ...message, parts: updatedParts } : message;
      });

      return didUpdate ? nextMessages : prev;
    });
  }, [cancelActiveToolCalls, setMessages, stop]);

  return {
    messages,
    isStreaming,
    isRunning,
    handleAskQuestionOutput,
    sendPreparedMessage,
    cancelRun,
  };
}
