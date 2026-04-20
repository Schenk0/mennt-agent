function hasRecursiveLsFlag(command: string) {
  return (
    /\s--recursive(?:\s|$)/i.test(command) ||
    /\s-(?:[A-Za-z]*[Rr][A-Za-z]*)(?:\s|$)/.test(command)
  );
}

function isDisallowedLifecycleCommand(command: string) {
  const normalized = command.trim().replace(/\s+/g, " ");

  // Package-manager scripts that commonly start long-running dev servers
  // or expensive builds inside the WebContainer.
  if (
    /\b(?:npm|pnpm)\s+(?:run\s+)?(?:dev|build|start|preview|serve|watch)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  if (/\byarn\s+(?:dev|build|start|preview|serve|watch)\b/i.test(normalized)) {
    return true;
  }

  if (
    /\bbun\s+(?:run\s+)?(?:dev|build|start|preview|serve|watch)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  // Direct framework/dev-server commands.
  if (
    /\b(?:next|vite|nuxt|astro|svelte-kit)\s+(?:dev|build|start|preview)\b/i.test(
      normalized
    )
  ) {
    return true;
  }

  // Generic watch-mode commands that keep the tool call alive.
  if (/\b(?:tsc|webpack)\b[^\n]*\b--watch\b/i.test(normalized)) {
    return true;
  }

  return false;
}

export function getDisallowedDiscoveryCommandReason(command: string) {
  const trimmed = command.trim();

  const isLsLikeCommand = /^(ls|dir|tree)\b/i.test(trimmed);
  const hasPipe = /[|]/.test(trimmed);
  const hasGrepLike = /\b(grep|egrep|fgrep|findstr)\b/i.test(trimmed);

  if (isLsLikeCommand && hasPipe && hasGrepLike) {
    return "Use the view tool for directory/file discovery instead of piped ls/grep commands.";
  }

  if (/^ls\b/i.test(trimmed) && hasRecursiveLsFlag(trimmed)) {
    return "Use the view tool for recursive directory exploration instead of `ls -R`.";
  }

  if (isDisallowedLifecycleCommand(trimmed)) {
    return "Do not run build/dev/start/watch/preview commands. Use targeted checks like `pnpm run check`, `pnpm run typecheck`, or `pnpm run lint`.";
  }

  return null;
}
