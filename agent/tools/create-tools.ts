import type { WebContainer } from "@webcontainer/api";
import { askQuestionTool } from "./ask-question";
import { deleteFileTool, executeDeleteFileTool } from "./delete-file";
import { editTool, executeEditTool } from "./edit";
import {
  executeGetRuntimeDiagnosticsTool,
  getRuntimeDiagnosticsTool,
} from "./get-runtime-diagnostics";
import { executeGrepTool, grepTool } from "./grep";
import { executeListFilesTool, listFilesTool } from "./list-files";
import { executeRunBashTool, runBashTool } from "./run-bash";
import type { ExecuteToolOptions, ToolCallLike } from "./types";
import { executeViewTool, viewTool } from "./view";
import { executeWriteFileTool, writeFileTool } from "./write-file";

export const tools = {
  writeFile: {
    definition: writeFileTool,
    execute: executeWriteFileTool,
  },
  view: {
    definition: viewTool,
    execute: executeViewTool,
  },
  readFile: {
    definition: viewTool,
    execute: executeViewTool,
  },
  editFile: {
    definition: editTool,
    execute: executeEditTool,
  },
  listFiles: {
    definition: listFilesTool,
    execute: executeListFilesTool,
  },
  grep: {
    definition: grepTool,
    execute: executeGrepTool,
  },
  deleteFile: {
    definition: deleteFileTool,
    execute: executeDeleteFileTool,
  },
  runBash: {
    definition: runBashTool,
    execute: executeRunBashTool,
  },
  getRuntimeDiagnostics: {
    definition: getRuntimeDiagnosticsTool,
    execute: executeGetRuntimeDiagnosticsTool,
  },
  askQuestion: {
    definition: askQuestionTool,
  },
} as const;

export type ToolName = keyof typeof tools;

function extractToolDefinitions<
  T extends Record<string, { definition: unknown }>
>(source: T) {
  return Object.fromEntries(
    Object.entries(source).map(([name, entry]) => [name, entry.definition])
  ) as { [K in keyof T]: T[K]["definition"] };
}

export const chatTools = extractToolDefinitions(tools);

export async function executeToolCall(
  webcontainer: WebContainer | null,
  toolCall: ToolCallLike,
  options: ExecuteToolOptions = {}
) {
  const toolName = toolCall.toolName as ToolName;
  const selectedTool = tools[toolName];
  if (!selectedTool) {
    throw new Error(`Unknown tool "${toolCall.toolName}".`);
  }
  if (!("execute" in selectedTool)) {
    throw new Error(`Tool "${toolCall.toolName}" does not execute in runtime.`);
  }

  return selectedTool.execute(
    {
      webcontainer,
      options,
    },
    toolCall.input
  );
}
