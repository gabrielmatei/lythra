import { describe, it, expect } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';

describe('Parallel Execution', () => {
  it('executes statements concurrently', async () => {
    const runtime = new LythraRuntime();

    // Inject a sleep function to test concurrency vs sequential wall-clock time
    // @ts-ignore
    runtime.interpreter.globals.define('sleep', {
      arity: 1,
      call: async (interpreter: any, args: any[]) => {
        const ms = args[0];
        await new Promise(r => setTimeout(r, ms));
        return ms;
      },
      toString: () => '<builtin fn sleep>'
    }, false);

    const source = `
      parallel:
        sleep(120)
        sleep(120)
        sleep(120)
    `;

    const start = Date.now();
    const result = await runtime.execute(source);
    const elapsed = Date.now() - start;

    expect(result.errors).toBeUndefined();
    // If sequential, it would take ~360ms. Parallel should be ~120-150ms.
    expect(elapsed).toBeLessThan(250);
    expect(elapsed).toBeGreaterThanOrEqual(110);
  });
});
