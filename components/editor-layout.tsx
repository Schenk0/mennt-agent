"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { DebugPanel } from "@/components/debug-terminal/debug-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import type { BootState } from "@/lib/webcontainer";
import type { WebContainer } from "@webcontainer/api";
import {
  Group,
  Panel,
  Separator,
} from "react-resizable-panels";

export function EditorLayout({
  webcontainer,
  previewUrl,
  bootState,
}: {
  webcontainer: WebContainer | null;
  previewUrl: string | null;
  bootState: BootState;
}) {

  return (
    <Group orientation="horizontal" className="h-screen">
      {/* Left: Preview + bottom panel stacked vertically */}
      <Panel defaultSize={75} minSize={30}>
        <Group orientation="vertical" className="h-full">
          <Panel defaultSize={65} minSize={20}>
            <PreviewPanel url={previewUrl} bootState={bootState} />
          </Panel>

          <Separator className="h-1.5 bg-border hover:bg-primary/30 transition-colors" />

          <Panel defaultSize={35} minSize={10}>
            <DebugPanel webcontainer={webcontainer} />
          </Panel>
        </Group>
      </Panel>

      <Separator className="w-1.5 bg-border hover:bg-primary/30 transition-colors" />

      {/* Right: Chat */}
      <Panel defaultSize={25} minSize={25}>
        <ChatPanel webcontainer={webcontainer} />
      </Panel>
    </Group>
  );
}