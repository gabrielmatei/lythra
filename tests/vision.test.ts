import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LythraRuntime } from '../src/runtime/runtime.js';

describe('Phase 4: LLM Vision Primitive integration', () => {
  let runtime: LythraRuntime;

  beforeEach(() => {
    // We will set a fake API key so it passes the initial check
    process.env.GEMINI_API_KEY = 'fake_key';

    // Mock the global fetch object
    // @ts-ignore
    global.fetch = vi.fn();
    runtime = new LythraRuntime();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs a basic vision<Type> command and resolves the typed property correctly', async () => {
    // Mock fetch to return a perfectly formatted JSON result for { name: "test" }
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: { parts: [{ text: '"test"' }] } // Simulate the string text returned cleanly
          }
        ]
      })
    });

    const code = `let res = vision<String> "generate a test word"`;
    const result = await runtime.execute(code);

    // Verify it evaluates cleanly and the result is stored within the runtime
    expect(result.errors).toBeUndefined();

    // We can evaluate just 'res' to inspect its value
    const checkValue = await runtime.execute('res');
    expect(checkValue.value).toStrictEqual("test");
  });

  it('passes context down using `using` syntax', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '5' }] } }]
      })
    });

    const code = `
let body = "one two three four five"
let count = vision<Int> "count these words" using body
`;
    await runtime.execute(code);

    // Extract the payload sent to our mock
    const fetchCall = (global.fetch as any).mock.calls[0];
    const fetchArgs = fetchCall[1];
    const payload = JSON.parse(fetchArgs.body);

    // Check that context was embedded with the prompt inside the API call
    const sentText = payload.contents[0].parts[0].text;
    expect(sentText).toContain('count these words');
    expect(sentText).toContain('"one two three four five"'); // ensure context was json encoded properly.
  });

  it('forces determinism modifier config when in a precise: block', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '"hello"' }] } }]
      })
    });

    const code = `
precise:
  let result = vision<String> "say hello"
`;
    await runtime.execute(code);

    const fetchCall = (global.fetch as any).mock.calls[0];
    const fetchArgs = fetchCall[1];
    const payload = JSON.parse(fetchArgs.body);

    // precise modifier specifies temp = 0
    expect(payload.generationConfig.temperature).toBe(0);
  });

  it('supports attempt blocks and retries on Assert failure', async () => {
    let calls = 0;
    // Mock the fetch to throw invalid values the first 2 times, then valid the 3rd time
    (global.fetch as any).mockImplementation(() => {
      calls++;
      const text = calls < 3 ? '5' : '15'; // It wants > 10
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text }] } }]
        })
      });
    });

    const code = `
attempt 5 times:
  let num = vision<Int> "give me a number"
  assert num > 10
fallback 0
`;
    const res = await runtime.execute(code);
    expect(res.errors).toBeUndefined();

    // since it succeeded on the 3rd fetch (num = 15; 15 > 10), fetch should be called 3 times total
    expect(calls).toBe(3);
  });

  it('falls back to the fallback expression on total failure', async () => {
    // Mock to always fail the assert condition
    (global.fetch as any).mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '1' }] } }]
        })
      });
    });

    // Notice we capture the assigned variables out of scope. But wait, attempt block has block scope, 
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    (runtime as any).interpreter.globals.define('flagFailed', {
      arity: 0,
      call: async () => { console.log('failed'); return null; },
      toString: () => '<fn>'
    } as any, false);

    const code = `
attempt 2 times:
  let num = vision<Int> "give me a number"
  assert num > 10
fallback flagFailed()
`;

    const res = await runtime.execute(code);
    expect(res.errors).toBeUndefined();

    // Verify fallback expression was evaluated by checking if flagFailed() was called
    expect(consoleSpy).toHaveBeenCalledWith('failed');
    consoleSpy.mockRestore();
  });
});
