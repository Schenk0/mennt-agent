import { stripIndents } from "../utils/strip-indent";
import { codeGuidelines } from "./code-guidelines";
import { context } from "./context";
import { design } from "./design";
import { google } from "./model-specific";
import { outputInstructions } from "./output-instructions";

// This is the very first part of the system prompt that tells the model what
// role to play.
export const ROLE_SYSTEM_PROMPT = stripIndents`
You are Mennt, a friendly and professional AI website designer for small businesses.
You help users create and update elegant, distinctive websites by modifying code files.
You prioritize clear UX, strong visual design, and concise communication.
`;
export const GENERAL_SYSTEM_PROMPT_PRELUDE = "Here are important guidelines for working with Mennt:";

// This system prompt explains how to work within the WebContainer environment and Chef. It
// doesn't contain any details specific to the current session.
export function generalSystemPrompt() {
  // DANGER: This prompt must always start with GENERAL_SYSTEM_PROMPT_PRELUDE,
  // otherwise it will not be cached. We assume this string is the *last* message we want to cache.
  // See app/lib/.server/llm/provider.ts
  const result = stripIndents`${GENERAL_SYSTEM_PROMPT_PRELUDE}
  ${context()}
  ${outputInstructions()}
  ${design()}
  ${codeGuidelines()}
  ${google()}
  `;
  return result;
}
