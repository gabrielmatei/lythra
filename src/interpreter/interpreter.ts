import * as ast from '../parser/ast.js';
import { Environment } from './environment.js';
import { LythraValue, RuntimeError, ReturnEx, HaltEx, AssertionEx, InterpreterInterface, LythraCallable, stringify } from './types.js';
import { callVision } from '../llm/vision.js';
import { generateHash, getCache, setCache, clearCache } from '../llm/cache.js';

export class Interpreter implements InterpreterInterface {
  public globals = new Environment();
  private environment = this.globals;

  constructor() {
    this.globals.define('log', {
      arity: 1,
      call: async (interpreter: InterpreterInterface, args: LythraValue[]) => {
        console.log(stringify(args[0]!));
        return null;
      },
      toString: () => '<builtin fn log>'
    } as LythraCallable, false);

    this.globals.define('halt', {
      arity: 0,
      call: async () => {
        throw new HaltEx(null);
      },
      toString: () => '<builtin fn halt>'
    } as LythraCallable, false);
  }

  async interpret(program: ast.Program): Promise<{ error?: string, halted?: boolean }> {
    try {
      for (const stmt of program.body) {
        await this.execute(stmt);
      }
      return {};
    } catch (error: any) {
      if (error instanceof HaltEx) return { halted: true };
      if (error instanceof RuntimeError) return { error: `[line ${error.node.line}] Runtime Error: ${error.message}` };
      return { error: `[Internal Error] ${error}` };
    }
  }

  private async execute(stmt: ast.Stmt): Promise<void> {
    switch (stmt.kind) {
      case 'ExpressionStatement':
        await this.evaluate(stmt.expression);
        break;
      case 'LogStatement': {
        const value = await this.evaluate(stmt.expression);
        console.log(stringify(value));
        break;
      }
      case 'HaltStatement':
        throw new HaltEx(await this.evaluate(stmt.expression));
      case 'VarDeclaration': {
        let value: LythraValue = null;
        if (stmt.initializer) value = await this.evaluate(stmt.initializer);
        this.environment.define(stmt.name, value, stmt.mutable);
        break;
      }
      case 'Assignment': {
        const value = await this.evaluate(stmt.value);
        if (stmt.target.kind === 'Identifier') {
          this.environment.assign(stmt.target.name, value, stmt.target);
        } else if (stmt.target.kind === 'MemberExpr') {
          const obj = await this.evaluate(stmt.target.object);
          if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new RuntimeError(stmt.target, 'Only objects have properties.');
          (obj as Record<string, LythraValue>)[stmt.target.property] = value;
        } else if (stmt.target.kind === 'ComputedMemberExpr') {
          const obj = await this.evaluate(stmt.target.object);
          const property = await this.evaluate(stmt.target.property);
          if (Array.isArray(obj)) {
            if (typeof property !== 'number') throw new RuntimeError(stmt.target.property, 'Array index must be a number.');
            obj[property] = value;
          } else if (typeof obj === 'object' && obj !== null) {
            if (typeof property !== 'string') throw new RuntimeError(stmt.target.property, 'Object key must be a string.');
            (obj as Record<string, LythraValue>)[property] = value;
          } else {
            throw new RuntimeError(stmt.target, 'Only arrays and objects support bracket assignment.');
          }
        } else {
          throw new RuntimeError(stmt.target, 'Invalid assignment target.');
        }
        break;
      }
      case 'IfStatement': {
        if (this.isTruthy(await this.evaluate(stmt.condition))) {
          await this.executeBlock(stmt.body.statements, new Environment(this.environment));
        } else {
          let matched = false;
          for (const elseIf of stmt.elseIfs) {
            if (this.isTruthy(await this.evaluate(elseIf.condition))) {
              await this.executeBlock(elseIf.body.statements, new Environment(this.environment));
              matched = true;
              break;
            }
          }
          if (!matched && stmt.elseBody) {
            await this.executeBlock(stmt.elseBody.statements, new Environment(this.environment));
          }
        }
        break;
      }
      case 'WhileStatement': {
        while (this.isTruthy(await this.evaluate(stmt.condition))) {
          await this.executeBlock(stmt.body.statements, new Environment(this.environment));
        }
        break;
      }
      case 'ForStatement': {
        const iterable = await this.evaluate(stmt.iterable);
        if (!Array.isArray(iterable)) throw new RuntimeError(stmt.iterable, 'Can only iterate over arrays.');
        for (const item of iterable) {
          const loopEnv = new Environment(this.environment);
          loopEnv.define(stmt.variable, item, false);
          await this.executeBlock(stmt.body.statements, loopEnv);
        }
        break;
      }
      case 'ReturnStatement': {
        let value: LythraValue = null;
        if (stmt.value) value = await this.evaluate(stmt.value);
        throw new ReturnEx(value);
      }
      case 'ModifierBlock': {
        const modEnv = new Environment(this.environment);
        modEnv.modifier = stmt.modifier;
        // Modifiers also pass down cache context
        modEnv.cacheMode = this.isCacheEnabled();
        await this.executeBlock(stmt.body.statements, modEnv);
        break;
      }
      case 'RememberBlock': {
        const remEnv = new Environment(this.environment);
        remEnv.modifier = this.getActiveModifier();
        remEnv.cacheMode = true;
        await this.executeBlock(stmt.body.statements, remEnv);
        break;
      }
      case 'ForgetStatement': {
        if (stmt.target === 'all') {
          clearCache();
        } else {
          try {
            const val = await this.evaluate({ kind: 'Identifier', name: stmt.target, line: stmt.line, column: stmt.column } as any);
            clearCache(val as string);
          } catch (e) { }
        }
        break;
      }
      case 'AttemptStatement': {
        const attemptsVal = await this.evaluate(stmt.attempts);
        if (typeof attemptsVal !== 'number' || attemptsVal < 1 || !Number.isInteger(attemptsVal)) throw new RuntimeError(stmt.attempts, 'Attempt count must be a positive integer.');

        let success = false;
        let lastError: any = null;

        for (let i = 0; i < attemptsVal; i++) {
          try {
            await this.executeBlock(stmt.body.statements, new Environment(this.environment));
            success = true;
            break;
          } catch (e: any) {
            if (e instanceof ReturnEx || e instanceof HaltEx) throw e;
            if (e instanceof AssertionEx) { lastError = e; continue; }
            if (e instanceof RuntimeError && e.message.includes('Vision API')) { lastError = e; continue; }
            throw e;
          }
        }
        if (!success && stmt.fallback) {
          await this.executeBlock([stmt.fallback], new Environment(this.environment));
        }
        break;
      }
      case 'AssertStatement': {
        const condition = await this.evaluate(stmt.condition);
        if (!this.isTruthy(condition)) throw new AssertionEx(`Assertion failed.`);
        break;
      }
      case 'FnDeclaration':
      case 'PipelineDeclaration': {
        const fn = new LythraFunction(stmt, this.environment);
        this.environment.define(stmt.name, fn, false);
        break;
      }
      default:
        throw new Error(`Unexpected statement kind: ${(stmt as any).kind}`);
    }
  }

