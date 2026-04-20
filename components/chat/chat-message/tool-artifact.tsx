"use client";

import type { AskQuestionOutput, AskQuestionType } from "@/agent/tools/ask-question";
import { FileIcon } from "@phosphor-icons/react";
import { UIDataTypes, UIMessagePart, UITools } from "ai";
import type { ReactNode } from "react";
import {
    AskQuestionTool,
} from "./question-artifact";

function getToolNameFromPartType(type: string) {
  return type.startsWith("tool-") ? type.slice("tool-".length) : undefined;
}

function getToolStatusText(toolName?: string, input?: unknown, hasOutput?: boolean) {
  const toolInput = input as Record<string, unknown> | undefined;
  const path =
    typeof toolInput?.path === "string"
      ? toolInput.path
      : typeof toolInput?.filePath === "string"
        ? toolInput.filePath
        : typeof toolInput?.dirPath === "string"
          ? toolInput.dirPath
          : undefined;
  const command =
    typeof toolInput?.command === "string" ? toolInput.command : undefined;
  const pattern =
    typeof toolInput?.pattern === "string" ? toolInput.pattern : undefined;

  if (!hasOutput) {
    switch (toolName) {
      case "writeFile":
        return `Writing ${path ?? "file"}...`;
      case "edit":
      case "editFile":
        return `Editing ${path ?? "file"}...`;
      case "view":
      case "readFile":
        return `Reading ${path ?? "path"}...`;
      case "listFiles":
        return `Listing ${path ?? "directory"}...`;
      case "grep":
        return `Searching ${pattern ?? "pattern"}...`;
      case "deleteFile":
        return `Deleting ${path ?? "path"}...`;
      case "runBash":
        return `Running ${command ?? "command"}...`;
      default:
        return `Running ${toolName ?? "tool"}...`;
    }
  }

  switch (toolName) {
    case "writeFile":
      return `Updated ${path ?? "file"}`;
    case "edit":
    case "editFile":
      return `Edited ${path ?? "file"}`;
    case "view":
    case "readFile":
      return `Read ${path ?? "path"}`;
    case "listFiles":
      return `Listed ${path ?? "directory"}`;
    case "grep":
      return `Searched ${pattern ?? "pattern"}`;
    case "deleteFile":
      return `Deleted ${path ?? "path"}`;
    case "runBash":
      return `Ran ${command ?? "command"}`;
    default:
      return `${toolName ?? "Tool"} completed`;
  }
}

function getAskQuestionStatusText(state: string, output?: unknown, errorText?: string) {
  if (state === "output-available") {
    const askOutput = parseAskQuestionOutput(output);
    return askOutput ? `Answered: ${askOutput.answer}` : "Question answered";
  }
  if (state === "output-error") {
    return errorText ?? "Failed to capture answer";
  }
  if (state === "input-available") {
    return "Question ready";
  }
  return "Preparing question...";
}


type AskQuestionInput = {
  question: string;
  questionType: AskQuestionType;
  options: string[];
  placeholder?: string;
};

function parseAskQuestionInput(input: unknown): AskQuestionInput | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const questionType =
    record.questionType === "single_select" ||
    record.questionType === "multi_select" ||
    record.questionType === "free_text"
      ? record.questionType
      : "single_select";
  const rawOptions = Array.isArray(record.options) ? record.options : [];
  const options = rawOptions
    .filter((option): option is string => typeof option === "string")
    .map((option) => option.trim())
    .filter(Boolean);
  const placeholder =
    typeof record.placeholder === "string" ? record.placeholder : undefined;

  const needsOptions =
    questionType === "single_select" || questionType === "multi_select";
  if (!question || (needsOptions && options.length < 2)) return null;

  return { question, questionType, options, placeholder };
}

function parseAskQuestionOutput(output: unknown): AskQuestionOutput | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const answer = typeof record.answer === "string" ? record.answer.trim() : "";
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const questionType =
    record.questionType === "single_select" ||
    record.questionType === "multi_select" ||
    record.questionType === "free_text"
      ? record.questionType
      : "single_select";
  const selectedOption =
    typeof record.selectedOption === "string" ? record.selectedOption : null;
  const selectedOptions = Array.isArray(record.selectedOptions)
    ? record.selectedOptions.filter((option): option is string => typeof option === "string")
    : [];
  const freeText = typeof record.freeText === "string" ? record.freeText : "";
  const usedCustom = typeof record.usedCustom === "boolean" ? record.usedCustom : false;
  const options = Array.isArray(record.options)
    ? record.options.filter((option): option is string => typeof option === "string")
    : [];

  if (!question || !answer) return null;
  return {
    question,
    questionType,
    answer,
    selectedOption,
    selectedOptions,
    freeText,
    usedCustom,
    options,
  };
}

