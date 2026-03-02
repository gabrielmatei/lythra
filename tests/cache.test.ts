import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';
import * as visionModule from '../src/llm/vision.js';
import * as cacheModule from '../src/llm/cache.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Caching Integration', () => {
  let interpreter: Interpreter;

  beforeEach(() => {
    interpreter = new Interpreter();
    vi.clearAllMocks();
    vi.spyOn(visionModule, 'callVision').mockResolvedValue('"mocked response"');
    cacheModule.clearCache();
  });

  it('bypasses cache by default', async () => {
    const source = `
      let a = vision<String> "generate something"
      let b = vision<String> "generate something"
    `;

    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(visionModule.callVision).toHaveBeenCalledTimes(2);
  });

  it('caches identical vision calls within remember block', async () => {
    const source = `
      let a = ""
      let b = ""
      remember:
        a = vision<String> "cached prompt"
        b = vision<String> "cached prompt"
    `;

    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    // Call vision should only run once, the second identical prompt hits the cache
    expect(visionModule.callVision).toHaveBeenCalledTimes(1);

    // Verify variable assignment succeeded
    expect(interpreter.globals.get('a')).toBe('"mocked response"');
    expect(interpreter.globals.get('b')).toBe('"mocked response"');
  });

  it('does not cache different prompts', async () => {
    const source = `
      remember:
        let a = vision<String> "prompt A"
        let b = vision<String> "prompt B"
    `;

    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(visionModule.callVision).toHaveBeenCalledTimes(2);
  });

  it('supports forget all statement to wipe cache', async () => {
    const source = `
      remember:
        let a = vision<String> "wipe me"
      
      forget all

      remember:
        let b = vision<String> "wipe me"
    `;

    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    // Because it forgot the cache, the second 'remember:' requires a fresh API call
    expect(visionModule.callVision).toHaveBeenCalledTimes(2);
  });
});
