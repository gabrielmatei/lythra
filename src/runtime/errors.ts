export function formatSnippetError(
  message: string,
  source: string,
  line: number,
  column: number,
  length: number = 1
): string {
  const lines = source.split('\n');
  const errorLineIndex = line - 1;
  const errorLine = lines[errorLineIndex];

  if (errorLine === undefined) {
    return `Error at L${line}:${column}: ${message}\n(Source line out of bounds)`;
  }

  // Formatting strings with red colors
  const RED = '\x1b[31m';
  const DIM = '\x1b[90m';
  const RESET = '\x1b[0m';

  const lineNumberStr = String(line);
  const gutterStr = `${lineNumberStr} | `;
  const emptyGutterStr = ' '.repeat(lineNumberStr.length) + ' | ';

  const snippet = `${emptyGutterStr}\n${gutterStr}${errorLine}\n${emptyGutterStr}${DIM}${' '.repeat(Math.max(0, column - 1))}${RESET}${RED}${'^'.repeat(length)} ${message}${RESET}\n`;

  return snippet;
}
