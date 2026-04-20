import type { WebContainer } from "@webcontainer/api";

export const DEFAULT_MAX_OUTPUT_BYTES = 32 * 1024;
export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_LINE_LENGTH = 2000;

const SKIP_DIRS = new Set(["node_modules", ".git"]);

const UTF8_ENCODER = new TextEncoder();

const BINARY_EXTENSIONS = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".obj",
  ".o",
  ".a",
  ".lib",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".tiff",
  ".tif",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".wav",
  ".flac",
  ".ogg",
  ".webm",
  ".mkv",
  ".pdf",
  ".wasm",
  ".class",
  ".jar",
  ".pyc",
  ".pyd",
  ".pyo",
  ".whl",
  ".egg",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",
  ".sqlite",
  ".db",
]);

export function byteLengthUtf8(value: string) {
  return UTF8_ENCODER.encode(value).length;
}

export function isBinaryPath(filePath: string) {
  const lastDot = filePath.lastIndexOf(".");
  if (lastDot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(lastDot).toLowerCase());
}

export function truncateLine(line: string, maxLength = DEFAULT_MAX_LINE_LENGTH) {
  if (line.length <= maxLength) return line;
  return `${line.slice(0, maxLength)}... (line truncated at ${maxLength} chars)`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function joinPath(base: string, name: string) {
  if (base === ".") return name;
  if (base.endsWith("/")) return `${base}${name}`;
  return `${base}/${name}`;
}

export function relativePath(root: string, target: string) {
  const normalizedRoot = root.endsWith("/") ? root : `${root}/`;
  if (target.startsWith(normalizedRoot)) {
    return target.slice(normalizedRoot.length);
  }
  return target;
}

export async function walkDir(
  container: WebContainer,
  root: string,
  dir: string
) {
  const entries = await container.fs.readdir(dir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const results: Array<{ relativePath: string; isDirectory: boolean }> = [];

  for (const entry of sortedEntries) {
    const absolutePath = joinPath(dir, entry.name);
    const entryPath = relativePath(root, absolutePath);
    const isDirectory = entry.isDirectory();

    results.push({
      relativePath: entryPath,
      isDirectory,
    });

    if (isDirectory && !SKIP_DIRS.has(entry.name)) {
      results.push(...(await walkDir(container, root, absolutePath)));
    }
  }

  return results;
}

export async function walkFiles(container: WebContainer, dir: string): Promise<string[]> {
  const entries = await container.fs.readdir(dir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const fullPath = joinPath(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await walkFiles(container, fullPath)));
      }
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

export function takeItemsWithinByteLimit<T>(items: T[], maxBytes: number) {
  let totalBytes = 0;
  const limitedItems: T[] = [];

  for (const item of items) {
    const itemBytes = byteLengthUtf8(JSON.stringify(item));
    if (totalBytes + itemBytes > maxBytes) {
      return { items: limitedItems, truncatedByBytes: true };
    }
    totalBytes += itemBytes;
    limitedItems.push(item);
  }

  return { items: limitedItems, truncatedByBytes: false };
}

type ListDirectoryInput = {
  container: WebContainer;
  dirPath: string;
  recursive: boolean;
  offset?: number;
  limit?: number;
};

export async function listDirectoryEntries({
  container,
  dirPath,
  recursive,
  offset,
  limit,
}: ListDirectoryInput) {
  let items: { name: string; type: "file" | "directory" }[];

  if (recursive) {
    const walked = await walkDir(container, dirPath, dirPath);
    items = walked.map((entry) => ({
      name: entry.relativePath,
      type: entry.isDirectory ? "directory" : "file",
    }));
  } else {
    const entries = await container.fs.readdir(dirPath, { withFileTypes: true });
    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));
    items = sortedEntries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    }));
  }

  const totalCount = items.length;
  const start = (offset ?? 1) - 1;
  const entryLimit = limit ?? DEFAULT_MAX_LINES;

  if (start > 0 && start >= totalCount) {
    return {
      error: `Offset ${offset} is out of range (listing has ${totalCount} entries)`,
      dirPath,
    };
  }

  const end = Math.min(start + entryLimit, totalCount);
  const page = items.slice(start, end);
  const { items: entries, truncatedByBytes } = takeItemsWithinByteLimit(
    page,
    DEFAULT_MAX_OUTPUT_BYTES
  );
  const fromEntry = entries.length > 0 ? start + 1 : 0;
  const toEntry = start + entries.length;
  const hasMore = toEntry < totalCount;

  let status: string;
  if (totalCount === 0) {
    status = "Directory is empty.";
  } else if (truncatedByBytes) {
    status =
      `Output capped at ${formatBytes(DEFAULT_MAX_OUTPUT_BYTES)}. ` +
      `Showing entries ${fromEntry}-${toEntry} of ${totalCount}. ` +
      `Use offset=${toEntry + 1} to continue.`;
  } else if (hasMore) {
    status =
      `Showing entries ${fromEntry}-${toEntry} of ${totalCount}. ` +
      `Use offset=${toEntry + 1} to continue.`;
  } else {
    status = `End of listing - ${totalCount} entries total.`;
  }

  return {
    dirPath,
    count: entries.length,
    totalCount,
    fromEntry,
    toEntry,
    status,
    entries,
  };
}