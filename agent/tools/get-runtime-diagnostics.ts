import { tool } from "ai";
import { z } from "zod";
import { processTerminalOutputText } from "../utils/terminal-output";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const getRuntimeDiagnosticsToolInput = z.object({
  tailLines: z
    .number()
    .int()
    .min(1)
    .max(400)
    .optional()
    .default(120)
    .describe("How many recent preview terminal lines to return."),
});

export const runtimeDiagnosticsDescription = `
Get recent preview/dev-server terminal output.

Use this before finalizing or when the user reports that "run dev" shows an error.
`;

export const getRuntimeDiagnosticsTool = tool({
  description: runtimeDiagnosticsDescription,
  inputSchema: getRuntimeDiagnosticsToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeGetRuntimeDiagnosticsTool(
  { options }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = getRuntimeDiagnosticsToolInput.parse(rawInput);
  const snapshot = options.getRuntimeDiagnostics?.(input.tailLines);
  if (!snapshot) {
    return "Runtime diagnostics are not available yet.";
  }

  const lines = processTerminalOutputText(snapshot.terminalLogs).split("\n");
  const tail = lines.slice(-input.tailLines);
  return tail.join("\n") || "(no terminal output yet)";
}
