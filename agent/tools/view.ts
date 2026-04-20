import { tool } from "ai";
import { z } from "zod";
import {
  ensureFilePath,
  normalizeRelativePath,
} from "../utils/directory-helper";
import {
  byteLengthUtf8,
  DEFAULT_MAX_LINE_LENGTH,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_OUTPUT_BYTES,
  formatBytes,
  isBinaryPath,
  truncateLine,
  listDirectoryEntries,
} from "../utils/fs-shared";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const viewToolInput = z.object({
  path: z
    .string()
    .optional()
    .default(".")
    .describe("File or directory path relative to project root."),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based line number to start reading from (files only)."),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`Maximum number of lines to return (default ${DEFAULT_MAX_LINES}).`),
  view_range: z
    .array(z.number().int())
    .length(2)
    .nullable()
    .optional()
    .describe(
      "Optional [start, end) line range for files. 1-indexed. Use -1 as end to read to file end."
    ),
});

export const viewDescription = `
Read a file with line numbers and safe output limits.

For large files, use offset and limit to paginate.
If the path is a directory, returns a non-recursive listing.
`;

export const viewTool = tool({
  description: viewDescription,
  inputSchema: viewToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeViewTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = viewToolInput.parse(rawInput);
  const container = ensureContainer(webcontainer);
  const path = normalizeRelativePath(input.path);
  const viewRange = input.view_range ?? undefined;

  if (viewRange && (input.offset || input.limit)) {
    throw new Error("Use either view_range or offset/limit, not both.");
  }

  let offset = input.offset;
  let limit = input.limit;
  if (viewRange) {
    const [start, end] = viewRange;
    if (start < 1) {
      throw new Error("Invalid view_range: start must be at least 1.");
    }
    if (end !== -1 && end <= start) {
      throw new Error("Invalid view_range: end must be -1 or greater than start.");
    }
    offset = start;
    limit = end === -1 ? undefined : end - start;
  }

  try {
    const filePath = ensureFilePath(path);
    if (isBinaryPath(filePath)) {
      return {
        error: `Cannot read binary file: ${filePath}`,
        filePath,
      };
    }

    const fileContent = await container.fs.readFile(path, "utf-8");
    const allLines = fileContent.split("\n");
    const totalLines = allLines.length;
    const lineLimit = limit ?? DEFAULT_MAX_LINES;
    const start = (offset ?? 1) - 1;

    if (start > 0 && start >= totalLines) {
      return {
        error: `Offset ${offset} is out of range (file has ${totalLines} lines)`,
        filePath,
      };
    }

    const end = Math.min(start + lineLimit, totalLines);
    const slice = allLines.slice(start, end);
    let totalBytes = 0;
    let truncatedByBytes = false;
    const outputLines: string[] = [];

    for (let index = 0; index < slice.length; index += 1) {
      const truncated = truncateLine(slice[index], DEFAULT_MAX_LINE_LENGTH);
      const numberedLine = `${start + index + 1}: ${truncated}`;
      const lineBytes = byteLengthUtf8(numberedLine);
      if (totalBytes + lineBytes > DEFAULT_MAX_OUTPUT_BYTES) {
        truncatedByBytes = true;
        break;
      }

      totalBytes += lineBytes;
      outputLines.push(numberedLine);
    }

    const lastLine = start + outputLines.length;
    const hasMore = lastLine < totalLines;
    let status: string;

    if (truncatedByBytes) {
      status =
        `Output capped at ${formatBytes(DEFAULT_MAX_OUTPUT_BYTES)}. ` +
        `Showing lines ${start + 1}-${lastLine} of ${totalLines}. ` +
        `Use offset=${lastLine + 1} to continue.`;
    } else if (hasMore) {
      status =
        `Showing lines ${start + 1}-${lastLine} of ${totalLines}. ` +
        `Use offset=${lastLine + 1} to continue.`;
    } else {
      status = `End of file - ${totalLines} lines total.`;
    }

    return {
      filePath,
      totalLines,
      fromLine: start + 1,
      toLine: lastLine,
      status,
      content: outputLines.join("\n"),
    };
  } catch {
    if (viewRange) {
      throw new Error("view_range can only be used when reading a file.");
    }

    try {
      return await listDirectoryEntries({
        container,
        dirPath: path,
        recursive: false,
        offset: input.offset,
        limit: input.limit,
      });
    } catch (error) {
      return {
        error: `Unable to view "${path}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        path,
      };
    }
  }
}
