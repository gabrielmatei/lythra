import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { LythraRuntime } from '../src/runtime/runtime.js';
import * as ast from '../src/parser/ast.js';

describe('Phase 12 Core Syntax', () => {
  it('evaluates range loops accurately', async () => {
    const interpreter = new Interpreter();
    // testing range: 2..5
    const rangeExpr: ast.RangeExpr = {
      kind: 'RangeExpr',
      start: { kind: 'NumberLiteral', value: 2, line: 1, column: 1 },
      end: { kind: 'NumberLiteral', value: 5, line: 1, column: 1 },
      line: 1,
      column: 1
    };

    const result = await interpreter.evaluate(rangeExpr);
    expect(result).toEqual([2, 3, 4, 5]);
  });

  it('evaluates binary in operator accurately', async () => {
    const interpreter = new Interpreter();
    // testing `2 in [1, 2, 3]`
    const inExpr: ast.BinaryExpr = {
      kind: 'BinaryExpr',
      left: { kind: 'NumberLiteral', value: 2, line: 1, column: 1 },
      operator: 'in',
      right: {
        kind: 'ArrayLiteral', elements: [
          { kind: 'NumberLiteral', value: 1, line: 1, column: 1 },
          { kind: 'NumberLiteral', value: 2, line: 1, column: 1 },
          { kind: 'NumberLiteral', value: 3, line: 1, column: 1 }
        ], line: 1, column: 1
      },
      line: 1, column: 1
    };

    const result = await interpreter.evaluate(inExpr);
    expect(result).toBe(true);

    // testing `"b" in "abc"`
    const inStrExpr: ast.BinaryExpr = {
      kind: 'BinaryExpr',
      left: { kind: 'StringLiteral', value: "b", line: 1, column: 1 },
      operator: 'in',
      right: { kind: 'StringLiteral', value: "abc", line: 1, column: 1 },
      line: 1, column: 1
    };

    const strResult = await interpreter.evaluate(inStrExpr);
    expect(strResult).toBe(true);
  });
});

describe('Phase 12.3 Pipeline Fallbacks', () => {
  it('evaluates fallback block when pipeline throws', async () => {
    const interpreter = new Interpreter();
    // testing `consult FailPipeline() or fallback { ... }`

    // Create a mock pipeline call that throws
    const throwExpr: ast.Expr = {
      kind: 'CallExpr',
      callee: { kind: 'Identifier', name: 'FailMe', line: 1, column: 1 },
      args: [],
      line: 1, column: 1
    };

    // The interpreter will try to call 'FailMe' which is undefined in environment -> RuntimeError!
    // But since it's a consult with fallback, it should catch the error and execute the fallback.
    const fallbackExpr: ast.Expr = {
      kind: 'StringLiteral',
      value: "recovered",
      line: 1, column: 1
    };

    const consultFallback: ast.ConsultExpr = {
      kind: 'ConsultExpr',
      pipeline: throwExpr,
      args: [],
      fallback: fallbackExpr,
      line: 1, column: 1
    };

    const result = await interpreter.evaluate(consultFallback);
    expect(result).toBe("recovered");
  });
});

describe('Phase 12.5 Configuration Global', () => {
  it('injects config from lythra.json into global scope', async () => {
    // Note: I wrote tests/lythra.json via cli just now!
    const runtime = new LythraRuntime(path.join(process.cwd(), 'tests'));
    const result = await runtime.execute(`config.test_key`);

    expect(result.errors).toBeUndefined();
    expect(result.value).toBe("some_value");
  });
});

describe('Phase 12.4 Web Server Parsing', () => {
  it('destructures receive body into multiple variables via parser and interpreter', async () => {
    const runtime = new LythraRuntime();
    // Using an internal mock to simulate a channel receiving a POST request
    const source = `
      server TestServer on 8080:
        channel "/api/user":
          on call POST:
            receive body as { id, username }
            return "ID: " + id + ", User: " + username
    `;

    // We only syntax check it here because full server mocking requires supertest and port binding.
    // Let's verify the Check stage doesn't throw syntax errors for receive destructuring.
    const errors = runtime.check(source);
    if (errors.length > 0) {
      console.error(errors[0]);
    }
    expect(errors.length).toBe(0);
  });

  it('parses global filter middleware correctly', async () => {
    const runtime = new LythraRuntime();
    const source = `
      server TestServer on 8080:
        filter all:
          log "Intercepting all requests"
        
        channel "/":
          on call GET:
            transmit "Home"
    `;
    const errors = runtime.check(source);
    if (errors.length > 0) {
      console.error(errors[0]);
    }
    expect(errors.length).toBe(0);
  });
});
