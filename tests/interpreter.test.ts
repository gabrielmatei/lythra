import { describe, it, expect, vi } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';
import { Interpreter } from '../src/interpreter/interpreter.js';
import { LythraCallable, LythraValue } from '../src/interpreter/types.js';

async function execute(source: string, interpreter = new Interpreter()) {
  const { tokens, errors: lexErrors } = tokenize(source);
  if (lexErrors.length > 0) throw new Error(`Lex errors: ${lexErrors[0]!.message}`);

  const { program, errors: parseErrors } = parse(tokens);
  if (parseErrors.length > 0) {
    console.error(parseErrors);
    throw new Error(`Parse errors: ${parseErrors[0]!.message} at ${parseErrors[0]!.line}:${parseErrors[0]!.column}`);
  }

  return await interpreter.interpret(program);
}

describe('Interpreter', () => {
  it('evaluates built-in log and arithmetic', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

    const code = `
let x = 10 + 20 * 2
log x
`;
    const result = await execute(code);
    expect(result.error).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith('50');
    consoleSpy.mockRestore();
  });

  it('handles strings and boolean logic', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let a = "hello " + "world"
let b = true and false
let c = true or false
log a
log b
log c
`;
    await execute(code);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, "hello world");
    expect(consoleSpy).toHaveBeenNthCalledWith(2, "false");
    expect(consoleSpy).toHaveBeenNthCalledWith(3, "true");
    consoleSpy.mockRestore();
  });

  it('respects variable mutability', async () => {
    const code = `
const x = 10
x = 20
`;
    const result = await execute(code);
    expect(result.error).toMatch(/Cannot reassign to constant variable 'x'/);
  });

  it('evaluates control flow (if/else, while)', async () => {
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
    await execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('exact'); // from if
    expect(consoleSpy).toHaveBeenCalledWith('0'); // while loop
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).toHaveBeenCalledWith('2');
    consoleSpy.mockRestore();
  });

  it('evaluates functions, scopes and closures', async () => {
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
    const result = await execute(code);
    expect(result.error).toBeUndefined();
    expect(consoleSpy).toHaveBeenNthCalledWith(1, '1');
    expect(consoleSpy).toHaveBeenNthCalledWith(2, '2');
    consoleSpy.mockRestore();
  });

  it('evaluates block scope correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let x = "global"
if true:
  let x = "local"
  log x
log x
`;
    await execute(code);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'local');
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'global');
    consoleSpy.mockRestore();
  });

  it('halts execution immediately', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
log 1
halt 99
log 2
`;
    const result = await execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).not.toHaveBeenCalledWith('2');
    expect(result.halted).toBe(true);
    consoleSpy.mockRestore();
  });

  it('handles objects and arrays', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
let user = { name: "Gabriel", age: 30 }
user.age = 31
log user.name

let list = [1, 2, 3]
for item in list:
  log item
`;
    await execute(code);
    expect(consoleSpy).toHaveBeenCalledWith('Gabriel');
    expect(consoleSpy).toHaveBeenCalledWith('1');
    expect(consoleSpy).toHaveBeenCalledWith('2');
    expect(consoleSpy).toHaveBeenCalledWith('3');
    consoleSpy.mockRestore();
  });

  it('evaluates match statements', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    const code = `
fn runMatch(val):
  match val:
    1 -> log "One"
    "two" -> 
      log "Two block"
      log "End two"
    _ -> log "Default"

runMatch(1)
runMatch("two")
runMatch(99)
`;
    await execute(code);
    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'One');
    expect(consoleSpy).toHaveBeenNthCalledWith(2, 'Two block');
    expect(consoleSpy).toHaveBeenNthCalledWith(3, 'End two');
    expect(consoleSpy).toHaveBeenNthCalledWith(4, 'Default');
    consoleSpy.mockRestore();
  });
});

