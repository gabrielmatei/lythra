import { describe, it, expect, vi } from 'vitest';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';

describe('Built-ins & Standard Library', () => {
  it('supports string interpolation', async () => {
    const source = `
      let name = "Alice"
      let age = 30
      let greeting = "Hello {name}, you are {age + 1} years old!"
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('greeting')).toBe('Hello Alice, you are 31 years old!');
  });

  it('supports array methods (length, contains)', async () => {
    const source = `
      let arr = [1, 2, 3]
      let len = arr length
      let hasTwo = arr contains 2
      let hasTen = arr contains 10
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('len')).toBe(3);
    expect(interpreter.globals.get('hasTwo')).toBe(true);
    expect(interpreter.globals.get('hasTen')).toBe(false);
  });

  it('supports string methods (length, contains, matches)', async () => {
    const source = `
      let str = "Hello Lythra"
      let len = str length
      let hasHello = str contains "Hello"
      let matchesRegex = str matches "^H.*"
      let noMatch = str matches "World"
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('len')).toBe(12);
    expect(interpreter.globals.get('hasHello')).toBe(true);
    expect(interpreter.globals.get('matchesRegex')).toBe(true);
    expect(interpreter.globals.get('noMatch')).toBe(false);
  });

  it('supports env access', async () => {
    process.env.TEST_VAR = 'vitest_works';
    const source = `
      let myVar = env.TEST_VAR
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('myVar')).toBe('vitest_works');
  });

  it('supports fetch URL as JSON', async () => {
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: 'delectus aut autem' }),
    });

    const source = `
      let data = fetch "https://jsonplaceholder.typicode.com/todos/1" as json
      let title = data.title
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('title')).toBe('delectus aut autem');
    expect(global.fetch).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/todos/1');

    vi.restoreAllMocks();
  });
});
