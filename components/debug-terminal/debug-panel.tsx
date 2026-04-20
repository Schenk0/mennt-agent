"use client";

import { CodeViewerPanel } from "@/components/debug-terminal/code-viewer";
import { TerminalPanel } from "@/components/debug-terminal/terminal";
import { cn } from "@/lib/utils";
import { CodeIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import type { WebContainer } from "@webcontainer/api";
import { useState } from "react";

type BottomTab = "terminal" | "agent-terminal" | "code";

export function DebugPanel({
  webcontainer,
}: {
  webcontainer: WebContainer | null;
}) {
  const [bottomTab, setBottomTab] = useState<BottomTab>("terminal");

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* Tab bar */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-[#333] px-2">
        <BottomTabButton
          active={bottomTab === "terminal"}
          onClick={() => setBottomTab("terminal")}
          icon={<TerminalWindowIcon size={13} />}
          label="Terminal"
        />
        <BottomTabButton
          active={bottomTab === "agent-terminal"}
          onClick={() => setBottomTab("agent-terminal")}
          icon={<TerminalWindowIcon size={13} />}
          label="Agent Terminal"
        />
        <BottomTabButton
          active={bottomTab === "code"}
          onClick={() => setBottomTab("code")}
          icon={<CodeIcon size={13} />}
          label="Code"
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <div className={cn("h-full", bottomTab !== "terminal" && "hidden")}>
          <TerminalPanel target="terminal" />
        </div>
        <div className={cn("h-full", bottomTab !== "agent-terminal" && "hidden")}>
          <TerminalPanel target="agent-terminal" />
        </div>
        <div className={cn("h-full", bottomTab !== "code" && "hidden")}>
          <CodeViewerPanel webcontainer={webcontainer} />
        </div>
      </div>
    </div>
  );
}

function BottomTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "text-white"
          : "text-[#888] hover:text-[#ccc]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
