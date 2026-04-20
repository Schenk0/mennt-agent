"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import type { FileUIPart } from "ai";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

export type QueuedMessage = {
  id: string;
  text: string;
  files: FileUIPart[];
};

type ChatQueueProps = {
  queuedMessages: QueuedMessage[];
  isRunning: boolean;
  setQueuedMessages: Dispatch<SetStateAction<QueuedMessage[]>>;
  cancelRun: () => void;
  sendPreparedMessage: (text: string, files: FileUIPart[]) => void;
};

export function ChatQueue({
  queuedMessages,
  isRunning,
  setQueuedMessages,
  cancelRun,
  sendPreparedMessage,
}: ChatQueueProps) {
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingQueueText, setEditingQueueText] = useState("");
  const [pendingForcedMessage, setPendingForcedMessage] = useState<QueuedMessage | null>(null);

  const startEditingQueuedMessage = (message: QueuedMessage) => {
    setEditingQueueId(message.id);
    setEditingQueueText(message.text);
  };

  const cancelEditingQueuedMessage = () => {
    setEditingQueueId(null);
    setEditingQueueText("");
  };

  const saveQueuedMessageEdit = (message: QueuedMessage) => {
    const trimmed = editingQueueText.trim();
    if (!trimmed && message.files.length === 0) {
      return;
    }

    setQueuedMessages((prev) =>
      prev.map((queued) =>
        queued.id === message.id
          ? {
              ...queued,
              text: trimmed,
            }
          : queued
      )
    );
    cancelEditingQueuedMessage();
  };

  const deleteQueuedMessage = (messageId: string) => {
    setQueuedMessages((prev) => prev.filter((message) => message.id !== messageId));
    if (editingQueueId === messageId) {
      cancelEditingQueuedMessage();
    }
  };

  const forceSendQueuedMessage = (messageId: string) => {
    if (pendingForcedMessage) {
      return;
    }

    const selectedMessage = queuedMessages.find((message) => message.id === messageId);

    if (!selectedMessage) {
      return;
    }

    setQueuedMessages((prev) => prev.filter((message) => message.id !== messageId));

    if (editingQueueId === selectedMessage.id) {
      cancelEditingQueuedMessage();
    }

    if (isRunning) {
      setPendingForcedMessage(selectedMessage);
      cancelRun();
      return;
    }

    sendPreparedMessage(selectedMessage.text, selectedMessage.files);
  };

  useEffect(() => {
    if (isRunning) {
      return;
    }

    if (pendingForcedMessage) {
      sendPreparedMessage(pendingForcedMessage.text, pendingForcedMessage.files);
      setPendingForcedMessage(null);
      return;
    }

    const nextQueuedMessage = queuedMessages[0];
    if (!nextQueuedMessage) {
      return;
    }

    sendPreparedMessage(nextQueuedMessage.text, nextQueuedMessage.files);
    setQueuedMessages((prev) => prev.slice(1));
  }, [isRunning, pendingForcedMessage, queuedMessages, sendPreparedMessage]);

  if (queuedMessages.length === 0 && !Boolean(pendingForcedMessage)) {
    return null;
  }

  return (
    <div className="mb-2 space-y-2 rounded-md border border-border bg-muted/40 p-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">
          Queued messages ({queuedMessages.length})
        </p>
        {Boolean(pendingForcedMessage) && (
          <p className="text-[11px] text-primary">
            Force sending after current run stops...
          </p>
        )}
      </div>

      {queuedMessages.map((message) => {
        const isEditing = editingQueueId === message.id;
        const canSaveEdit =
          editingQueueText.trim().length > 0 || message.files.length > 0;

        return (
          <div
            key={message.id}
            className="rounded-md border border-border/70 bg-background p-2"
          >
            {isEditing ? (
              <div className="space-y-2">
                <InputGroup className="h-auto">
                  <InputGroupTextarea
                    value={editingQueueText}
                    onChange={(e) => setEditingQueueText(e.target.value)}
                    rows={2}
                    className="min-h-10 max-h-32 resize-y text-xs"
                  />
                  <InputGroupAddon align="block-end" className="justify-end gap-1.5">
                    <InputGroupButton
                      type="button"
                      onClick={cancelEditingQueuedMessage}
                      className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                    >
                      Cancel
                    </InputGroupButton>
                    <InputGroupButton
                      type="button"
                      onClick={() => saveQueuedMessageEdit(message)}
                      disabled={!canSaveEdit}
                      className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/15 disabled:opacity-50"
                    >
                      Save
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="line-clamp-3 whitespace-pre-wrap text-xs text-foreground">
                  {message.text || "(Image-only message)"}
                </p>
                {message.files.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {message.files.length} image
                    {message.files.length === 1 ? "" : "s"}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEditingQueuedMessage(message)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQueuedMessage(message.id)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => forceSendQueuedMessage(message.id)}
                    disabled={Boolean(pendingForcedMessage)}
                    className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary disabled:opacity-50"
                  >
                    Force send
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
