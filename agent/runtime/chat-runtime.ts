import { generalSystemPrompt } from "@/agent/prompt";
import { chatTools } from "@/agent/tools";
import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

type ChatModelMessages = Awaited<ReturnType<typeof convertToModelMessages>>;
type ChatModel = ReturnType<typeof google>;
type IncomingMessages = Parameters<typeof convertToModelMessages>[0];

export type ChatRunResult = {
  toUIMessageStreamResponse: () => Response;
};

export type ChatRunContext = {
  messages: ChatModelMessages;
  signal?: AbortSignal;
  model: ChatModel;
  systemPrompt: string;
  tools: typeof chatTools;
  maxSteps: number;
  metadata: Record<string, unknown>;
};

export type ChatRunner = (
  context: ChatRunContext
) => ChatRunResult | Promise<ChatRunResult>;

export type ChatMiddleware = (runner: ChatRunner) => ChatRunner;

export type ChatRunHooks = {
  onBeforeRun?: (
    context: ChatRunContext
  ) => ChatRunContext | Promise<ChatRunContext>;
  onAfterRun?: (
    context: ChatRunContext,
    result: ChatRunResult
  ) => void | Promise<void>;
};

export type ChatRuntimeConfig = {
  model?: ChatModel;
  maxSteps?: number;
  middleware?: ChatMiddleware[];
  hooks?: ChatRunHooks;
};

type ChatTurnInput = {
  messages: IncomingMessages;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
};

function createBaseChatRunner(): ChatRunner {
  return (context) =>
    streamText({
      model: context.model,
      system: context.systemPrompt,
      messages: context.messages,
      tools: context.tools,
      stopWhen: stepCountIs(context.maxSteps),
      abortSignal: context.signal,
    });
}

export function pipeChatMiddleware(...middleware: ChatMiddleware[]): ChatMiddleware {
  return middleware.reduceRight(
    (inner, outer) => (runner) => outer(inner(runner)),
    (runner: ChatRunner) => runner
  );
}

export function applyChatMiddleware(
  runner: ChatRunner,
  ...middleware: ChatMiddleware[]
) {
  return pipeChatMiddleware(...middleware)(runner);
}

export function withChatRunHooks(hooks: ChatRunHooks): ChatMiddleware {
  return (runner) => async (context) => {
    const nextContext = hooks.onBeforeRun
      ? await hooks.onBeforeRun(context)
      : context;
    const result = await runner(nextContext);
    await hooks.onAfterRun?.(nextContext, result);
    return result;
  };
}

export function withMessageTransform(
  transform: (
    messages: ChatModelMessages,
    context: ChatRunContext
  ) => ChatModelMessages | Promise<ChatModelMessages>
): ChatMiddleware {
  return (runner) => async (context) => {
    const transformedMessages = await transform(context.messages, context);
    return runner({
      ...context,
      messages: transformedMessages,
    });
  };
}

export function createChatRuntime(config: ChatRuntimeConfig = {}) {
  const baseRunner = createBaseChatRunner();
  const middleware = [
    ...(config.hooks ? [withChatRunHooks(config.hooks)] : []),
    ...(config.middleware ?? []),
  ];
  const runner = applyChatMiddleware(baseRunner, ...middleware);

  return {
    async run(input: ChatTurnInput) {
      const context: ChatRunContext = {
        messages: await convertToModelMessages(input.messages),
        signal: input.signal,
        model: config.model ?? google("gemini-3-flash-preview"),
        systemPrompt: generalSystemPrompt(),
        tools: chatTools,
        maxSteps: config.maxSteps ?? 15,
        metadata: input.metadata ?? {},
      };
      return runner(context);
    },
  };
}

export async function runChatTurn(
  input: ChatTurnInput,
  config?: ChatRuntimeConfig
) {
  const runtime = createChatRuntime(config);
  return runtime.run(input);
}
