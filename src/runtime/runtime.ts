import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';
import { LythraValue, RuntimeError, stringify } from '../interpreter/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { formatSnippetError } from './errors.js';

export interface RuntimeResult {
  value?: LythraValue;
  output?: string;
  errors?: string[];
  halted?: boolean;
}

export class LythraRuntime {
  private interpreter = new Interpreter();

  // Track currently imported files in the resolution chain to catch circular dependencies
  private importStack: string[] = [];

  // Cache of already parsed and evaluated modules to avoid re-evaluating on multiple imports
  private moduleCache: Map<string, Record<string, LythraValue>> = new Map();

  constructor(private basePath: string = process.cwd()) {
    this.interpreter.onImport = async (importPath: string) => {
      // Resolve the absolute path of the module relative to the executing runtime's base path
      const resolvedPath = path.resolve(this.basePath, importPath);

      if (this.importStack.includes(resolvedPath)) {
        throw new Error(`Circular dependency detected: ${this.importStack.join(' -> ')} -> ${resolvedPath}`);
      }

      if (this.moduleCache.has(resolvedPath)) {
        return this.moduleCache.get(resolvedPath)!;
      }

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Module not found: ${resolvedPath}`);
      }

      const source = fs.readFileSync(resolvedPath, 'utf8');

      // Push the file onto the stack for circular dependency tracking
      this.importStack.push(resolvedPath);

      // We spawn a completely fresh isolate runtime instance for the imported module
      const moduleRuntime = new LythraRuntime(path.dirname(resolvedPath));

      // Share the overarching module cache to ensure singletons across the entire app hierarchy
      moduleRuntime.moduleCache = this.moduleCache;
      moduleRuntime.importStack = [...this.importStack]; // Copy the stack context downwards

      // Let the child inherit global config properties like models from parent
      moduleRuntime.interpreter.globals.cacheMode = this.interpreter.globals.cacheMode;

      const parentModel = this.interpreter.globals.getInternal('__model');
      if (parentModel) moduleRuntime.interpreter.globals.defineInternal('__model', parentModel);

      const parentTimeout = this.interpreter.globals.getInternal('__timeout');
      if (parentTimeout) moduleRuntime.interpreter.globals.defineInternal('__timeout', parentTimeout);

      const result = await moduleRuntime.execute(source);

      this.importStack.pop();

      if (result.errors && result.errors.length > 0) {
        throw new Error(`Error executing module '${importPath}':\n${result.errors.join('\n')}`);
      }

      // The imported module's "exports" are effectively all bindings placed into its `globals` namespace!
      const exportsStr = moduleRuntime.interpreter.globals.getAll();
      const exportsRet: Record<string, LythraValue> = {};

      for (const [key, val] of exportsStr.entries()) {
        exportsRet[key] = val;
      }

      this.moduleCache.set(resolvedPath, exportsRet);
      return exportsRet;
    };
  }

  /**
   * Applies the parsed JSON configuration globals (from lythra.json) to the Lythra environment.
   */
  public applyGlobalConfig(config: any) {
    if (config.model) {
      this.interpreter.globals.defineInternal('__model', String(config.model));
    }
    if (config.cache === true) {
      this.interpreter.globals.cacheMode = true;
    }
    if (config.timeout) {
      this.interpreter.globals.defineInternal('__timeout', Number(config.timeout));
    }
  }

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
