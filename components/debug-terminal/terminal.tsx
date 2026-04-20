"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  getTerminalLogs,
  subscribeTerminalLogs,
  type TerminalLogTarget,
} from "@/components/debug-terminal/terminal-logger";

/**
 * Minimal terminal emulator that handles cursor-to-column-1 (\x1b[1G),
 * clear-to-end-of-line (\x1b[0K), carriage return (\r), and newlines.
 * Strips color/style codes (\x1b[...m) since we don't render colors.
 */
function processTerminalOutput(chunks: string[]) {
  const raw = chunks.join("");
  const lines: string[] = [];
  let currentLine = "";
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "\x1b") {
      const seq = raw.slice(i).match(/^\x1b\[[\d;]*([a-zA-Z])/);
      if (seq) {
        const code = seq[1];
        if (code === "G") {
          currentLine = "";
        }
        // K (clear to end), m (color) -- skip
        i += seq[0].length;
        continue;
      }
      const osc = raw.slice(i).match(/^\x1b\].*?\x07/);
      if (osc) {
        i += osc[0].length;
        continue;
      }
      i++;
      continue;
    }

    if (raw[i] === "\r") {
      // Handle CRLF line endings without dropping the current line content.
      if (raw[i + 1] === "\n") {
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = "";
        i += 2;
        continue;
      }

      // Bare carriage return means "move cursor to line start".
      currentLine = "";
      i++;
      continue;
    }

    if (raw[i] === "\n") {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = "";
      i++;
      continue;
    }

    currentLine += raw[i];
    i++;
  }

  if (currentLine.trim()) lines.push(currentLine);
  return lines;
}

export function TerminalPanel({ target }: { target: TerminalLogTarget }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const logs = useSyncExternalStore(
    subscribeTerminalLogs,
    () => getTerminalLogs(target),
    () => getTerminalLogs(target)
  );
  const cleanedLines = useMemo(() => processTerminalOutput(logs), [logs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cleanedLines]);

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a] text-[#cccccc]">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-3 text-xs leading-5 font-mono">
          {cleanedLines.length === 0 ? (
            <span className="text-[#666]">Waiting for output...</span>
          ) : (
            cleanedLines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
