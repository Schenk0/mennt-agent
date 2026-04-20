export function processTerminalOutput(chunks: string[]) {
  const raw = chunks.join("");
  const lines: string[] = [];
  let currentLine = "";
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "\x1b") {
      const seq = raw.slice(i).match(/^\x1b\[[\d;]*([a-zA-Z])/);
      if (seq) {
        const code = seq[1];
        if (code === "G") {
          currentLine = "";
        }
        // K (clear to end), m (color) -- skip
        i += seq[0].length;
        continue;
      }
      const osc = raw.slice(i).match(/^\x1b\].*?\x07/);
      if (osc) {
        i += osc[0].length;
        continue;
      }
      i++;
      continue;
    }

    if (raw[i] === "\r") {
      // Handle CRLF line endings without dropping the current line content.
      if (raw[i + 1] === "\n") {
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = "";
        i += 2;
        continue;
      }

      // Bare carriage return means "move cursor to line start".
      currentLine = "";
      i++;
      continue;
    }

    if (raw[i] === "\n") {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = "";
      i++;
      continue;
    }

    currentLine += raw[i];
    i++;
  }

  if (currentLine.trim()) lines.push(currentLine);
  return lines;
}

export function processTerminalOutputText(chunks: string[]) {
  return processTerminalOutput(chunks).join("\n");
}

export function truncateOutput(output: string, maxLength: number) {
  if (output.length <= maxLength) return output;

  const headSize = Math.floor(maxLength * 0.2);
  const tailSize = maxLength - headSize;
  const omitted = output.length - maxLength;

  const head = output.slice(0, headSize);
  const tail = output.slice(output.length - tailSize);

  return `${head}\n...[truncated ${omitted} characters]\n${tail}`;
}