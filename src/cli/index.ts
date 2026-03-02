#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { startRepl } from './repl.js';
import { LythraRuntime } from '../runtime/runtime.js';

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case 'repl':
      startRepl();
      break;

    case 'run': {
      const file = args[0];
      if (!file) {
        console.error('Usage: lythra run <file.lth>');
        process.exit(1);
      }
      const source = readFileSync(resolve(process.cwd(), file), 'utf-8');
      const runtime = new LythraRuntime();
      const result = await runtime.execute(source);

      if (result.errors && result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`\x1b[31m${err}\x1b[0m`);
        }
        process.exit(1);
      }
      if (result.halted) {
        console.log('\x1b[33mProgram halted.\x1b[0m');
      }
      // Note: run doesn't print last expression values like REPL
      break;
    }

    case 'check': {
      const file = args[0];
      if (!file) {
        console.error('Usage: lythra check <file.lth>');
        process.exit(1);
      }
      const source = readFileSync(resolve(process.cwd(), file), 'utf-8');
      const runtime = new LythraRuntime();
      const errors = runtime.check(source);

      if (errors.length > 0) {
        for (const err of errors) {
          console.error(`\x1b[31m${err}\x1b[0m`);
        }
        console.error(`\nFound ${errors.length} error(s).`);
        process.exit(1);
      } else {
        console.log('\x1b[32mNo syntax errors found.\x1b[0m');
      }
      break;
    }

    case 'init': {
      const boilerplate = `# Welcome to Lythra

log "Hello, Lythra world!"

let counter = 0
while counter < 3:
  log "Counting: " + counter
  counter = counter + 1
`;
      writeFileSync(resolve(process.cwd(), 'main.lth'), boilerplate);
      console.log('Created main.lth starter file.');
      break;
    }

    case undefined:
    case 'help':
    default:
      if (command && command !== 'help') {
        console.log(`Unknown command: ${command}\n`);
      } else if (command === undefined) {
        // Default to repl if no args provided
        startRepl();
        break;
      }
      console.log(`Lythra CLI

Usage:
  lythra              Start the REPL
  lythra repl         Start the REPL
  lythra run <file>   Execute a .lth file
  lythra check <file> Type-check and syntax-check a file
  lythra init         Create a starter main.lth file in the current directory
`);
      break;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
