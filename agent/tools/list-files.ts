import { tool } from "ai";
import { z } from "zod";
import { normalizeRelativePath } from "../utils/directory-helper";
import {
  DEFAULT_MAX_LINES,
  listDirectoryEntries
} from "../utils/fs-shared";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const listFilesToolInput = z.object({
  dirPath: z
    .string()
    .optional()
    .default(".")
    .describe("Directory path to list (defaults to project root)"),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Recursively list all entries"),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`1-based entry number to start listing from (default 1)`),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`Maximum number of entries to return (default ${DEFAULT_MAX_LINES})`),
});

export const listFilesDescription = `
List files and directories at the given path.

Set recursive=true to walk subdirectories.
Large results are paginated automatically.
Use offset and limit to continue.
`;

export const listFilesTool = tool({
  description: listFilesDescription,
  inputSchema: listFilesToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeListFilesTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = listFilesToolInput.parse(rawInput);
  const container = ensureContainer(webcontainer);
  const dirPath = normalizeRelativePath(input.dirPath);

  try {
    return await listDirectoryEntries({
      container,
      dirPath,
      recursive: input.recursive,
      offset: input.offset,
      limit: input.limit,
    });
  } catch (error) {
    return {
      error: `Unable to list "${dirPath}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      dirPath,
    };
  }
}
