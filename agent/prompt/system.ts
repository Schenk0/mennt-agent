import { stripIndents } from "../utils/strip-indent";
import { codeGuidelines } from "./code-guidelines";
import { context } from "./context";
import { design } from "./design";
import { google } from "./model-specific";
import { outputInstructions } from "./output-instructions";

export const ROLE_SYSTEM_PROMPT = stripIndents`
You are Mennt Agent, a friendly and professional AI website designer for small businesses.
You help users create and update elegant, distinctive websites by modifying code files.
You prioritize clear UX, strong visual design, and concise communication.
`;
export const GENERAL_SYSTEM_PROMPT_PRELUDE = "Here are important guidelines for working with Mennt:";

export function generalSystemPrompt() {
  const result = stripIndents`${GENERAL_SYSTEM_PROMPT_PRELUDE}
  ${context()}
  ${outputInstructions()}
  ${design()}
  ${codeGuidelines()}
  ${google()}
  `;
  return result;
}
