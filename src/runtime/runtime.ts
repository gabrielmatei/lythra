import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';
import { LythraValue, stringify } from '../interpreter/types.js';

export interface RuntimeResult {
  value?: LythraValue;
  output?: string;
  errors?: string[];
  halted?: boolean;
}

export class LythraRuntime {
  private interpreter = new Interpreter();

  constructor() { }

  /**
   * Type-checks / syntax-checks the given source code without executing it.
   * Returns a list of error messages, or an empty array if okay.
   */
  public check(source: string): string[] {
    const { tokens, errors: lexErrors } = tokenize(source);
    if (lexErrors.length > 0) {
      return lexErrors.map(e => `[Lexer] ${e.message}`);
    }

    const { errors: parseErrors } = parse(tokens);
    if (parseErrors.length > 0) {
      return parseErrors.map(e => `[Parser] ${e.message}`);
    }

    return [];
  }

  /**
   * Executes the given source code against the persistent interpreter state.
   */
  public async execute(source: string): Promise<RuntimeResult> {
    // 1. Lexing
    const { tokens, errors: lexErrors } = tokenize(source);
    if (lexErrors.length > 0) {
      return { errors: lexErrors.map(e => `[Lexer] ${e.message}`) };
    }

    // 2. Parsing
    const { program, errors: parseErrors } = parse(tokens);
    if (parseErrors.length > 0) {
      return { errors: parseErrors.map(e => `[Parser] ${e.message}`) };
    }

    // 3. Execution
    // For REPL convenience, if it's a single expression, we can evaluate it and return the value
    // But since our Lythra spec heavily relies on statements, we'll just run the program.
    const result = await this.interpreter.interpret(program);

    if (result.error) {
      return { errors: [result.error] };
    }

    if (result.halted) {
      return { halted: true };
    }

    // Experimental REPL feature: if there was exactly 1 statement and it was an ExpressionStatement, 
    // we can return its evaluated value for console output.
    if (program.body.length === 1 && program.body[0]!.kind === 'ExpressionStatement') {
      try {
        const value = await this.interpreter.evaluate(program.body[0].expression);
        return { value, output: stringify(value) };
      } catch (e) {
        // Ignore evaluation error of the solitary expression if it failed during execution phase above anyway
      }
    }

    return {};
  }
}
