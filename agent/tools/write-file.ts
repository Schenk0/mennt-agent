import { writeFile } from "@/lib/webcontainer";
import { tool } from "ai";
import { z } from "zod";
import {
  ensureFilePath,
  normalizeRelativePath,
} from "../utils/directory-helper";
import { byteLengthUtf8 } from "../utils/fs-shared";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const writeFileToolInput = z.object({
  path: z.string().describe("File path relative to project root, e.g. app/page.tsx"),
  content: z.string().describe("The complete file content to write"),
});

export const writeFileDescription =
  "Write content to a file. Creates parent directories as needed and overwrites existing files.";

export const writeFileTool = tool({
  description: writeFileDescription,
  inputSchema: writeFileToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeWriteFileTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = writeFileToolInput.parse(rawInput);
  const container = ensureContainer(webcontainer);
  const path = ensureFilePath(normalizeRelativePath(input.path));
  await writeFile(container, path, input.content);

  return {
    filePath: path,
    bytesWritten: byteLengthUtf8(input.content),
  };
}
