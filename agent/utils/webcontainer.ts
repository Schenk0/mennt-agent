import type { WebContainer } from "@webcontainer/api";

export function ensureContainer(webcontainer: WebContainer | null) {
  if (!webcontainer) {
    throw new Error("WebContainer is not ready yet. Try again in a moment.");
  }
  return webcontainer;
}