  public async evaluate(expr: ast.Expr): Promise<LythraValue> {
    switch (expr.kind) {
      case 'NumberLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NullLiteral':
        return 'value' in expr ? (expr as any).value : null;
      case 'Identifier':
        return this.environment.get(expr.name, expr);
      case 'GroupingExpr':
        return await this.evaluate(expr.expression);
      case 'ArrayLiteral': {
        const elements: LythraValue[] = [];
        for (const e of expr.elements) elements.push(await this.evaluate(e));
        return elements;
      }
      case 'ObjectLiteral': {
        const obj: Record<string, LythraValue> = {};
        for (const prop of expr.properties) obj[prop.key] = await this.evaluate(prop.value);
        return obj;
      }
      case 'MemberExpr': {
        const obj = await this.evaluate(expr.object);
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) throw new RuntimeError(expr.object, 'Only objects have properties.');
        return (obj as Record<string, LythraValue>)[expr.property] ?? null;
      }
      case 'ComputedMemberExpr': {
        const obj = await this.evaluate(expr.object);
        const property = await this.evaluate(expr.property);
        if (Array.isArray(obj)) {
          if (typeof property !== 'number') throw new RuntimeError(expr.property, 'Array index must be a number.');
          return obj[property] ?? null;
        } else if (typeof obj === 'object' && obj !== null) {
          if (typeof property !== 'string') throw new RuntimeError(expr.property, 'Object key must be a string.');
          return (obj as Record<string, LythraValue>)[property] ?? null;
        } else if (typeof obj === 'string') {
          if (typeof property !== 'number') throw new RuntimeError(expr.property, 'String index must be a number.');
          return obj[property] ?? null;
        }
        throw new RuntimeError(expr.object, 'Only arrays, objects, and strings support bracket properties.');
      }
      case 'UnaryExpr': {
        const right = await this.evaluate(expr.operand);
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
        const left = await this.evaluate(expr.left);
        if (expr.operator === 'or') {
          if (this.isTruthy(left)) return left;
          return await this.evaluate(expr.right);
        }
        if (expr.operator === 'and') {
          if (!this.isTruthy(left)) return left;
          return await this.evaluate(expr.right);
        }
        const right = await this.evaluate(expr.right);
        switch (expr.operator) {
          case '==': return left === right;
          case '!=': return left !== right;
          case '+':
            if (typeof left === 'number' && typeof right === 'number') return left + right;
            if (typeof left === 'string' || typeof right === 'string') return stringify(left) + stringify(right);
            throw new RuntimeError(expr, 'Operands must be numbers or strings.');
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
        const callee = await this.evaluate(expr.callee);
        const args: LythraValue[] = [];
        for (const argExpr of expr.args) args.push(await this.evaluate(argExpr));

        if (typeof callee === 'object' && callee !== null && !Array.isArray(callee) && 'call' in callee && typeof callee.call === 'function') {
          const callable = callee as LythraCallable;
          if (args.length !== callable.arity) throw new RuntimeError(expr, `Expected ${callable.arity} arguments but got ${args.length}.`);
          return await callable.call(this, args);
        } else {
          throw new RuntimeError(expr.callee, 'Can only call functions and pipelines.');
        }
      }
      case 'VisionExpr': {
        const promptVal = await this.evaluate(expr.prompt);
        let contextVal: LythraValue = null;
        if (expr.context) {
          contextVal = await this.evaluate(expr.context);
        }

        let seed: number | 'time' | undefined;
        if (expr.seed) {
          if (expr.seed.kind === 'Identifier' && expr.seed.name === 'time') {
            seed = 'time';
          } else {
            const evaluatedSeed = await this.evaluate(expr.seed);
            if (typeof evaluatedSeed === 'number') {
              seed = evaluatedSeed;
            }
          }
        }

        const modifier = this.getActiveModifier();
        const cacheEnabled = this.isCacheEnabled();

        // 1. Generate hash
        let hash = '';
        if (cacheEnabled) {
          hash = generateHash(String(promptVal), contextVal ? stringify(contextVal) : null, expr.typeAnnotation);
          const cached = getCache(hash);
          if (cached) {
            // Already parsed during last execution
            return JSON.parse(cached.response);
          }
        }

        const resultValue = await callVision(String(promptVal), {
          typeAnnotation: expr.typeAnnotation,
          context: contextVal,
          seed,
          modifier
        });

        // 2. Save hash if caching enabled
        if (cacheEnabled) {
          setCache(hash, JSON.stringify(resultValue));
        }

        return resultValue;
      }
      default:
        throw new Error(`Unexpected expression kind: ${(expr as any).kind}`);
    }
  }

