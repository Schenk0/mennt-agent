"use client";

import type { AskQuestionOutput, AskQuestionType } from "@/agent/tools/ask-question";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CheckIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { useState } from "react";

type AskQuestionToolProps = {
  question: string;
  questionType: AskQuestionType;
  options: string[];
  placeholder?: string;
  toolCallId: string;
  onSubmit: (toolCallId: string, output: AskQuestionOutput) => Promise<void>;
  disabled?: boolean;
};

function sanitizeOptions(options: string[]) {
  return options.map((option) => option.trim()).filter(Boolean);
}

export function AskQuestionTool({
  question,
  questionType,
  options,
  placeholder,
  toolCallId,
  onSubmit,
  disabled = false,
}: AskQuestionToolProps) {
  const [editableOptions, setEditableOptions] = useState(() => sanitizeOptions(options));
  const [selectedSingle, setSelectedSingle] = useState<number | "custom" | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<number[]>([]);
  const [customValue, setCustomValue] = useState("");
  const [freeTextValue, setFreeTextValue] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomSelected, setIsCustomSelected] = useState(false);

  const isInteractive = !disabled && !isSubmitting;

  const selectedSingleValue =
    typeof selectedSingle === "number" ? editableOptions[selectedSingle] : undefined;
  const selectedMultiValues = selectedMulti
    .map((index) => editableOptions[index])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const customAnswer = customValue.trim();

  const singleAnswer =
    selectedSingle === "custom" ? customAnswer : selectedSingleValue?.trim() ?? "";
  const multiAnswerValues = customAnswer
    ? [...selectedMultiValues, customAnswer]
    : selectedMultiValues;
  const multiAnswer = multiAnswerValues.join(", ");
  const freeTextAnswer = freeTextValue.trim();

  const answer =
    questionType === "single_select"
      ? singleAnswer
      : questionType === "multi_select"
        ? multiAnswer
        : freeTextAnswer;

  const canSubmit =
    questionType === "single_select"
      ? singleAnswer.length > 0 && isInteractive
      : questionType === "multi_select"
        ? multiAnswerValues.length > 0 && isInteractive
        : freeTextAnswer.length > 0 && isInteractive;

  const startEditing = (index: number) => {
    if (!isInteractive) return;
    setEditingIndex(index);
    setEditingValue(editableOptions[index] ?? "");
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const nextValue = editingValue.trim();
    if (!nextValue) return;

    setEditableOptions((prev) =>
      prev.map((option, index) => (index === editingIndex ? nextValue : option))
    );
    setEditingIndex(null);
    setEditingValue("");
  };

  const toggleMultiSelection = (index: number) => {
    setSelectedMulti((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  const submitAnswer = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(toolCallId, {
        question,
        questionType,
        answer,
        selectedOption:
          questionType === "single_select" && selectedSingle !== "custom"
            ? singleAnswer
            : null,
        selectedOptions:
          questionType === "multi_select"
            ? multiAnswerValues
            : questionType === "single_select" && selectedSingle !== "custom" && singleAnswer
              ? [singleAnswer]
              : [],
        freeText:
          questionType === "free_text"
            ? freeTextAnswer
            : questionType === "single_select" && selectedSingle === "custom"
              ? customAnswer
              : questionType === "multi_select" && customAnswer
                ? customAnswer
              : "",
        usedCustom:
          questionType === "single_select"
            ? selectedSingle === "custom" && customAnswer.length > 0
            : questionType === "multi_select"
              ? customAnswer.length > 0
              : false,
        options: editableOptions,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-sm font-medium text-foreground">{question}</p>

      {(questionType === "single_select" || questionType === "multi_select") && (
        <div className="mt-2 space-y-2">
          {editableOptions.map((option, index) => {
            const isEditing = editingIndex === index;
            const isSelected =
              questionType === "single_select"
                ? selectedSingle === index
                : selectedMulti.includes(index);

            return (
              <div
                key={`${option}-${index}`}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5",
                  isSelected
                    ? "border-primary/50 bg-primary/10"
                    : "border-border bg-background/60"
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 text-left",
                    !isInteractive && "cursor-default"
                  )}
                  onClick={() => {
                    if (!isInteractive || isEditing) return;
                    if (questionType === "single_select") {
                      setSelectedSingle(index);
                      return;
                    }
                    toggleMultiSelection(index);
                  }}
                  disabled={!isInteractive}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center border",
                      questionType === "single_select" ? "rounded-full" : "rounded-sm",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/50"
                    )}
                  >
                    {isSelected && questionType === "multi_select" ? <CheckIcon size={10} /> : null}
                  </span>
                  {isEditing ? (
                    <Input
                      value={editingValue}
                      onChange={(event) => setEditingValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveEdit();
                        }
                      }}
                      className="h-7 text-xs"
                      autoFocus
                      disabled={!isInteractive}
                    />
                  ) : (
                    <span className="truncate text-xs text-foreground">{option}</span>
                  )}
                </button>

                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    if (isEditing) {
                      saveEdit();
                      return;
                    }
                    startEditing(index);
                  }}
                  disabled={!isInteractive}
                  aria-label={isEditing ? "Save option" : "Edit option"}
                >
                  {isEditing ? <CheckIcon size={14} /> : <PencilSimpleIcon size={14} />}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {(questionType === "single_select" || questionType === "multi_select") && (
        <div className="mt-3 rounded-md border border-border bg-background/60 p-2">
          <div
            className={cn(
              "flex w-full items-center gap-2 text-left text-xs",
              !isInteractive && "cursor-default"
            )}
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center border",
                questionType === "single_select" ? "rounded-full" : "rounded-sm",
                questionType === "single_select"
                  ? selectedSingle === "custom"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/50"
                  : (customAnswer.length > 0 || isCustomSelected)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/50"
              )}
            >
              {questionType === "multi_select" && (customAnswer.length > 0 || isCustomSelected) ? (
                <CheckIcon size={10} />
              ) : null}
            </span>
            <span className="font-medium text-foreground">Custom</span>
          </div>

          <Textarea
            value={customValue}
            onClick={() => {
              if (!isInteractive) return;
              setIsCustomSelected(true);
              if (questionType !== "single_select") return;
              setSelectedSingle("custom");
            }}
            onBlur={() => {
              setIsCustomSelected(false);
            }}
            onChange={(event) => {
              const value = event.target.value;
              setCustomValue(value);
              if (questionType !== "single_select") return;
              if (value.trim().length > 0) {
                setSelectedSingle("custom");
              } else if (selectedSingle === "custom") {
                setSelectedSingle(null);
              }
            }}
            placeholder={placeholder ?? "Enter your own answer..."}
            className="mt-2 min-h-16 text-xs"
            disabled={!isInteractive}
          />
        </div>
      )}

      {questionType === "free_text" && (
        <Textarea
          value={freeTextValue}
          onChange={(event) => setFreeTextValue(event.target.value)}
          placeholder={placeholder ?? "Type your answer..."}
          className="min-h-20 text-xs mt-2"
          disabled={!isInteractive}
        />
      )}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={submitAnswer}
          disabled={!canSubmit}
        >
          {isSubmitting ? "Submitting..." : "Submit answer"}
        </Button>
      </div>
    </div>
  );
}
