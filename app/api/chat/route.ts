import { createChatRuntime } from "@/agent/runtime";

const chatRuntime = createChatRuntime();

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await chatRuntime.run({
    messages,
    signal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}
