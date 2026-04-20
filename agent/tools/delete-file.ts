import { tool } from "ai";
import { z } from "zod";
import {
  ensureFilePath,
  normalizeRelativePath,
} from "../utils/directory-helper";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const deleteFileToolInput = z.object({
  filePath: z.string().describe("Path to the file or directory to delete"),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Recursively delete directories"),
});

export const deleteFileDescription = `Delete a file or directory.

Set recursive=true when deleting directories.`;

export const deleteFileTool = tool({
  description: deleteFileDescription,
  inputSchema: deleteFileToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeDeleteFileTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = deleteFileToolInput.parse(rawInput);
  const container = ensureContainer(webcontainer);
  const filePath = ensureFilePath(normalizeRelativePath(input.filePath));

  let isDirectory = false;
  try {
    await container.fs.readdir(filePath);
    isDirectory = true;
  } catch {
    isDirectory = false;
  }

  if (isDirectory && !input.recursive) {
    return {
      error: "Path is a directory. Set recursive=true to delete it.",
      filePath,
    };
  }

  try {
    await container.fs.rm(filePath, { recursive: input.recursive, force: false });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const missingPath =
      details.toLowerCase().includes("no such file") ||
      details.toLowerCase().includes("not found");
    if (missingPath) {
      return {
        error: `Path does not exist: ${filePath}`,
        filePath,
      };
    }

    return {
      error: `Failed to delete ${filePath}: ${details}`,
      filePath,
    };
  }

  return { deleted: filePath };
}
