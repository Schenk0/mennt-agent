# Mennt Agent

The open-source AI agent that powers [mennt.app](https://mennt.app) - a website builder for local businesses. Mennt Agent generates and edits complete Next.js websites through natural conversation, running entirely in the browser using WebContainers.

## What is this?

Mennt Agent is a chat-driven coding agent that creates and modifies websites in real-time, like Lovable. You describe what you want, and the agent writes the code, runs it in a sandboxed environment, and shows you a live preview.

The agent is specifically designed for **local business websites** (restaurants, salons, contractors, etc.) where SEO and fast load times matter most.

## Agentic Harness

The agent loop is built on the [Vercel AI SDK](https://ai-sdk.dev) with several layers of infrastructure:

- **Multi-step streaming** — Uses `streamText` with `stepCountIs(maxSteps)` (default 15 steps) to let the model call tools in a loop until it's done.
- **Client-side tool execution** — `AgentToolLoop` deduplicates calls, manages per-call abort controllers, and retries transient failures.
- **Runtime middleware** — `createRuntimeToolRunner` wraps each tool call with a 65-second timeout, automatic retry for rate limits and server errors, and abort signal propagation.
- **Chat runtime middleware** — `createChatRuntime` supports composable middleware (`ChatMiddleware`), hooks (`onBeforeRun` / `onAfterRun`), and message transforms for extending the pipeline.
- **`askQuestion` special handling** — This tool has no server-side executor. The UI renders the question, collects the user's answer, and injects the result via `addToolOutput` — avoiding deadlocks in the SDK's serial tool executor.
- **Run state tracking** — `useTrackedAiRunState` syncs streaming status, pending tool parts, and active tools for the UI to show spinners, cancel buttons, and progress indicators.
- **Cancellation** — Aborting a run cancels all in-flight tool calls and marks pending UI parts as cancelled.

## Agent Capabilities

The agent has 10 tools at its disposal:

| Tool | Description |
|------|-------------|
| `writeFile` | Create or overwrite a file |
| `editFile` | Search-and-replace edits within a file |
| `view` / `readFile` | Read file contents |
| `listFiles` | List directory contents |
| `grep` | Regex search across the file tree using ripgrep |
| `deleteFile` | Remove a file |
| `runBash` | Execute shell commands in the container |
| `getRuntimeDiagnostics` | Fetch recent terminal/preview logs to diagnose errors |
| `askQuestion` | Ask the user a clarifying question (pauses the loop) |

## Why Next.js Static Export?

Mennt builds websites for local businesses like restaurants, salons, contractors, and shops. For these businesses, SEO is everything. The template project uses Next.js with `output: "export"` to generate fully static HTML:

- **100% static output** — Every page is pre-rendered HTML. No server required for hosting.
- **SEO-first** — Search engines get complete HTML with all content, not a loading spinner.
- **Deploy anywhere** — Static files can be hosted on any CDN, S3 bucket, or static host. No Node.js server needed.
- **Fast load times** — No client-side rendering delay. Content is visible immediately.

The template ships with Tailwind v3, ESLint (with `jsx-a11y` for accessibility), and TypeScript. We had to use v3 because the model kept messing up the style configs for v4. 

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/)
- A Google AI API key (for Gemini)

### Installation

```bash
git clone https://github.com/mennt-app/mennt-agent.git
cd mennt-agent
pnpm install
```

### Environment Variables

Create a `.env.local` file:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app will boot a WebContainer, install the template's dependencies, and start the dev server — then you can start chatting with the agent.

## Project Structure

- `app/` contains all of the client side code and some serverless APIs.
- `components/` defines the UI components
- `lib/` contains the utility functions and types.
- `agent/` handles the agentic loop by injecting system prompts, defining tools.
- `template/` contains the template that we use to start all projects.

## Contributing

Contributions are welcome! Whether it's bug fixes, new tools, better prompts, or UI improvements, feel free to open an issue or submit a pull request.

## License

This project is licensed under the [MIT License](LICENSE).
