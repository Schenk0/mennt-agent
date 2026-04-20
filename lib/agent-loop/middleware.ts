import { executeToolCall } from "@/agent/tools";
import type { AgentToolMiddleware, AgentToolRunner } from "./runner";
import type { AgentToolLifecycleHooks } from "./types";

const DEFAULT_TOOL_TIMEOUT_MS = 65_000;
const MAX_TOOL_EXECUTION_RETRIES = 1;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    /429|500|502|503|504|529/.test(msg) ||
    msg.includes("rate limit") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("overloaded")
  );
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

export function createRuntimeToolRunner(): AgentToolRunner {
  return async ({ webcontainer, toolCall, signal, runtime }) => {
    if (signal.aborted) {
      return { type: "skipped", reason: "aborted" };
    }

    const timeoutMs =
      typeof runtime.timeoutMs === "number" && runtime.timeoutMs > 0
        ? runtime.timeoutMs
        : DEFAULT_TOOL_TIMEOUT_MS;

    for (let attempt = 0; attempt <= MAX_TOOL_EXECUTION_RETRIES; attempt++) {
      const executionPromise = executeToolCall(webcontainer, toolCall, {
        onTerminalLog: runtime.onTerminalLog,
        signal,
        getRuntimeDiagnostics: runtime.getRuntimeDiagnostics,
      })
        .then((output) => ({ type: "completed" as const, output }))
        .catch((error) => ({ type: "failed" as const, error: toError(error) }));

      let abortListener: (() => void) | undefined;
      const abortPromise = new Promise<{ type: "skipped"; reason: string }>(
        (resolve) => {
          if (signal.aborted) {
            resolve({ type: "skipped", reason: "aborted" });
            return;
          }
          abortListener = () => {
            resolve({ type: "skipped", reason: "aborted" });
          };
          signal.addEventListener("abort", abortListener, { once: true });
        }
      );

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<{ type: "failed"; error: Error }>(
        (resolve) => {
          timeoutId = setTimeout(() => {
            resolve({
              type: "failed",
              error: new Error(
                `Tool "${toolCall.toolName}" timed out after ${Math.round(
                  timeoutMs / 1000
                )}s.`
              ),
            });
          }, timeoutMs);
        }
      );

      const result = await Promise.race([
        executionPromise,
        abortPromise,
        timeoutPromise,
      ]);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (abortListener) {
        signal.removeEventListener("abort", abortListener);
      }

      if (result.type === "completed") {
        return result;
      }

      if (result.type === "skipped") {
        return result;
      }

      if (signal.aborted) {
        return { type: "skipped", reason: "aborted" };
      }

      const canRetry = attempt < MAX_TOOL_EXECUTION_RETRIES && isRetryableError(result.error);
      if (canRetry) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      return result;
    }

    return {
      type: "failed",
      error: new Error(
        `Tool "${toolCall.toolName}" failed after retry attempts were exhausted.`
      ),
    };
  };
}

export function withToolFilter(
  shouldExecute: (toolName: string) => boolean
): AgentToolMiddleware {
  return (runner) => async (context) => {
    if (!shouldExecute(context.toolCall.toolName)) {
      return { type: "skipped", reason: "filtered" };
    }
    return runner(context);
  };
}

export function withToolLifecycleHooks(
  hooks: AgentToolLifecycleHooks
): AgentToolMiddleware {
  return (runner) => async (context) => {
    await hooks.onToolStart?.(context.toolCall);
    const result = await runner(context);

    if (result.type === "completed") {
      await hooks.onToolComplete?.(context.toolCall, result.output);
      return result;
    }

    if (result.type === "failed") {
      await hooks.onToolError?.(context.toolCall, result.error);
      return result;
    }

    await hooks.onToolSkipped?.(context.toolCall, result.reason);
    return result;
  };
}
