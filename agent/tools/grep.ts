import { tool } from "ai";
import { z } from "zod";
import { normalizeRelativePath } from "../utils/directory-helper";
import {
  byteLengthUtf8,
  DEFAULT_MAX_LINE_LENGTH,
  DEFAULT_MAX_LINES,
  DEFAULT_MAX_OUTPUT_BYTES,
  formatBytes,
  isBinaryPath,
  relativePath,
  truncateLine,
  walkFiles,
} from "../utils/fs-shared";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const grepToolInput = z.object({
  pattern: z.string().describe("Regex pattern to search for"),
  dirPath: z
    .string()
    .optional()
    .default(".")
    .describe("Root directory to search from (defaults to project root)"),
  glob: z
    .string()
    .optional()
    .describe("Only search files ending with this suffix (example: .ts)"),
  respectIgnore: z
    .boolean()
    .optional()
    .default(true)
    .describe("Respect .gitignore/.ignore files (default true)"),
  contextLines: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("Number of surrounding context lines to include per match"),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based match number to start returning from"),
  limit: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(`Maximum number of matches to return (default ${DEFAULT_MAX_LINES})`),
});

export const grepDescription = `
Search file contents with a regex pattern.

Searches recursively from the given directory.
Skips node_modules and .git directories.
Returns matching lines with relative file paths and line numbers.
`;

