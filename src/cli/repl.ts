import * as readline from 'readline';
import { LythraRuntime } from '../runtime/runtime.js';

export function startRepl() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'lythra> '
  });

  console.log('Lythra REPL (Phase 9 Preview)');
  console.log('Type your code and press enter. Type ".exit", "quit" or "halt" to exit.');

  const runtime = new LythraRuntime();

  // To support multi-line inputs in a simplistic way (e.g., if blocks),
  // we could accumulate indents, but for this early phase REPL we'll execute line by line
  // unless we detect trailing colons.

  let buffer = '';

  rl.prompt();

  rl.on('line', (line: string) => {
    const input = line.trimEnd();

    if (input === '.exit' || input === 'quit' || input === 'halt') {
      console.log('Goodbye.');
      process.exit(0);
    }

    // Basic heuristic: if the line ends with a colon or we are already buffering, we probably want multi-line
    if (buffer !== '' || input.endsWith(':')) {
      if (input === '') {
        // Two newlines evaluate the block
        const code = buffer;
        buffer = '';
        runCode(runtime, code);
        rl.setPrompt('lythra> ');
      } else {
        buffer += line + '\n';
        rl.setPrompt('......> ');
      }
    } else {
      // Single line execution
      if (input.length > 0) {
        runCode(runtime, input);
      }
    }

    rl.prompt();
  }).on('close', () => {
    console.log('\nGoodbye.');
    process.exit(0);
  });
}

function runCode(runtime: LythraRuntime, code: string) {
  const result = runtime.execute(code);

  if (result.errors && result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`\x1b[31m${err}\x1b[0m`); // red
    }
  } else if (result.halted) {
    console.log('\x1b[33mProgram paused/halted.\x1b[0m'); // yellow
  } else if (result.output !== undefined) {
    console.log(`\x1b[32m${result.output}\x1b[0m`); // green
  }
}
