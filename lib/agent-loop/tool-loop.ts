import type { WebContainer } from "@webcontainer/api";
import type { AgentToolRunner } from "./runner";
import type {
  AgentToolCall,
  AgentToolOutputPayload,
  AgentToolRuntimeOptions,
} from "./types";

type AgentToolLoopCallbacks = {
  onToolCallRunning?: (toolCallId: string) => void;
  onToolCallFinished?: (toolCallId: string) => void;
  onToolOutput: (payload: AgentToolOutputPayload) => Promise<void>;
  onUnhandledError?: (error: Error, toolCall: AgentToolCall) => void;
};

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export class AgentToolLoop {
  private readonly activeToolAbortControllers = new Map<string, AbortController>();
  private readonly handledToolCallIds = new Set<string>();
  private readonly cancelledToolCallIds = new Set<string>();

  constructor(private readonly runner: AgentToolRunner) {}

  private async sendToolOutputWithRetry(
    callbacks: AgentToolLoopCallbacks,
    payload: AgentToolOutputPayload,
    retries = 2
  ) {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await callbacks.onToolOutput(payload);
        return;
      } catch (error) {
        lastError = toError(error);
        if (attempt === retries) {
          break;
        }
        await sleep(200 * (attempt + 1));
      }
    }

    throw lastError ?? new Error("Failed to deliver tool output.");
  }

  async handleToolCall(
    webcontainer: WebContainer | null,
    toolCall: AgentToolCall,
    runtime: AgentToolRuntimeOptions = {},
    callbacks: AgentToolLoopCallbacks
  ) {
    if (this.handledToolCallIds.has(toolCall.toolCallId)) {
      return;
    }
    this.cancelledToolCallIds.delete(toolCall.toolCallId);
    this.handledToolCallIds.add(toolCall.toolCallId);

    const abortController = new AbortController();
    this.activeToolAbortControllers.set(toolCall.toolCallId, abortController);
    callbacks.onToolCallRunning?.(toolCall.toolCallId);

    try {
      const result = await this.runner({
        webcontainer,
        toolCall,
        signal: abortController.signal,
        runtime,
      });

      if (this.cancelledToolCallIds.has(toolCall.toolCallId)) {
        return;
      }

      if (result.type === "completed") {
        await this.sendToolOutputWithRetry(callbacks, {
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: result.output,
        });
        return;
      }

      if (result.type === "failed") {
        await this.sendToolOutputWithRetry(callbacks, {
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: result.error.message,
        });
        return;
      }
    } catch (error) {
      const toolError = toError(error);
      try {
        await this.sendToolOutputWithRetry(callbacks, {
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: toolError.message,
        });
      } catch (dispatchError) {
        this.handledToolCallIds.delete(toolCall.toolCallId);
        callbacks.onUnhandledError?.(toError(dispatchError), toolCall);
      }
    } finally {
      this.activeToolAbortControllers.delete(toolCall.toolCallId);
      this.cancelledToolCallIds.delete(toolCall.toolCallId);
      callbacks.onToolCallFinished?.(toolCall.toolCallId);
    }
  }

  cancelActiveToolCalls() {
    for (const [toolCallId, controller] of this.activeToolAbortControllers.entries()) {
      this.cancelledToolCallIds.add(toolCallId);
      controller.abort();
    }
    this.activeToolAbortControllers.clear();
  }

  reset() {
    this.cancelActiveToolCalls();
    this.handledToolCallIds.clear();
  }
}
