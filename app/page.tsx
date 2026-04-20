"use client";

import { useState, useEffect, useRef } from "react";
import type { WebContainer } from "@webcontainer/api";
import type { BootState } from "@/lib/webcontainer";
import {
  getWebContainer,
  mountFiles,
  installDependencies,
  startDevServer,
} from "@/lib/webcontainer";
import { EditorLayout } from "@/components/editor-layout";
import {
  clearTerminalLogs,
  createTerminalLogger,
} from "@/components/debug-terminal/terminal-logger";

const logToTerminal = createTerminalLogger("terminal");

export default function Page() {
  const [bootState, setBootState] = useState<BootState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [webcontainer, setWebcontainer] = useState<WebContainer | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    clearTerminalLogs();

    async function boot() {
      try {
        logToTerminal("Booting WebContainer...\n");
        setBootState("booting");
        const container = await getWebContainer();
        setWebcontainer(container);
        logToTerminal("WebContainer booted.\n");

        logToTerminal("Loading template...\n");
        const templateResponse = await fetch("/api/template");
        if (!templateResponse.ok) {
          throw new Error(`Failed to load template (${templateResponse.status}).`);
        }
        const template = (await templateResponse.json()) as Parameters<
          typeof mountFiles
        >[1];
        logToTerminal("Template loaded.\n");

        logToTerminal("Mounting project files...\n");
        setBootState("mounting");
        await mountFiles(container, template);
        logToTerminal("Files mounted.\n");

        logToTerminal("Running pnpm install...\n");
        setBootState("installing");
        await installDependencies(container, (data) => logToTerminal(data));
        logToTerminal("pnpm install complete.\n");

        logToTerminal("Starting dev server...\n");
        setBootState("starting");

        container.on("error", (err) => {
          logToTerminal(`Error: ${err.message}\n`);
        });

        const url = await startDevServer(container, (data) => logToTerminal(data));
        logToTerminal(`Dev server ready at: ${url}\n`);
        setPreviewUrl(url);
        setBootState("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logToTerminal(`Error: Boot failed: ${message}\n`);
        setBootState("error");
      }
    }

    boot();
  }, []);

  return (
    <EditorLayout
      webcontainer={webcontainer}
      previewUrl={previewUrl}
      bootState={bootState}
    />
  );
}