  public async executeBlock(statements: readonly ast.Stmt[], environment: Environment): Promise<void> {
    const previous = this.environment;
    try {
      this.environment = environment;
      for (const stmt of statements) {
        await this.execute(stmt);
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
    return true;
  }

  private getActiveModifier(): 'precise' | 'fuzzy' | 'wild' | null {
    let env: Environment | null = this.environment;
    while (env !== null) {
      if (env.modifier !== null) return env.modifier;
      env = env.enclosing;
    }
    return null;
  }

  private isCacheEnabled(): boolean {
    let env: Environment | null = this.environment;
    while (env !== null) {
      if (env.cacheMode === true) return true;
      env = env.enclosing;
    }
    return false;
  }
}

class LythraFunction implements LythraCallable {
  public arity: number;

  constructor(
    private readonly declaration: ast.FnDeclaration | ast.PipelineDeclaration,
    private readonly closure: Environment
  ) {
    this.arity = declaration.params.length;
  }

  async call(interpreter: InterpreterInterface, args: LythraValue[]): Promise<LythraValue> {
    const environment = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      environment.define(this.declaration.params[i]!.name, args[i]!, true);
    }
    try {
      await interpreter.executeBlock(this.declaration.body.statements, environment);
    } catch (error) {
      if (error instanceof ReturnEx) return error.value;
      throw error;
    }
    return null;
  }

  toString(): string {
    return `<fn ${this.declaration.name}>`;
  }
}
