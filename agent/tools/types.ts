import { WebContainer } from "@webcontainer/api";

export type ToolCallLike = {
  toolName: string;
  input: unknown;
};

export type RuntimeDiagnosticsSnapshot = {
  terminalLogs: string[];
};

export type ExecuteToolOptions = {
  onTerminalLog?: (data: string) => void;
  signal?: AbortSignal;
  getRuntimeDiagnostics?: (tailLines: number) => RuntimeDiagnosticsSnapshot | null;
};

export type ToolExecutionContext = {
  webcontainer: WebContainer | null;
  options: ExecuteToolOptions;
};
