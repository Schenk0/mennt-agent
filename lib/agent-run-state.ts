"use client";

import { isToolUIPart, type UIMessage } from "ai";
import {
  createElement,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

export type AiChatStatus = "submitted" | "streaming" | "ready" | "error";

export type AiRunPhase =
  | "idle"
  | "streaming"
  | "running-tools"
  | "awaiting-tool-output";

export type AiRunStateSnapshot = {
  isStreaming: boolean;
  runSequence: number;
  lastRunStartedAt: number | null;
  isAwaitingToolOutput: boolean;
  hasActiveToolCalls: boolean;
  activeToolCallCount: number;
  pendingToolCallCount: number;
  activeToolCallIds: string[];
  pendingToolCallIds: string[];
  isRunning: boolean;
  phase: AiRunPhase;
};

type AiRunStateContextValue = AiRunStateSnapshot & {
  setStreamingState: (isStreaming: boolean) => void;
  setPendingToolCallIds: (toolCallIds: Iterable<string>) => void;
  markToolCallRunning: (toolCallId: string) => void;
  markToolCallFinished: (toolCallId: string) => void;
  clearActiveToolCalls: () => void;
  reset: () => void;
};

type AiRunStateInternal = {
  isStreaming: boolean;
  runSequence: number;
  lastRunStartedAt: number | null;
  activeToolCallIds: Set<string>;
  pendingToolCallIds: Set<string>;
};

type AiRunStateAction =
  | { type: "set-streaming"; isStreaming: boolean }
  | { type: "set-pending-tool-calls"; toolCallIds: Iterable<string> }
  | { type: "mark-tool-call-running"; toolCallId: string }
  | { type: "mark-tool-call-finished"; toolCallId: string }
  | { type: "clear-active-tool-calls" }
  | { type: "reset" };

const initialState: AiRunStateInternal = {
  isStreaming: false,
  runSequence: 0,
  lastRunStartedAt: null,
  activeToolCallIds: new Set(),
  pendingToolCallIds: new Set(),
};

const AiRunStateContext = createContext<AiRunStateContextValue | null>(null);

function normalizeToolCallIds(toolCallIds: Iterable<string>) {
  const ids = new Set<string>();
  for (const toolCallId of toolCallIds) {
    if (toolCallId) {
      ids.add(toolCallId);
    }
  }
  return ids;
}

function areSetsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function reduceAiRunState(state: AiRunStateInternal, action: AiRunStateAction) {
  switch (action.type) {
    case "set-streaming": {
      if (state.isStreaming === action.isStreaming) {
        return state;
      }
      const isStartingNewRun = action.isStreaming && !state.isStreaming;
      return {
        ...state,
        isStreaming: action.isStreaming,
        runSequence: isStartingNewRun ? state.runSequence + 1 : state.runSequence,
        lastRunStartedAt: isStartingNewRun ? Date.now() : state.lastRunStartedAt,
      };
    }
    case "set-pending-tool-calls": {
      const nextPendingIds = normalizeToolCallIds(action.toolCallIds);
      if (areSetsEqual(state.pendingToolCallIds, nextPendingIds)) {
        return state;
      }
      return {
        ...state,
        pendingToolCallIds: nextPendingIds,
      };
    }
    case "mark-tool-call-running": {
      if (!action.toolCallId || state.activeToolCallIds.has(action.toolCallId)) {
        return state;
      }
      const nextActiveIds = new Set(state.activeToolCallIds);
      nextActiveIds.add(action.toolCallId);
      return {
        ...state,
        activeToolCallIds: nextActiveIds,
      };
    }
    case "mark-tool-call-finished": {
      if (!action.toolCallId || !state.activeToolCallIds.has(action.toolCallId)) {
        return state;
      }
      const nextActiveIds = new Set(state.activeToolCallIds);
      nextActiveIds.delete(action.toolCallId);
      return {
        ...state,
        activeToolCallIds: nextActiveIds,
      };
    }
    case "clear-active-tool-calls": {
      if (state.activeToolCallIds.size === 0) {
        return state;
      }
      return {
        ...state,
        activeToolCallIds: new Set<string>(),
      };
    }
    case "reset": {
      if (
        !state.isStreaming &&
        state.runSequence === 0 &&
        state.lastRunStartedAt === null &&
        state.activeToolCallIds.size === 0 &&
        state.pendingToolCallIds.size === 0
      ) {
        return state;
      }
      return initialState;
    }
    default:
      return state;
  }
}

function toSnapshot(state: AiRunStateInternal): AiRunStateSnapshot {
  const activeToolCallIds = Array.from(state.activeToolCallIds).sort();
  const pendingToolCallIds = Array.from(state.pendingToolCallIds).sort();
  const hasActiveToolCalls = activeToolCallIds.length > 0;
  const isAwaitingToolOutput = pendingToolCallIds.length > 0;
  const phase: AiRunPhase = hasActiveToolCalls
    ? "running-tools"
    : state.isStreaming
      ? "streaming"
      : isAwaitingToolOutput
        ? "awaiting-tool-output"
        : "idle";

  return {
    isStreaming: state.isStreaming,
    runSequence: state.runSequence,
    lastRunStartedAt: state.lastRunStartedAt,
    isAwaitingToolOutput,
    hasActiveToolCalls,
    activeToolCallCount: activeToolCallIds.length,
    pendingToolCallCount: pendingToolCallIds.length,
    activeToolCallIds,
    pendingToolCallIds,
    isRunning: phase !== "idle",
    phase,
  };
}

export function AiRunStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduceAiRunState, initialState);
  const snapshot = useMemo(() => toSnapshot(state), [state]);

  const setStreamingState = useCallback((isStreaming: boolean) => {
    dispatch({ type: "set-streaming", isStreaming });
  }, []);

  const setPendingToolCallIds = useCallback((toolCallIds: Iterable<string>) => {
    dispatch({ type: "set-pending-tool-calls", toolCallIds });
  }, []);

  const markToolCallRunning = useCallback((toolCallId: string) => {
    dispatch({ type: "mark-tool-call-running", toolCallId });
  }, []);

  const markToolCallFinished = useCallback((toolCallId: string) => {
    dispatch({ type: "mark-tool-call-finished", toolCallId });
  }, []);

  const clearActiveToolCalls = useCallback(() => {
    dispatch({ type: "clear-active-tool-calls" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  const value = useMemo(
    () => ({
      ...snapshot,
      setStreamingState,
      setPendingToolCallIds,
      markToolCallRunning,
      markToolCallFinished,
      clearActiveToolCalls,
      reset,
    }),
    [
      snapshot,
      setStreamingState,
      setPendingToolCallIds,
      markToolCallRunning,
      markToolCallFinished,
      clearActiveToolCalls,
      reset,
    ]
  );

  return createElement(AiRunStateContext.Provider, { value }, children);
}

export function useAiRunState() {
  const context = useContext(AiRunStateContext);
  if (!context) {
    throw new Error("useAiRunState must be used within AiRunStateProvider.");
  }
  return context;
}

export function collectPendingToolCallIds(messages: UIMessage[]) {
  const pendingIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const part of message.parts) {
      if (!isToolUIPart(part) || part.providerExecuted) {
        continue;
      }

      if (part.state !== "input-available" && part.state !== "input-streaming") {
        continue;
      }

      pendingIds.add(part.toolCallId);
    }
  }

  return Array.from(pendingIds).sort();
}

export function useTrackedAiRunState(messages: UIMessage[], status: AiChatStatus) {
  const runState = useAiRunState();
  const isStreaming = status === "streaming" || status === "submitted";
  const pendingToolCallIds = useMemo(
    () => collectPendingToolCallIds(messages),
    [messages]
  );

  useEffect(() => {
    runState.setStreamingState(isStreaming);
  }, [isStreaming, runState]);

  useEffect(() => {
    runState.setPendingToolCallIds(pendingToolCallIds);
  }, [pendingToolCallIds, runState]);

  const hasActiveToolCalls = runState.activeToolCallCount > 0;
  const isAwaitingToolOutput = pendingToolCallIds.length > 0;
  const phase: AiRunPhase = hasActiveToolCalls
    ? "running-tools"
    : isStreaming
      ? "streaming"
      : isAwaitingToolOutput
        ? "awaiting-tool-output"
        : "idle";

  return {
    ...runState,
    isStreaming,
    isAwaitingToolOutput,
    hasActiveToolCalls,
    pendingToolCallIds,
    pendingToolCallCount: pendingToolCallIds.length,
    isRunning: phase !== "idle",
    phase,
  };
}

type AddToolOutputPayload = {
  toolCallId: string;
};

export function useTrackedAddToolOutput<T extends AddToolOutputPayload>(
  addToolOutput: (payload: T) => Promise<void>
) {
  const { markToolCallFinished } = useAiRunState();

  return useCallback(
    async (payload: T) => {
      try {
        await addToolOutput(payload);
      } finally {
        markToolCallFinished(payload.toolCallId);
      }
    },
    [addToolOutput, markToolCallFinished]
  );
}
