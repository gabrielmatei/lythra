import * as ast from '../parser/ast.js';
import { Environment } from './environment.js';
import { LythraValue, RuntimeError, ReturnEx, HaltEx, InterpreterInterface, LythraCallable, stringify } from './types.js';

export class Interpreter implements InterpreterInterface {
  public globals = new Environment();
  private environment = this.globals;

  constructor() {
    // Phase 3 Built-ins injected into globals
    this.globals.define('log', {
      arity: 1,
      call: (interpreter: InterpreterInterface, args: LythraValue[]) => {
        console.log(stringify(args[0]!));
        return null; // functions returning nothing in Lythra return null implicitly
      },
      toString: () => '<builtin fn log>'
    } as LythraCallable, false);

    this.globals.define('halt', {
      arity: 0,
      call: () => {
        throw new HaltEx(null);
      },
      toString: () => '<builtin fn halt>'
    } as LythraCallable, false);
  }

  // ─── Entry Point ───────────────────────────────────────────────────────────

  interpret(program: ast.Program): { error?: string, halted?: boolean } {
    try {
      for (const stmt of program.body) {
        this.execute(stmt);
      }
      return {};
    } catch (error) {
      if (error instanceof HaltEx) {
        return { halted: true };
      }
      if (error instanceof RuntimeError) {
        return { error: `[line ${error.node.line}] Runtime Error: ${error.message}` };
      }
      return { error: `[Internal Error] ${error}` };
    }
  }

  // ─── Statements ────────────────────────────────────────────────────────────

