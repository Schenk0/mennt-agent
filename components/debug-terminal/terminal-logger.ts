export type TerminalLogTarget = "terminal" | "agent-terminal";

type TerminalLogsState = Record<TerminalLogTarget, string>;
type TerminalLogsSnapshot = Record<TerminalLogTarget, string[]>;

let state: TerminalLogsState = {
  terminal: "",
  "agent-terminal": "",
};
let snapshots: TerminalLogsSnapshot = {
  terminal: [],
  "agent-terminal": [],
};

const listeners = new Set<() => void>();
const MAX_TERMINAL_LOG_CHARS = 200_000;
const NOTIFY_DEBOUNCE_MS = 16;
let notifyTimeout: ReturnType<typeof setTimeout> | null = null;

function notifyListeners() {
  if (notifyTimeout) {
    return;
  }

  notifyTimeout = setTimeout(() => {
    notifyTimeout = null;
    for (const listener of listeners) {
      listener();
    }
  }, NOTIFY_DEBOUNCE_MS);
}

function appendLogChunk(current: string, incoming: string) {
  if (!incoming) {
    return current;
  }

  const combined = current + incoming;
  if (combined.length <= MAX_TERMINAL_LOG_CHARS) {
    return combined;
  }

  return combined.slice(combined.length - MAX_TERMINAL_LOG_CHARS);
}

export function subscribeTerminalLogs(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTerminalLogs(target: TerminalLogTarget) {
  return snapshots[target];
}

export function logToTerminal(
  text: string,
  target: TerminalLogTarget = "terminal"
) {
  const nextContent = appendLogChunk(state[target], text);
  if (nextContent === state[target]) {
    return;
  }

  state = {
    ...state,
    [target]: nextContent,
  };
  snapshots = {
    ...snapshots,
    [target]: nextContent ? [nextContent] : [],
  };
  notifyListeners();
}

export function createTerminalLogger(target: TerminalLogTarget) {
  return (text: string) => {
    logToTerminal(text, target);
  };
}

export function clearTerminalLogs(target?: TerminalLogTarget) {
  if (target) {
    if (!state[target]) {
      return;
    }

    state = {
      ...state,
      [target]: "",
    };
    snapshots = {
      ...snapshots,
      [target]: [],
    };
  } else {
    if (!state.terminal && !state["agent-terminal"]) {
      return;
    }

    state = {
      terminal: "",
      "agent-terminal": "",
    };
    snapshots = {
      terminal: [],
      "agent-terminal": [],
    };
  }

  if (notifyTimeout) {
    clearTimeout(notifyTimeout);
    notifyTimeout = null;
  }

  for (const listener of listeners) {
    listener();
  }
}
