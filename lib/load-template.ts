import type { FileSystemTree } from "@webcontainer/api";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const TEMPLATE_ROOT = path.join(process.cwd(), "template");

async function readTemplateDirectory(directoryPath: string): Promise<FileSystemTree> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const tree: FileSystemTree = {};

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      tree[entry.name] = {
        directory: await readTemplateDirectory(entryPath),
      };
      continue;
    }

    if (entry.isFile()) {
      tree[entry.name] = {
        file: {
          contents: await readFile(entryPath, "utf-8"),
        },
      };
    }
  }

  return tree;
}

export async function loadTemplateTree() {
  const templateRootStats = await stat(TEMPLATE_ROOT).catch(() => null);
  if (!templateRootStats?.isDirectory()) {
    throw new Error(`Template directory "${TEMPLATE_ROOT}" does not exist.`);
  }

  return readTemplateDirectory(TEMPLATE_ROOT);
}