export const grepTool = tool({
  description: grepDescription,
  inputSchema: grepToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeGrepTool(
  { webcontainer }: ToolExecutionContext,
  rawInput: unknown
) {
  const input = grepToolInput.parse(rawInput);
  const dirPath = normalizeRelativePath(input.dirPath);
  const container = ensureContainer(webcontainer);

  let foundMatches: GrepMatch[] = [];
  let engine: "ripgrep" | "regex-fallback" = "ripgrep";
  let fallbackReason: string | null = null;
  try {
    foundMatches = await searchWithRipgrep({
      container,
      pattern: input.pattern,
      dirPath,
      glob: input.glob,
      respectIgnore: input.respectIgnore,
      contextLines: input.contextLines,
    });
  } catch (error) {
    if (error instanceof RipgrepSearchError && !error.shouldFallback) {
      return {
        error: error.message,
        dirPath,
        pattern: input.pattern,
      };
    }
    try {
      foundMatches = await searchWithRegexFallback({
        container,
        pattern: input.pattern,
        dirPath,
        glob: input.glob,
        respectIgnore: input.respectIgnore,
      });
      engine = "regex-fallback";
      fallbackReason = error instanceof Error ? error.message : String(error);
    } catch (fallbackError) {
      return {
        error: `Unable to search "${dirPath}": ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`,
        dirPath,
        pattern: input.pattern,
      };
    }
  }

  foundMatches.sort((a, b) => compareMatchRelevance(a, b, input.pattern));

  const start = (input.offset ?? 1) - 1;
  const matchLimit = input.limit ?? DEFAULT_MAX_LINES;
  const matches: GrepMatch[] = [];
  let totalBytes = 0;
  let truncatedByBytes = false;
  const matchCount = foundMatches.length;

  for (let matchIndex = 0; matchIndex < foundMatches.length; matchIndex += 1) {
    const matchNumber = matchIndex + 1;
    if (matchNumber <= start || truncatedByBytes || matches.length >= matchLimit) {
      continue;
    }

    const match = foundMatches[matchIndex];
    const matchBytes = byteLengthUtf8(JSON.stringify(match));
    if (totalBytes + matchBytes > DEFAULT_MAX_OUTPUT_BYTES) {
      truncatedByBytes = true;
      continue;
    }

    totalBytes += matchBytes;
    matches.push(match);
  }

  if (start > 0 && start >= matchCount) {
    return {
      error: `Offset ${input.offset} is out of range (${matchCount} matches found)`,
      dirPath,
      pattern: input.pattern,
      matchCount,
    };
  }

  const fromMatch = matches.length > 0 ? start + 1 : 0;
  const toMatch = start + matches.length;
  const hasMore = toMatch < matchCount;
  let status: string;

  if (matchCount === 0) {
    status = `No matches found for /${input.pattern}/.`;
  } else if (truncatedByBytes) {
    status =
      `Output capped at ${formatBytes(DEFAULT_MAX_OUTPUT_BYTES)}. ` +
      `Showing matches ${fromMatch}-${toMatch} of ${matchCount}. ` +
      `Use offset=${toMatch + 1} to continue.`;
  } else if (hasMore) {
    status =
      `Showing matches ${fromMatch}-${toMatch} of ${matchCount}. ` +
      `Use offset=${toMatch + 1} to continue.`;
  } else {
    status = `End of matches - ${matchCount} total.`;
  }
  if (engine === "regex-fallback") {
    status += ` Using regex fallback engine due to ripgrep error: ${fallbackReason}.`;
  }

  return {
    dirPath,
    pattern: input.pattern,
    engine,
    matchCount,
    fromMatch,
    toMatch,
    status,
    matches,
  };
}

type GrepContextLine = {
  line: number;
  preview: string;
};

type GrepMatch = {
  path: string;
  line: number;
  column: number;
  preview: string;
  contextBefore: GrepContextLine[];
  contextAfter: GrepContextLine[];
};

type RipgrepJsonLine = {
  type: "begin" | "match" | "context" | "end" | "summary";
  data?: {
    path?: { text?: string };
    line_number?: number;
    lines?: { text?: string };
    submatches?: Array<{ start?: number }>;
  };
};

class RipgrepSearchError extends Error {
  constructor(
    message: string,
    readonly shouldFallback: boolean
  ) {
    super(message);
  }
}

async function searchWithRipgrep({
  container,
  pattern,
  dirPath,
  glob,
  respectIgnore,
  contextLines,
}: {
  container: Awaited<ReturnType<typeof ensureContainer>>;
  pattern: string;
  dirPath: string;
  glob?: string;
  respectIgnore: boolean;
  contextLines: number;
}): Promise<GrepMatch[]> {
  const args = [
    "--json",
    "--line-number",
    "--column",
    "--no-heading",
    "--color=never",
    "-e",
    pattern,
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/.git/**",
  ];
  if (!respectIgnore) {
    args.push("--no-ignore");
  }
  if (contextLines > 0) {
    args.push("--context", String(contextLines));
  }
  if (glob) {
    args.push("--glob", ensureGlobPattern(glob));
  }
  args.push(dirPath);

  const result = await runRipgrepInContainer(container, args);
  if (result.exitCode === 2) {
    const stderr = result.stderr || "ripgrep failed.";
    if (isRegexPatternError(stderr)) {
      throw new RipgrepSearchError(`Invalid regex pattern: ${stderr}`, false);
    }
    throw new RipgrepSearchError(stderr, true);
  }
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new RipgrepSearchError(result.stderr || "ripgrep failed.", true);
  }

  const matches: GrepMatch[] = [];
  const pendingContextBeforeByFile = new Map<string, GrepContextLine[]>();
  const activeMatchByFile = new Map<string, GrepMatch>();
  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    let parsed: RipgrepJsonLine;
    try {
      parsed = JSON.parse(line) as RipgrepJsonLine;
    } catch {
      continue;
    }

    if (parsed.type !== "match" && parsed.type !== "context") {
      continue;
    }

    const filePath = parsed.data?.path?.text;
    const lineNumber = parsed.data?.line_number;
    const lineText = parsed.data?.lines?.text;
    if (
      !filePath ||
      typeof lineNumber !== "number" ||
      typeof lineText !== "string" ||
      isBinaryPath(filePath)
    ) {
      continue;
    }

    const normalizedPath = relativePath(dirPath, filePath);
    const preview = truncateLine(lineText.replace(/\r?\n$/, ""), DEFAULT_MAX_LINE_LENGTH);

    if (parsed.type === "context") {
      const contextLine = {
        line: lineNumber,
        preview,
      };
      const activeMatch = activeMatchByFile.get(normalizedPath);
      if (activeMatch && lineNumber > activeMatch.line) {
        if (activeMatch.contextAfter.length < contextLines) {
          activeMatch.contextAfter.push(contextLine);
        }
      } else {
        const pendingContext = pendingContextBeforeByFile.get(normalizedPath) ?? [];
        pendingContext.push(contextLine);
        if (pendingContext.length > contextLines) {
          pendingContext.splice(0, pendingContext.length - contextLines);
        }
        pendingContextBeforeByFile.set(normalizedPath, pendingContext);
      }
      continue;
    }

    const columnStart = parsed.data?.submatches?.[0]?.start;
    const nextMatch: GrepMatch = {
      path: normalizedPath,
      line: lineNumber,
      column: typeof columnStart === "number" ? columnStart + 1 : 1,
      preview,
      contextBefore: [...(pendingContextBeforeByFile.get(normalizedPath) ?? [])],
      contextAfter: [],
    };
    pendingContextBeforeByFile.set(normalizedPath, []);
    activeMatchByFile.set(normalizedPath, nextMatch);
    matches.push(nextMatch);
  }

  return matches;
}

async function searchWithRegexFallback({
  container,
  pattern,
  dirPath,
  glob,
  respectIgnore,
}: {
  container: Awaited<ReturnType<typeof ensureContainer>>;
  pattern: string;
  dirPath: string;
  glob?: string;
  respectIgnore: boolean;
}): Promise<GrepMatch[]> {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (error) {
    throw new Error(
      `Invalid regex pattern for fallback engine: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const files = await walkFiles(container, dirPath);

  const matches: GrepMatch[] = [];
  for (const filePath of files) {
    if (isBinaryPath(filePath)) continue;
    if (respectIgnore && shouldSkipFallbackPath(filePath)) continue;
    if (glob && !filePath.endsWith(glob)) continue;

    let content: string;
    try {
      content = await container.fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const normalizedLine = lines[lineIndex].replace(/\r$/, "");
      regex.lastIndex = 0;
      if (!regex.test(normalizedLine)) continue;

      const normalizedPath = relativePath(dirPath, filePath);
      const preview = truncateLine(normalizedLine, DEFAULT_MAX_LINE_LENGTH);
      matches.push({
        path: normalizedPath,
        line: lineIndex + 1,
        column: 1,
        preview,
        contextBefore: [],
        contextAfter: [],
      });
    }
  }

  return matches;
}

function ensureGlobPattern(glob: string) {
  const trimmed = glob.trim();
  if (!trimmed) return "*";
  if (trimmed.includes("*")) return trimmed;
  return `*${trimmed}`;
}

function isRegexPatternError(stderr: string) {
  const normalized = stderr.toLowerCase();
  return (
    normalized.includes("regex parse error") ||
    normalized.includes("invalid regular expression") ||
    normalized.includes("unclosed") ||
    normalized.includes("repetition operator")
  );
}

function compareMatchRelevance(a: GrepMatch, b: GrepMatch, pattern: string) {
  const patternHint = shouldUsePatternHint(pattern) ? pattern.toLowerCase() : null;
  const aName = basename(a.path).toLowerCase();
  const bName = basename(b.path).toLowerCase();
  const aNameScore = patternHint && aName.includes(patternHint) ? 0 : 1;
  const bNameScore = patternHint && bName.includes(patternHint) ? 0 : 1;
  if (aNameScore !== bNameScore) {
    return aNameScore - bNameScore;
  }
  if (a.path.length !== b.path.length) {
    return a.path.length - b.path.length;
  }
  if (a.path !== b.path) {
    return a.path.localeCompare(b.path);
  }
  if (a.line !== b.line) {
    return a.line - b.line;
  }
  return a.column - b.column;
}

function basename(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function shouldUsePatternHint(pattern: string) {
  const trimmed = pattern.trim();
  return trimmed.length > 0 && trimmed.length < 20 && /^[\w-]+$/.test(trimmed);
}

function shouldSkipFallbackPath(filePath: string) {
  const segments = filePath.split("/");
  return segments.some((segment) => segment.startsWith("."));
}

async function runRipgrepInContainer(
  container: Awaited<ReturnType<typeof ensureContainer>>,
  args: string[]
) {
  const attempts: Array<{ command: string; args: string[] }> = [
    { command: "rg", args },
    { command: "node_modules/.bin/rg", args },
    { command: "npx", args: ["--no-install", "ripgrep", ...args] },
    { command: "npx", args: ["--yes", "ripgrep", ...args] },
  ];

  let lastError = "";
  for (const attempt of attempts) {
    let process:
      | Awaited<ReturnType<typeof container.spawn>>
      | undefined;
    try {
      process = await container.spawn(attempt.command, attempt.args);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      continue;
    }

    const chunks: string[] = [];
    await process.output.pipeTo(
      new WritableStream({
        write(data: string) {
          chunks.push(data);
        },
      })
    );
    const exitCode = await process.exit;
    const output = chunks.join("");
    const stderr = extractRipgrepStderr(output);

    if (exitCode === 127 || /command not found/i.test(stderr)) {
      lastError = stderr || `Command "${attempt.command}" not found.`;
      continue;
    }

    return {
      exitCode,
      stdout: output,
      stderr,
    };
  }

  throw new RipgrepSearchError(
    `ripgrep executable not available in WebContainer. Last error: ${
      lastError || "unknown error"
    }`,
    true
  );
}

function extractRipgrepStderr(output: string) {
  const parsedLines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const stderrLines: string[] = [];
  for (const line of parsedLines) {
    try {
      JSON.parse(line);
    } catch {
      stderrLines.push(line);
    }
  }
  return stderrLines.join("\n").trim();
}
