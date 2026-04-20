import type { RuntimeDiagnosticsSnapshot } from "@/agent/tools/types";
import type { WebContainer } from "@webcontainer/api";

export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
};

export type AgentToolRuntimeOptions = {
  onTerminalLog?: (data: string) => void;
  getRuntimeDiagnostics?: (
    tailLines: number
  ) => RuntimeDiagnosticsSnapshot | null;
  timeoutMs?: number;
};

export type AgentToolRunContext = {
  webcontainer: WebContainer | null;
  toolCall: AgentToolCall;
  signal: AbortSignal;
  runtime: AgentToolRuntimeOptions;
};

export type AgentToolRunResult =
  | { type: "completed"; output: unknown }
  | { type: "failed"; error: Error }
  | { type: "skipped"; reason?: string };

export type AgentToolOutputPayload =
  | { tool: string; toolCallId: string; output: unknown }
  | { tool: string; toolCallId: string; state: "output-error"; errorText: string };

export type AgentToolLifecycleHooks = {
  onToolStart?: (toolCall: AgentToolCall) => void | Promise<void>;
  onToolComplete?: (
    toolCall: AgentToolCall,
    output: unknown
  ) => void | Promise<void>;
  onToolError?: (toolCall: AgentToolCall, error: Error) => void | Promise<void>;
  onToolSkipped?: (
    toolCall: AgentToolCall,
    reason?: string
  ) => void | Promise<void>;
};
