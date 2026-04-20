import { WebContainer } from "@webcontainer/api";

export type DirectoryTreeEntry = {
  name: string;
  type: "file" | "dir";
  children?: DirectoryTreeEntry[];
};

export const NOISY_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".next",
  ".cache",
  "dist",
]);

function renderDirectoryLines(
  children: DirectoryTreeEntry[],
  depth = 0
): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  for (const child of children) {
    const isDirectory = child.type === "dir";
    const displayName = isDirectory ? `${child.name}/` : child.name;
    lines.push(`${indent}- ${displayName} (${child.type})`);

    if (isDirectory && child.children?.length) {
      lines.push(...renderDirectoryLines(child.children, depth + 1));
    }
  }

  return lines;
}

function shouldSkipDirectory(
  directoryName: string,
  explicitPathSegments: Set<string>
) {
  if (!NOISY_DIRECTORY_NAMES.has(directoryName)) {
    return false;
  }
  return !explicitPathSegments.has(directoryName);
}

export async function readDirectoryTree(
  container: WebContainer,
  path: string,
  explicitPathSegments: Set<string>
): Promise<DirectoryTreeEntry[]> {
  const entries = await container.fs.readdir(path, { withFileTypes: true });
  const nodes: DirectoryTreeEntry[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name, explicitPathSegments)) {
        continue;
      }

      const childPath = path === "." ? entry.name : `${path}/${entry.name}`;
      const children = await readDirectoryTree(
        container,
        childPath,
        explicitPathSegments
      );
      nodes.push({ name: entry.name, type: "dir", children });
      continue;
    }

    nodes.push({ name: entry.name, type: "file" });
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export function renderDirectory(children: DirectoryTreeEntry[]) {
  if (!children.length) {
    return "Directory:\n(empty)";
  }
  return `Directory:\n${renderDirectoryLines(children).join("\n")}`;
}

export function normalizeRelativePath(path: string) {
  const normalized = path.replaceAll("\\", "/").trim();
  if (!normalized || normalized === ".") return ".";
  if (normalized.startsWith("/")) {
    throw new Error(`Path "${path}" must be relative to project root.`);
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "..")) {
    throw new Error(`Path "${path}" cannot include "..".`);
  }

  return parts.join("/");
}

export function ensureFilePath(path: string) {
  if (path === ".") {
    throw new Error("Path must point to a file, not the project root.");
  }
  return path;
}