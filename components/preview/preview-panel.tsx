"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BootState } from "@/lib/webcontainer";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useCallback, useRef } from "react";

const STATUS_LABELS: Record<BootState, string> = {
  idle: "Waiting to start...",
  booting: "Starting environment...",
  mounting: "Setting up project files...",
  installing: "Installing dependencies (this may take a minute)...",
  starting: "Starting dev server...",
  ready: "",
  error: "Something went wrong.",
};

export function PreviewPanel({
  url,
  bootState,
}: {
  url: string | null;
  bootState: BootState;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isLoading = bootState !== "ready" && bootState !== "error";
  const statusText = STATUS_LABELS[bootState];

  const reload = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.src = iframe.src;
    }
  }, []);

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Browser-like top bar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-border" />
          <span className="size-3 rounded-full bg-border" />
          <span className="size-3 rounded-full bg-border" />
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={reload}
          disabled={bootState !== "ready"}
          title="Reload preview"
        >
          <ArrowClockwiseIcon size={14} />
        </Button>

        <div className="flex-1 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground truncate">
          {url ?? "about:blank"}
        </div>
      </div>

      {/* Preview area */}
      <div className="relative flex-1">
        {url && bootState === "ready" ? (
          <iframe
            ref={iframeRef}
            src={url}
            className="h-full w-full border-0 bg-white"
            title="Website preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              {isLoading && (
                <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              <p
                className={cn(
                  "text-sm",
                  bootState === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {statusText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