function stringifyDebugValue(value: unknown) {
  if (typeof value === "undefined") return "Not available";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DebugBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-foreground">{label}</p>
      <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border/70 bg-muted/40 p-2 text-[11px] leading-relaxed text-foreground">
        {stringifyDebugValue(value)}
      </pre>
    </div>
  );
}

function ToolDebugDetails({
  summaryText,
  isError,
  toolName,
  toolCallId,
  state,
  input,
  output,
  errorText,
  children,
}: {
  summaryText: string;
  isError: boolean;
  toolName?: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  children?: ReactNode;
}) {
  const outputLabel = state === "output-error" ? "Error" : "Output";
  const outputValue =
    state === "output-error" ? (errorText ?? "Unknown tool error") : output;

  return (
    <details className="max-w-full">
      <summary className="cursor-pointer">
        <div
          className={`inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <FileIcon size={14} />
          <span className="truncate">{summaryText}</span>
        </div>
      </summary>
      <div className="space-y-2 overflow-x-auto rounded-md border border-dashed border-border/70 p-2">
        {children}
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{toolName ?? "tool"}</span>
          {" / "}
          <span>{state}</span>
          {" / "}
          <span className="font-mono">{toolCallId}</span>
        </div>
        <DebugBlock label="Input" value={input} />
        <DebugBlock label={outputLabel} value={outputValue} />
      </div>
    </details>
  );
}

export function ToolArtifact({ part, onAskQuestionSubmit, showToolDebug }: { part: UIMessagePart<UIDataTypes, UITools>; onAskQuestionSubmit: (toolCallId: string, output: AskQuestionOutput) => Promise<void>; showToolDebug: boolean }) {
  const toolPart = part as UIMessagePart<UIDataTypes, UITools> & {
    type: `tool-${string}`;
    state: string;
    toolCallId: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
  const toolName = getToolNameFromPartType(part.type);
  const hasOutput =
    toolPart.state === "output-available" || toolPart.state === "output-error";
  const toolInput = toolPart.input;
  const toolOutput = toolPart.output;
  const toolErrorText = toolPart.errorText;
  let content: ReactNode = null;

  if (toolName === "askQuestion") {
    if (toolPart.state === "output-available") {
      const askOutput = parseAskQuestionOutput(toolOutput);
      content = (
        <div className="rounded-md bg-background/50 px-2 py-1.5 text-xs text-muted-foreground">
          {askOutput ? (
            <span>
              Answered: <span className="text-foreground">{askOutput.answer}</span>
            </span>
          ) : (
            <span>Question answered</span>
          )}
        </div>
      );
    }

    if (!content && toolPart.state === "output-error") {
      content = (
        <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {toolErrorText ?? "Failed to capture answer"}
        </div>
      );
    }

    if (!content && toolPart.state !== "input-available") {
      content = (
        <div className="rounded-md bg-background/50 px-2 py-1 text-xs text-muted-foreground">
          Preparing question...
        </div>
      );
    }

    if (!content) {
      const askInput = parseAskQuestionInput(toolInput);
      if (!askInput) {
        content = (
          <div className="rounded-md bg-background/50 px-2 py-1 text-xs text-muted-foreground">
            Invalid askQuestion input
          </div>
        );
      } else {
        content = (
          <AskQuestionTool
            question={askInput.question}
            questionType={askInput.questionType}
            options={askInput.options}
            placeholder={askInput.placeholder}
            toolCallId={toolPart.toolCallId}
            onSubmit={onAskQuestionSubmit}
          />
        );
      }
    }
  } else {
    content = (
      <div className="flex w-fit items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        <FileIcon size={14} />
        <span>{getToolStatusText(toolName, toolInput, hasOutput)}</span>
      </div>
    );
  }

  if (!content) return null;

  const summaryText =
    toolName === "askQuestion"
      ? getAskQuestionStatusText(toolPart.state, toolOutput, toolErrorText)
      : getToolStatusText(toolName, toolInput, hasOutput);
  const isError = toolPart.state === "output-error";

  if (showToolDebug) {
    return (
      <ToolDebugDetails
        summaryText={summaryText}
        isError={isError}
        toolName={toolName}
        toolCallId={toolPart.toolCallId}
        state={toolPart.state}
        input={toolInput}
        output={toolOutput}
        errorText={toolErrorText}
      >
        {toolName === "askQuestion" ? content : null}
      </ToolDebugDetails>
    );
  }

  return <div>{content}</div>;
}