"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  PaperPlaneRightIcon,
  PaperclipIcon,
  StopIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { FileUIPart } from "ai";
import Image from "next/image";
import { useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { ChatQueue, type QueuedMessage } from "./chat-queue";

type ChatInputProps = {
  isRunning: boolean;
  cancelRun: () => void;
  sendPreparedMessage: (text: string, files: FileUIPart[]) => void;
};

export function ChatInput({
  isRunning,
  cancelRun,
  sendPreparedMessage,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [images, setImages] = useState<FileUIPart[]>([]);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileInput = () => {
    fileInputRef.current?.click();
  };

  const addImages = (files: File[]) => {
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            type: "file",
            mediaType: file.type,
            filename: file.name,
            url: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImages(Array.from(e.target.files));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles: File[] = [];

    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      addImages(imageFiles);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && images.length === 0) {
      return;
    }

    const nextFiles = [...images];

    if (isRunning) {
      setQueuedMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: trimmed,
          files: nextFiles,
        },
      ]);
    } else {
      sendPreparedMessage(trimmed, nextFiles);
    }

    setInput("");
    setImages([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-border p-3">
      <ChatQueue
        queuedMessages={queuedMessages}
        isRunning={isRunning}
        setQueuedMessages={setQueuedMessages}
        cancelRun={cancelRun}
        sendPreparedMessage={sendPreparedMessage}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <InputGroup className="h-auto">
        {images.length > 0 && (
          <InputGroupAddon align="block-start">
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="group relative">
                  <Image
                    src={img.url}
                    alt={img.filename ?? "Upload"}
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 rounded-md border border-border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 cursor-pointer flex h-4 w-4 items-center justify-center rounded-sm bg-accent text-accent-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <XIcon size={10} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          </InputGroupAddon>
        )}

        <InputGroupTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Describe what you want..."
          className="min-h-10 max-h-32"
          rows={1}
        />

        <InputGroupAddon
          align="block-end"
          className="flex-row items-center justify-between"
        >
          <InputGroupButton
            size="icon-xs"
            onClick={openFileInput}
            disabled={isRunning}
          >
            <PaperclipIcon size={14} />
          </InputGroupButton>

          {isRunning && !input.trim() && images.length === 0 ? (
            <InputGroupButton
              type="button"
              size="icon-xs"
              onClick={cancelRun}
              aria-label={"Stop run"}
            >
              <div className="flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground">
                <StopIcon size={12} />
              </div>
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type={"submit"}
              size="icon-xs"
              disabled={!input.trim() && images.length === 0}
              aria-label={"Send message"}
            >
              <PaperPlaneRightIcon size={14} />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