  private execute(stmt: ast.Stmt): void {
    switch (stmt.kind) {
      case 'ExpressionStatement':
        this.evaluate(stmt.expression);
        break;
      case 'LogStatement': {
        const value = this.evaluate(stmt.expression);
        console.log(stringify(value));
        break;
      }
      case 'HaltStatement':
        throw new HaltEx(this.evaluate(stmt.expression));
      case 'VarDeclaration': {
        let value: LythraValue = null;
        if (stmt.initializer) {
          value = this.evaluate(stmt.initializer);
        }
        this.environment.define(stmt.name, value, stmt.mutable);
        break;
      }
      case 'Assignment': {
        const value = this.evaluate(stmt.value);
        if (stmt.target.kind === 'Identifier') {
          this.environment.assign(stmt.target.name, value, stmt.target);
        } else if (stmt.target.kind === 'MemberExpr') {
          const obj = this.evaluate(stmt.target.object);
          if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new RuntimeError(stmt.target, 'Only objects have properties.');
          }
          (obj as Record<string, LythraValue>)[stmt.target.property] = value;
        } else {
          throw new RuntimeError(stmt.target, 'Invalid assignment target.');
        }
        break;
      }
      case 'IfStatement': {
        if (this.isTruthy(this.evaluate(stmt.condition))) {
          this.executeBlock(stmt.body.statements, new Environment(this.environment));
        } else {
          let matched = false;
          for (const elseIf of stmt.elseIfs) {
            if (this.isTruthy(this.evaluate(elseIf.condition))) {
              this.executeBlock(elseIf.body.statements, new Environment(this.environment));
              matched = true;
              break;
            }
          }
          if (!matched && stmt.elseBody) {
            this.executeBlock(stmt.elseBody.statements, new Environment(this.environment));
          }
        }
        break;
      }
      case 'WhileStatement': {
        while (this.isTruthy(this.evaluate(stmt.condition))) {
          this.executeBlock(stmt.body.statements, new Environment(this.environment));
        }
        break;
      }
      case 'ForStatement': {
        const iterable = this.evaluate(stmt.iterable);
        if (!Array.isArray(iterable)) {
          throw new RuntimeError(stmt.iterable, 'Can only iterate over arrays.');
        }

        for (const item of iterable) {
          const loopEnv = new Environment(this.environment);
          loopEnv.define(stmt.variable, item, false); // loop variable is const in Lythra
          this.executeBlock(stmt.body.statements, loopEnv);
        }
        break;
      }
      case 'ReturnStatement': {
        let value: LythraValue = null;
        if (stmt.value) {
          value = this.evaluate(stmt.value);
        }
        throw new ReturnEx(value);
      }
      case 'FnDeclaration':
      case 'PipelineDeclaration': {
        const fn = new LythraFunction(stmt, this.environment);
        this.environment.define(stmt.name, fn, false); // functions are const
        break;
      }
      default:
        throw new Error(`Unexpected statement kind: ${(stmt as any).kind}`);
    }
  }

  // ─── Expressions ───────────────────────────────────────────────────────────

  public evaluate(expr: ast.Expr): LythraValue {
    switch (expr.kind) {
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return 'value' in expr ? (expr as any).value : null;
      case 'Identifier':
        return this.environment.get(expr.name, expr);
      case 'GroupingExpr':
        return this.evaluate(expr.expression);
      case 'ArrayLiteral': {
        const elements: LythraValue[] = [];
        for (const e of expr.elements) {
          elements.push(this.evaluate(e));
        }
        return elements;
      }
      case 'ObjectLiteral': {
        const obj: Record<string, LythraValue> = {};
        for (const prop of expr.properties) {
          obj[prop.key] = this.evaluate(prop.value);
        }
        return obj;
      }
      case 'MemberExpr': {
        const obj = this.evaluate(expr.object);
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
          throw new RuntimeError(expr.object, 'Only objects have properties.');
        }
        return (obj as Record<string, LythraValue>)[expr.property] ?? null;
      }
      case 'UnaryExpr': {
        const right = this.evaluate(expr.operand);

        switch (expr.operator) {
          case '-':
            if (typeof right !== 'number') throw new RuntimeError(expr.operand, 'Operand must be a number.');
            return -right;
          case 'not':
            return !this.isTruthy(right);
          default:
            throw new RuntimeError(expr, `Unknown unary operator '${expr.operator}'.`);
        }
      }
      case 'BinaryExpr': {
        const left = this.evaluate(expr.left);
        // Short circuiting for logical operators
        if (expr.operator === 'or') {
          if (this.isTruthy(left)) return left;
          return this.evaluate(expr.right);
        }
        if (expr.operator === 'and') {
          if (!this.isTruthy(left)) return left;
          return this.evaluate(expr.right);
        }

        const right = this.evaluate(expr.right);

        switch (expr.operator) {
          case '==': return left === right; // Lythra equality is JS strict equality 
          case '!=': return left !== right;
          case '+':
            if (typeof left === 'number' && typeof right === 'number') {
              return left + right;
            }
            if (typeof left === 'string' && typeof right === 'string') {
              return left + right;
            }
            throw new RuntimeError(expr, 'Operands must be two numbers or two strings.');
          case '-':
            if (typeof left === 'number' && typeof right === 'number') return left - right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '*':
            if (typeof left === 'number' && typeof right === 'number') return left * right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '/':
            if (typeof left === 'number' && typeof right === 'number') {
              if (right === 0) throw new RuntimeError(expr, 'Division by zero.');
              return left / right;
            }
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '>':
            if (typeof left === 'number' && typeof right === 'number') return left > right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '>=':
            if (typeof left === 'number' && typeof right === 'number') return left >= right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '<':
            if (typeof left === 'number' && typeof right === 'number') return left < right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '<=':
            if (typeof left === 'number' && typeof right === 'number') return left <= right;
            throw new RuntimeError(expr, 'Operands must be numbers.');

          default:
            throw new RuntimeError(expr, `Unknown operator '${expr.operator}'.`);
        }
      }
      case 'CallExpr': {
        const callee = this.evaluate(expr.callee);

        const args: LythraValue[] = [];
        for (const argExpr of expr.args) {
          args.push(this.evaluate(argExpr));
        }

        if (typeof callee === 'object' && callee !== null && !Array.isArray(callee) && 'call' in callee && typeof callee.call === 'function') {
          const callable = callee as LythraCallable;
          if (args.length !== callable.arity) {
            throw new RuntimeError(expr, `Expected ${callable.arity} arguments but got ${args.length}.`);
          }
          return callable.call(this, args);
        } else {
          throw new RuntimeError(expr.callee, 'Can only call functions and pipelines.');
        }
      }
      default:
        throw new Error(`Unexpected expression kind: ${(expr as any).kind}`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  public executeBlock(statements: readonly ast.Stmt[], environment: Environment): void {
    const previous = this.environment;
    try {
      this.environment = environment;
      for (const stmt of statements) {
        this.execute(stmt);
      }
    } finally {
      this.environment = previous;
    }
  }

  private isTruthy(value: LythraValue): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value !== '';
    return true; // objects, arrays, functions are truthy
  }
}

// ─── Callables ───────────────────────────────────────────────────────────────

class LythraFunction implements LythraCallable {
  public arity: number;

  constructor(
    private readonly declaration: ast.FnDeclaration | ast.PipelineDeclaration,
    private readonly closure: Environment
  ) {
    this.arity = declaration.params.length;
  }

  call(interpreter: InterpreterInterface, args: LythraValue[]): LythraValue {
    const environment = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      environment.define(this.declaration.params[i]!.name, args[i]!, true);
    }

    try {
      interpreter.executeBlock(this.declaration.body.statements, environment);
    } catch (error) {
      if (error instanceof ReturnEx) {
        return error.value;
      }
      throw error;
    }

    return null; // implicit return null
  }

  toString(): string {
    return `<fn ${this.declaration.name}>`;
  }
}
