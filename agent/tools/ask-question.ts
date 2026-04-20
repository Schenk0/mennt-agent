import { tool } from "ai";
import { z } from "zod";

export type AskQuestionType = "single_select" | "multi_select" | "free_text";

export type AskQuestionOutput = {
  question: string;
  questionType: AskQuestionType;
  answer: string;
  selectedOption: string | null;
  selectedOptions: string[];
  freeText: string;
  usedCustom: boolean;
  options: string[];
};

// ── Tool Definition ────────────────────────────────────────────────────

export const askQuestionToolInput = z
  .object({
    question: z
      .string()
      .min(1)
      .describe("Question to show the user in the chat UI."),
    questionType: z
      .enum(["single_select", "multi_select", "free_text"])
      .optional()
      .default("single_select")
      .describe("Question type: single_select, multi_select, or free_text."),
    options: z
      .array(z.string().min(1))
      .max(8)
      .optional()
      .default([])
      .describe(
        "Predefined options for select question types. A custom text field is always available in the UI."
      ),
    placeholder: z
      .string()
      .optional()
      .describe("Optional placeholder text for free text input."),
  })
  .superRefine((value, ctx) => {
    const needsOptions =
      value.questionType === "single_select" ||
      value.questionType === "multi_select";

    if (needsOptions && value.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Select question types require at least 2 options.",
      });
    }
  });

export const askQuestionDescription =
  "Ask the user a focused question in the chat UI. Supports single_select, multi_select, and free_text with editable options.";

export const askQuestionTool = tool({
  description: askQuestionDescription,
  inputSchema: askQuestionToolInput,
});