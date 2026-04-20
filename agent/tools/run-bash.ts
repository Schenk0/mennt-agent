import { tool } from "ai";
import { z } from "zod";
import { getDisallowedDiscoveryCommandReason } from "../utils/cmd-helper";
import { processTerminalOutputText, truncateOutput } from "../utils/terminal-output";
import { ensureContainer } from "../utils/webcontainer";
import type { ToolExecutionContext } from "./types";

// ── Tool Definition ────────────────────────────────────────────────────

export const runBashToolInput = z.object({
  command: z
    .string()
    .min(1)
    .describe(
      "Bash command to run from the project root, for example: pnpm run typecheck"
    ),
});

export const runBashDescription = `
Run a bash command from the project root and return its output.

Use this for verification tasks like type checks after file changes.
Do not run build/dev/start/preview/serve/watch commands.
Do not use this for recursive file listing across the whole project.
Do not use piped shell discovery commands with ls/dir/tree and grep/findstr.
Use the view tool to inspect directories instead.
`;

export const runBashTool = tool({
  description: runBashDescription,
  inputSchema: runBashToolInput,
});

// ── Tool Implementation ────────────────────────────────────────────────

export async function executeRunBashTool(
  context: ToolExecutionContext,
  rawInput: unknown
) {
  const input = runBashToolInput.parse(rawInput);
  const disallowedReason = getDisallowedDiscoveryCommandReason(input.command);

  if (disallowedReason) {
    throw new Error(disallowedReason);
  }

  const runResult = await runCommand(context, input.command);
  const cleanedOutput = processTerminalOutputText([runResult.output]);
  const runOutput = truncateOutput(
    cleanedOutput.trim() || "(no output)",
    MAX_RUN_BASH_OUTPUT_LENGTH
  );

  if (runResult.cancelled) {
    throw new Error(
      `Command was cancelled by user.\nCommand: ${input.command}\nOutput:\n${runOutput}`
    );
  }

  if (runResult.timedOut) {
    return `Command timed out and was stopped.\nCommand: ${input.command}\nOutput:\n${runOutput}`;
  }

  if (runResult.exitCode !== 0) {
    throw new Error(
      `Command failed with exit code ${runResult.exitCode}.\nCommand: ${input.command}\nOutput:\n${runOutput}`
    );
  }

  return `Command finished successfully.\nCommand: ${input.command}\nOutput:\n${runOutput}`;
}

const MAX_RUN_BASH_OUTPUT_LENGTH = 12000;
const MAX_RUN_BASH_CAPTURE_CHARS = 60_000;
const RUN_BASH_TIMEOUT_MS = 60_000;
const RUN_BASH_KILL_GRACE_MS = 5_000;
const RUN_BASH_OUTPUT_DRAIN_MS = 250;

async function runCommand(
  context: ToolExecutionContext,
  command: string
) {
  const container = ensureContainer(context.webcontainer);
  context.options.onTerminalLog?.(`\n$ ${command}\n`);
  const process = await container.spawn("sh", ["-lc", command]);
  const chunks: string[] = [];
  let capturedLength = 0;
  let outputCaptureTruncated = false;
  let timedOut = false;
  let cancelled = false;
  let abortListener: (() => void) | undefined;
  let killGraceTimer: ReturnType<typeof setTimeout> | undefined;
  let resolveKillGraceElapsed: (() => void) | undefined;
  const killGraceElapsed = new Promise<void>((resolve) => {
    resolveKillGraceElapsed = resolve;
  });
  let killRequested = false;

  const scheduleKillGraceElapsed = () => {
    if (killRequested) {
      return;
    }
    killRequested = true;
    killGraceTimer = setTimeout(() => {
      resolveKillGraceElapsed?.();
    }, RUN_BASH_KILL_GRACE_MS);
  };

  const killProcess = () => {
    scheduleKillGraceElapsed();
    try {
      process.kill();
    } catch {
      // Process may already be closed.
    }
  };

  if (context.options.signal?.aborted) {
    cancelled = true;
    context.options.onTerminalLog?.("\ncancelled by user.\n");
    killProcess();
  } else if (context.options.signal) {
    abortListener = () => {
      cancelled = true;
      context.options.onTerminalLog?.("\ncancelled by user.\n");
      killProcess();
    };
    context.options.signal.addEventListener("abort", abortListener, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    context.options.onTerminalLog?.(
      `\ntimed out after ${Math.round(RUN_BASH_TIMEOUT_MS / 1000)}s. Stopping command.\n`
    );
    killProcess();
  }, RUN_BASH_TIMEOUT_MS);

  const outputPromise = process.output
    .pipeTo(
      new WritableStream({
        write(data: string) {
          context.options.onTerminalLog?.(data);

          if (capturedLength >= MAX_RUN_BASH_CAPTURE_CHARS) {
            outputCaptureTruncated = true;
            return;
          }

          const remaining = MAX_RUN_BASH_CAPTURE_CHARS - capturedLength;
          const capturedChunk =
            data.length > remaining ? data.slice(0, remaining) : data;

          chunks.push(capturedChunk);
          capturedLength += capturedChunk.length;

          if (capturedChunk.length < data.length) {
            outputCaptureTruncated = true;
          }
        },
      })
    )
    .catch(() => {
      // Ignore stream closure errors when command is killed.
    });

  const exitResult = await Promise.race([
    process.exit.then((exitCode) => ({ kind: "exit" as const, exitCode })),
    killGraceElapsed.then(() => ({ kind: "stalled-after-kill" as const })),
  ]);

  const outputSuffix = outputCaptureTruncated
    ? "\n[output truncated while command was running]\n"
    : "";

  clearTimeout(timeoutId);
  if (killGraceTimer) {
    clearTimeout(killGraceTimer);
  }
  if (context.options.signal && abortListener) {
    context.options.signal.removeEventListener("abort", abortListener);
  }

  if (exitResult.kind === "stalled-after-kill") {
    timedOut = timedOut || !cancelled;
    context.options.onTerminalLog?.(
      "\nprocess did not exit after kill within grace period. Returning partial output.\n"
    );

    await Promise.race([
      outputPromise,
      new Promise<void>((resolve) => {
        setTimeout(resolve, RUN_BASH_OUTPUT_DRAIN_MS);
      }),
    ]);

    return {
      exitCode: -1,
      output: chunks.join("") + outputSuffix,
      timedOut,
      cancelled,
    };
  }

  await outputPromise;
  context.options.onTerminalLog?.(`\nexit code: ${exitResult.exitCode}\n`);

  return {
    exitCode: exitResult.exitCode,
    output: chunks.join("") + outputSuffix,
    timedOut,
    cancelled,
  };
}