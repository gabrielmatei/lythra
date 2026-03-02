import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';
import { LythraValue, RuntimeError, stringify } from '../interpreter/types.js';
import { formatSnippetError } from './errors.js';

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
      return lexErrors.map(e => formatSnippetError(`[Lexer] ${e.message}`, source, e.line, e.column));
    }

    const { errors: parseErrors } = parse(tokens);
    if (parseErrors.length > 0) {
      return parseErrors.map(e => formatSnippetError(`[Parser] ${e.message}`, source, e.line, e.column));
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
      return { errors: lexErrors.map(e => formatSnippetError(`[Lexer] ${e.message}`, source, e.line, e.column)) };
    }

    // 2. Parsing
    const { program, errors: parseErrors } = parse(tokens);
    if (parseErrors.length > 0) {
      return { errors: parseErrors.map(e => formatSnippetError(`[Parser] ${e.message}`, source, e.line, e.column)) };
    }

    // 3. Execution
    try {
      const result = await this.interpreter.interpret(program);

      if (result.error) {
        if (result.runtimeError) {
          const formatted = formatSnippetError(
            `[Runtime] ${result.runtimeError.message}`,
            source,
            result.runtimeError.node.line,
            result.runtimeError.node.column
          );
          const traceStr = result.runtimeError.stackTrace.length > 0
            ? '\nStack Trace:\n' + result.runtimeError.stackTrace.map(t => `  ${t}`).join('\n')
            : '';
          return { errors: [formatted + traceStr] };
        }
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
        } catch (e: any) {
          if (e instanceof RuntimeError) {
            const formatted = formatSnippetError(`[Runtime] ${e.message}`, source, e.node.line, e.node.column);
            const traceStr = e.stackTrace.length > 0 ? '\nStack Trace:\n' + e.stackTrace.map(t => `  ${t}`).join('\n') : '';
            return { errors: [formatted + traceStr] };
          }
          return { errors: [`[Runtime] Internal evaluation error: ${e.message}`] };
        }
      }

      return {};
    } catch (e: any) {
      if (e instanceof RuntimeError) {
        const formatted = formatSnippetError(`[Runtime] ${e.message}`, source, e.node.line, e.node.column);
        const traceStr = e.stackTrace.length > 0 ? '\nStack Trace:\n' + e.stackTrace.map(t => `  ${t}`).join('\n') : '';
        return { errors: [formatted + traceStr] };
      }
      return { errors: [`[Runtime] Execution error: ${e.message}`] };
    }
  }
}
