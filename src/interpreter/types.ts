import * as ast from '../parser/ast.js';

export interface LythraObject {
  [key: string]: LythraValue;
}

export type LythraValue =
  | string
  | number
  | boolean
  | null
  | LythraValue[]
  | LythraObject
  | LythraCallable;

export interface LythraCallable {
  readonly arity: number;
  call(interpreter: InterpreterInterface, args: LythraValue[]): Promise<LythraValue>;
  toString(): string;
}

// Minimal interface for closures/callables to interact with the interpreter
// minimal Interface for closures
export interface InterpreterInterface {
  executeBlock(statements: readonly ast.Stmt[], environment: any): Promise<void>;
  evaluate(expr: ast.Expr): Promise<LythraValue>;
}

export class RuntimeError extends Error {
  constructor(public readonly node: ast.Expr | ast.Stmt, message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

export class ReturnEx extends Error {
  constructor(public readonly value: LythraValue) {
    super('ReturnEx');
    this.name = 'ReturnEx';
  }
}

export class HaltEx extends Error {
  constructor(public readonly value: LythraValue) {
    super('HaltEx');
    this.name = 'HaltEx';
  }
}

export class AssertionEx extends Error {
  constructor(public readonly message: string) {
    super(message);
    this.name = 'AssertionEx';
  }
}

export function stringify(value: LythraValue): string {
  if (value === null) return 'null';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return '[' + value.map(stringify).join(', ') + ']';
    }
    if ('call' in value && typeof value.call === 'function') {
      return value.toString();
    }

    // Plain object
    const entries = Object.entries(value).map(([k, v]) => `${k}: ${stringify(v)}`);
    return '{ ' + entries.join(', ') + ' }';
  }
  return String(value);
}
