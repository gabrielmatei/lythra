import { describe, it, expect } from 'vitest';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';

describe('Variable Destructuring', () => {
  it('should destructure properties from an object literal', async () => {
    const source = `
      let profile = { name: "Alex", score: 99, active: true }
      let { name, score, active } = profile
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('name')).toBe('Alex');
    expect(interpreter.globals.get('score')).toBe(99);
    expect(interpreter.globals.get('active')).toBe(true);
  });

  it('should assign null to missing properties', async () => {
    const source = `
      let obj = { a: 10 }
      let { a, b } = obj
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('a')).toBe(10);
    expect(interpreter.globals.get('b')).toBeNull();
  });

  it('should throw an error when destructuring a non-object', async () => {
    const source = `
      let numbers = [1, 2, 3]
      let { a, b } = numbers
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();

    await expect(interpreter.executeBlock(ast.program.body, interpreter.globals)).rejects.toThrow('Can only destructure objects');
  });
});
