"use client";

import { AiRunStateProvider } from "@/lib/agent-run-state";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <AiRunStateProvider>{children}</AiRunStateProvider>;
}
