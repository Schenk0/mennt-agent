import { RefObject, useEffect, useRef } from "react";

export function useScrollToBottom<T extends HTMLElement>(): [
  RefObject<T | null>,
  RefObject<T | null>,
] {
  const containerRef = useRef<T | null>(null);
  const endRef = useRef<T | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;

    if (!container || !end) return;

    const scrollToEnd = () => {
      end.scrollIntoView({ behavior: "instant", block: "end" });
    };

    requestAnimationFrame(scrollToEnd);

    const observer = new MutationObserver((mutations) => {
      const hasContentChange = mutations.some((mutation) => {
        const target = mutation.target;
        const element =
          target.nodeType === Node.TEXT_NODE
            ? (target.parentElement as Element)
            : (target as Element);

        if (element?.closest?.("button")) return false;
        if (element?.closest?.("svg") || element?.nodeName === "svg")
          return false;

        if (mutation.type === "childList") return true;
        if (mutation.type === "characterData") return true;

        return false;
      });

      if (hasContentChange) {
        scrollToEnd();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return [containerRef, endRef];
}
