"use client";

import { useAgent } from "@/lib/use-agent";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import type { WebContainer } from "@webcontainer/api";
import { useState } from "react";
import { ChatInput } from "./chat-input";
import { ChatMessage, Loading } from "./chat-message";

export function ChatPanel({
  webcontainer,
}: {
  webcontainer: WebContainer | null;
}) {
  const [showToolDebug, setShowToolDebug] = useState(false);
  const [containerRef, endRef] = useScrollToBottom<HTMLDivElement>();
  const {
    messages,
    isStreaming,
    isRunning,
    handleAskQuestionOutput,
    sendPreparedMessage,
    cancelRun,
  } = useAgent(webcontainer);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-medium">Chat</h2>
        <button
          type="button"
          onClick={() => setShowToolDebug((prev) => !prev)}
          aria-pressed={showToolDebug}
          className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium transition-colors ${
            showToolDebug
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          Debug {showToolDebug ? "on" : "off"}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-foreground mb-1">
                Welcome to Mennt
              </p>
              <p className="text-sm text-muted-foreground max-w-[280px]">
                Describe the website you want, or ask me to make changes to the
                current one.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onAskQuestionSubmit={handleAskQuestionOutput}
              showToolDebug={showToolDebug}
            />
          ))}

          {isStreaming && messages.at(-1)?.role !== "assistant" && (
            <Loading />
          )}

          <div ref={endRef} />
        </div>
      </div>

      <ChatInput
        isRunning={isRunning}
        cancelRun={cancelRun}
        sendPreparedMessage={sendPreparedMessage}
      />
    </div>
  );
}
