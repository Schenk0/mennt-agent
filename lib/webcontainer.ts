import { WebContainer, type FileSystemTree } from "@webcontainer/api";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export type BootState =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error";

export async function getWebContainer() {
  if (webcontainerInstance) return webcontainerInstance;

  if (bootPromise) return bootPromise;

  bootPromise = WebContainer.boot().then((instance) => {
    webcontainerInstance = instance;
    return instance;
  });

  return bootPromise;
}

export async function mountFiles(
  container: WebContainer,
  files: FileSystemTree
) {
  await container.mount(files);
}

export async function installDependencies(
  container: WebContainer,
  onOutput?: (data: string) => void
) {
  const process = await container.spawn("npm", ["install"]);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput?.(data);
      },
    })
  );

  const exitCode = await process.exit;

  if (exitCode !== 0) {
    throw new Error(`npm install failed with exit code ${exitCode}`);
  }
}

export async function startDevServer(
  container: WebContainer,
  onOutput?: (data: string) => void
) {
  const process = await container.spawn("npm", ["run", "dev"]);

  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput?.(data);
      },
    })
  );

  return new Promise<string>((resolve) => {
    container.on("server-ready", (_port, url) => {
      resolve(url);
    });
  });
}

export async function writeFile(
  container: WebContainer,
  path: string,
  content: string
) {
  const parts = path.split("/");
  if (parts.length > 1) {
    const dir = parts.slice(0, -1).join("/");
    await container.fs.mkdir(dir, { recursive: true });
  }
  await container.fs.writeFile(path, content);
}

export type FileTreeNode = {
  name: string;
  path: string;
} & (
  | { type: "file" }
  | { type: "directory"; children: FileTreeNode[] }
);

const IGNORED_DIRS = new Set(["node_modules", ".next", ".cache", "dist"]);

export async function readDirectoryTree(
  container: WebContainer,
  dirPath = "."
): Promise<FileTreeNode[]> {
  const entries = await container.fs.readdir(dirPath, {
    withFileTypes: true,
  });

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath =
      dirPath === "." ? entry.name : `${dirPath}/${entry.name}`;

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const children = await readDirectoryTree(container, fullPath);
      nodes.push({ type: "directory", name: entry.name, path: fullPath, children });
    } else {
      nodes.push({ type: "file", name: entry.name, path: fullPath });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function readFileContent(
  container: WebContainer,
  path: string
) {
  return container.fs.readFile(path, "utf-8");
}
