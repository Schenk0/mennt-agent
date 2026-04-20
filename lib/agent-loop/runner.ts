import type { AgentToolRunContext, AgentToolRunResult } from "./types";

export type AgentToolRunner = (
  context: AgentToolRunContext
) => Promise<AgentToolRunResult>;

export type AgentToolMiddleware = (
  runner: AgentToolRunner
) => AgentToolRunner;

export function pipeAgentToolMiddleware(
  ...middleware: AgentToolMiddleware[]
): AgentToolMiddleware {
  return middleware.reduceRight(
    (inner, outer) => (runner) => outer(inner(runner)),
    (runner: AgentToolRunner) => runner
  );
}

export function applyAgentToolMiddleware(
  runner: AgentToolRunner,
  ...middleware: AgentToolMiddleware[]
) {
  return pipeAgentToolMiddleware(...middleware)(runner);
}
