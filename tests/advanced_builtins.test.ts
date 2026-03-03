import { describe, it, expect } from 'vitest';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';

describe('Advanced Built-ins', () => {
  it('supports starts with and ends with for strings', async () => {
    const source = `
      let text = "Lythra is awesome"
      let startsL = text starts with "Lythra"
      let startsIs = text starts with "is"
      let endsAwe = text ends with "awesome"
      let endsThra = text ends with "Lythra"
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('startsL')).toBe(true);
    expect(interpreter.globals.get('startsIs')).toBe(false);
    expect(interpreter.globals.get('endsAwe')).toBe(true);
    expect(interpreter.globals.get('endsThra')).toBe(false);
  });

  it('supports mapping over an array with a function', async () => {
    const source = `
      fn triple(x):
        return x * 3
      
      let numbers = [1, 2, 3, 4]
      let mapped = numbers map triple
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('mapped')).toEqual([3, 6, 9, 12]);
  });

  it('supports filtering an array with a function', async () => {
    const source = `
      fn isEvn(x):
        return x - (x / 2 * 2) == 0 # integer division isn't strictly typed but we can mock something close
        
      fn overTwo(x):
        return x > 2
      
      let numbers = [1, 2, 3, 4, 5]
      let filtered = numbers filter overTwo
    `;
    const tokens = tokenize(source).tokens;
    const ast = parse(tokens);
    const interpreter = new Interpreter();
    await interpreter.executeBlock(ast.program.body, interpreter.globals);

    expect(interpreter.globals.get('filtered')).toEqual([3, 4, 5]);
  });
});
