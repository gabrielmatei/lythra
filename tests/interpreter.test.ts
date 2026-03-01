import { describe, it, expect, vi } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { LythraCallable, LythraValue } from '../src/interpreter/types.js';

function execute(source: string, interpreter = new Interpreter()) {
  const { tokens, errors: lexErrors } = tokenize(source);
  if (lexErrors.length > 0) throw new Error(`Lex errors: ${lexErrors[0]!.message}`);

  const { program, errors: parseErrors } = parse(tokens);
  if (parseErrors.length > 0) throw new Error(`Parse errors: ${parseErrors[0]!.message}`);

  return interpreter.interpret(program);
}

describe('Interpreter', () => {
  it('evaluates built-in log and arithmetic', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

    const code = `
let x = 10 + 20 * 2
log x
`;
    const result = execute(code);
    expect(result.error).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('50');
    consoleSpy.mockRestore();
  });

  it('handles strings and boolean logic', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let a = "hello " + "world"
let b = true and false
let c = true or false
log a
log b
log c
`;
    execute(code);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, "hello world");
    expect(consoleSpy).toHaveBeenNthCalledWith(2, "false");
    expect(consoleSpy).toHaveBeenNthCalledWith(3, "true");
    consoleSpy.mockRestore();
  });

  it('respects variable mutability', () => {
    const code = `
const x = 10
x = 20
`;
    const result = execute(code);
    expect(result.error).toMatch(/Cannot reassign to constant variable 'x'/);
  });

  it('evaluates control flow (if/else, while)', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let x = 5
if x > 10:
  log "big"
else if x == 5:
  log "exact"
else:
  log "small"

let count = 0
while count < 3:
  log count
  count = count + 1
`;
    execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('exact'); // from if
    expect(consoleSpy).toHaveBeenCalledWith('0'); // while loop
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).toHaveBeenCalledWith('2');
    consoleSpy.mockRestore();
  });

  it('evaluates functions, scopes and closures', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
fn makeCounter():
  let count = 0
  fn counter():
    count = count + 1
    return count
  return counter

const c = makeCounter()
log c()
log c()
`;
    const result = execute(code);
    expect(result.error).toBeUndefined();
    expect(consoleSpy).toHaveBeenNthCalledWith(1, '1');
    expect(consoleSpy).toHaveBeenNthCalledWith(2, '2');
    consoleSpy.mockRestore();
  });

  it('evaluates block scope correctly', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let x = "global"
if true:
  let x = "local"
  log x
log x
`;
    execute(code);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'local');
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'global');
    consoleSpy.mockRestore();
  });

  it('halts execution immediately', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
log 1
halt 99
log 2
`;
    const result = execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).not.toHaveBeenCalledWith('2');
    expect(result.halted).toBe(true);
    consoleSpy.mockRestore();
  });

  it('handles objects and arrays', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let user = { name: "Gabriel", age: 30 }
user.age = 31
log user.name

let list = [1, 2, 3]
for item in list:
  log item
`;
    execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('Gabriel');
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).toHaveBeenCalledWith('2');
    expect(consoleSpy).toHaveBeenCalledWith('3');
    consoleSpy.mockRestore();
  });
});
