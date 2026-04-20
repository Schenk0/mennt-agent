"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  readDirectoryTree,
  readFileContent,
  type FileTreeNode,
} from "@/lib/webcontainer";
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  ClipboardTextIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";
import type { WebContainer } from "@webcontainer/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  mjs: "javascript",
  cjs: "javascript",
  svg: "xml",
  yml: "yaml",
  yaml: "yaml",
  sh: "bash",
  env: "dotenv",
};

function getLang(filename: string) {
  const ext = filename.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "text";
}

function FileTreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isDirectory = node.type === "directory";
  const isSelected = node.path === selectedPath;

  if (isDirectory) {
    return (
      <div>
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-[#2a2a2a]",
            "transition-colors"
          )}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          <CaretRightIcon
            size={10}
            className={cn(
              "shrink-0 text-[#888] transition-transform",
              expanded && "rotate-90"
            )}
          />
          {expanded ? (
            <FolderOpenIcon size={14} className="shrink-0 text-[#e8a86e]" />
          ) : (
            <FolderIcon size={14} className="shrink-0 text-[#e8a86e]" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs hover:bg-[#2a2a2a]",
        "transition-colors",
        isSelected && "bg-[#37373d]"
      )}
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
    >
      <span className="w-[10px] shrink-0" />
      <FileIcon
        size={14}
        className={cn(
          "shrink-0",
          isSelected ? "text-[#ccc]" : "text-[#888]"
        )}
      />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

function HighlightedCode({
  code,
  filename,
}: {
  code: string;
  filename: string;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: getLang(filename),
      theme: "github-dark-default",
    }).then((result) => {
      if (!cancelled) setHtml(result);
    }).catch(() => {
      if (!cancelled) setHtml(null);
    });

    return () => { cancelled = true; };
  }, [code, filename]);

  if (html === null) {
    return (
      <pre className="p-3 text-xs font-mono leading-5 whitespace-pre text-[#ccc]">
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className="shiki-wrapper text-xs leading-5 [&_pre]:bg-transparent! [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-xs! [&_code]:leading-5!"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function CodeViewerPanel({
  webcontainer,
}: {
  webcontainer: WebContainer | null;
}) {
  const [tree, setTree] = useState<FileTreeNode[] | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTree = useCallback(async () => {
    if (!webcontainer) return;
    setLoading(true);
    setError(null);
    try {
      const nodes = await readDirectoryTree(webcontainer);
      setTree(nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [webcontainer]);

  const hasLoaded = tree !== null;

  const handleSelect = useCallback(
    async (path: string) => {
      if (!webcontainer) return;
      setSelectedPath(path);
      setFileContent(null);
      setFileLoading(true);
      try {
        const content = await readFileContent(webcontainer, path);
        setFileContent(content);
      } catch (err) {
        setFileContent(`Error reading file: ${err}`);
      } finally {
        setFileLoading(false);
      }
    },
    [webcontainer]
  );

  const copyToClipboard = useCallback((content: string, filepath: string) => {
    const text = `${filepath}\n\`\`\`\n${content}\n\`\`\`\n`;
    navigator.clipboard.writeText(text);
  }, []);

  if (!hasLoaded) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1a1a]">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshTree}
          disabled={!webcontainer || loading}
          className="gap-2 border-[#333] bg-[#252525] text-[#ccc] hover:bg-[#333] hover:text-white"
        >
          {loading ? (
            <ArrowClockwiseIcon size={14} className="animate-spin" />
          ) : (
            <FolderOpenIcon size={14} />
          )}
          Load project files
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#1a1a1a] text-[#cccccc]">
      {/* File tree sidebar */}
      <div className="flex w-48 shrink-0 flex-col border-r border-[#333] overflow-hidden">
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#333] px-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-[#888]">
            Files
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={refreshTree}
            disabled={loading}
            className="text-[#888] hover:text-white hover:bg-[#333] h-5 w-5"
            title="Refresh file tree"
          >
            <ArrowClockwiseIcon
              size={11}
              className={cn(loading && "animate-spin")}
            />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {error && (
            <p className="px-3 py-2 text-xs text-red-400">{error}</p>
          )}
          {tree?.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>

      {/* Code content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedPath ? (
          <>
            <div className="flex h-7 shrink-0 items-center justify-between border-b border-[#333] px-3">
              <span className="truncate text-[11px] text-[#999]">
                {selectedPath}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => copyToClipboard(fileContent ?? "", selectedPath)}
                className="text-[#888] hover:text-white hover:bg-[#333] h-5 w-5"
                title="Close file"
              >
                <ClipboardTextIcon size={11} />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {fileLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <ArrowClockwiseIcon
                    size={16}
                    className="animate-spin text-[#666]"
                  />
                </div>
              ) : fileContent !== null ? (
                <HighlightedCode code={fileContent} filename={selectedPath} />
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-[#666]">
              Select a file to view its contents
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
