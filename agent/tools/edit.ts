import { tool } from "ai";
import { z } from "zod";
import {
  ensureFilePath,
  normalizeRelativePath,
} from "../utils/directory-helper";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const editToolInput = z.object({
  path: z.string().describe("File path relative to project root."),
  oldString: z
    .string()
    .optional()
    .describe("The exact text to find in the file."),
  newString: z
    .string()
    .optional()
    .describe("The replacement text."),
  replaceAll: z
    .boolean()
    .optional()
    .default(false)
    .describe("Replace all occurrences instead of just the first match."),
}).superRefine((value, ctx) => {
  const oldString = value.oldString;
  const newString = value.newString;

  if (typeof oldString !== "string" || oldString.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: 'Provide "oldString" (or legacy "old") as a non-empty string.',
      path: ["oldString"],
    });
  }

  if (typeof newString !== "string") {
    ctx.addIssue({
      code: "custom",
      message: 'Provide "newString" (or legacy "new") as a string.',
      path: ["newString"],
    });
  }
});

export const editDescription = `
Edit a file by replacing exact string matches.

The oldString text must exist in the file.
Use replaceAll=true to replace every occurrence.
Supports legacy keys old/new for compatibility.
`;

export const editTool = tool({
  description: editDescription,
  inputSchema: editToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeEditTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = editToolInput.parse(rawInput);
  const container = ensureContainer(webcontainer);
  const path = ensureFilePath(normalizeRelativePath(input.path));
  const oldString = input.oldString ?? "";
  const newString = input.newString ?? "";

  const content = await container.fs.readFile(path, "utf-8");
  let oldFragment = oldString;
  let newFragment = newString;
  let firstMatch = content.indexOf(oldFragment);

  // Fallback: tolerate edit fragments copied directly from view output.
  if (firstMatch === -1) {
    const sanitizedOld = stripViewLineNumberPrefixes(oldString);
    if (sanitizedOld !== oldString) {
      oldFragment = sanitizedOld;
      newFragment = stripViewLineNumberPrefixes(newString);
      firstMatch = content.indexOf(oldFragment);
    }
  }

  if (firstMatch === -1) {
    return {
      error: "oldString not found in file",
      filePath: path,
    };
  }

  const occurrences = content.split(oldFragment).length - 1;
  const replacements = input.replaceAll
    ? occurrences
    : 1;
  const updated = input.replaceAll
    ? content.replaceAll(oldFragment, newFragment)
    : content.replace(oldFragment, newFragment);

  await container.fs.writeFile(path, updated);

  return {
    filePath: path,
    replacements,
  };
}

function stripViewLineNumberPrefixes(fragment: string) {
  return fragment
    .split("\n")
    .map((line) => line.replace(/^\s*\d+:\s?/, ""))
    .join("\n");
}