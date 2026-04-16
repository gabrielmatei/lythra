import * as readline from 'readline/promises';
import * as path from 'path';
import * as fs from 'fs';
import * as ast from '../parser/ast.js';
import { Environment } from './environment.js';
import { LythraValue, RuntimeError, ReturnEx, HaltEx, AssertionEx, InterpreterInterface, LythraCallable, stringify } from './types.js';
import { callVision } from '../llm/vision.js';
import { generateHash, getCache, setCache, clearCache } from '../llm/cache.js';
import { LythraServerManager } from './server.js';

export class Interpreter implements InterpreterInterface {
  public globals = new Environment();
  private environment = this.globals;

  // Pipeline Stream Handling
  private streamObservers: ((value: LythraValue) => void)[] = [];
  public serverManager = new LythraServerManager();

  // Callback injected by LythraRuntime to handle cross-file FS imports
  public onImport?: (path: string) => Promise<Record<string, LythraValue>>;

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

  public async initConfig(basePath: string): Promise<void> {
    const configPath = path.join(basePath, 'lythra.json');
    let configObj: Record<string, LythraValue> = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        configObj = JSON.parse(raw);
      } catch (e: any) {
        console.warn(`[Lythra] Failed to parse lythra.json: ${e.message}`);
      }
    }
    // Define `config` as a read-only global object
    this.globals.define('config', configObj, false);
  }

  async interpret(program: ast.Program): Promise<{ error?: string, runtimeError?: RuntimeError, halted?: boolean }> {
    try {
      for (const stmt of program.body) {
        await this.execute(stmt);
      }
      return {};
    } catch (error: any) {
      if (error instanceof HaltEx) return { halted: true };
      if (error instanceof RuntimeError) return { error: `[line ${error.node.line}] Runtime Error: ${error.message}`, runtimeError: error };
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

        if (stmt.destructuredNames) {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            throw new RuntimeError(stmt as any, 'Can only destructure objects.');
          }
          const rec = value as Record<string, LythraValue>;
          for (const name of stmt.destructuredNames) {
            this.environment.define(name, rec[name] ?? null, stmt.mutable);
          }
        } else {
          this.environment.define(stmt.name, value, stmt.mutable);
        }
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
      case 'MatchStatement': {
        const val = await this.evaluate(stmt.expression);
        let matched = false;

        for (const matchCase of stmt.cases) {
          let caseMatches = false;
          if (matchCase.pattern === null) {
            caseMatches = true; // _ default case
          } else {
            const patVal = await this.evaluate(matchCase.pattern);
            caseMatches = val === patVal;
          }

          if (caseMatches) {
            matched = true;
            if (matchCase.body.kind === 'Block') {
              await this.executeBlock(matchCase.body.statements, new Environment(this.environment));
            } else {
              await this.executeBlock([matchCase.body as ast.Stmt], new Environment(this.environment));
            }
            break;
          }
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
      case 'ParallelBlock': {
        const parEnv = new Environment(this.environment);
        // Run all statements concurrently. Each executes within its own isolated child environment 
        // to prevent sibling variables from randomly bleeding across parallel lines.
        const promises = stmt.body.statements.map(s => this.executeBlock([s], new Environment(parEnv)));
        await Promise.all(promises);
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
      case 'ServerDeclaration': {
        const portVal = await this.evaluate(stmt.port);
        if (typeof portVal !== 'number') throw new RuntimeError(stmt.port, "Server port must evaluate to a number.");
        this.serverManager.registerServer(stmt.name, portVal, stmt);
        break;
      }
      case 'OpenDoorsStatement': {
        await this.serverManager.openDoors(this);
        break;
      }
      case 'StopStatement': {
        await this.serverManager.stopServers();
        break;
      }
      case 'ExportStatement': {
        await this.execute(stmt.declaration);
        // Track exports globally if we need them, though typically the environment contains all top-level defs.
        // During imports, we pluck everything defined in the child environment.
        // For strict exports, we flag variables in the environment.
        const decl = stmt.declaration;
        if (decl.kind === 'VarDeclaration') {
          this.environment.markExported(decl.name);
        } else if (decl.kind === 'FnDeclaration' || decl.kind === 'PipelineDeclaration') {
          this.environment.markExported(decl.name);
        }
        break;
      }
      case 'TransmitStatement': {
        const __res = this.environment.getInternal('__res');
        if (!__res) throw new RuntimeError(stmt as unknown as ast.Expr, "Cannot transmit outside of a server channel context.");

        if (__res.writableEnded) break; // Do not throw, just break execution silently (or optionally throw)

        const payload = await this.evaluate(stmt.data);
        let status = 200;
        if (stmt.status) {
          const statusVal = await this.evaluate(stmt.status);
          if (typeof statusVal === 'number') status = statusVal;
        }

        let contentType = 'text/plain';
        let responseData = '';

        if (typeof payload === 'object' && payload !== null) {
          contentType = 'application/json';
          responseData = JSON.stringify(payload);
        } else {
          responseData = stringify(payload);
        }

        __res.writeHead(status, { 'Content-Type': contentType });
        __res.end(responseData);
        throw new HaltEx(payload); // Terminate the handler flow after transmit
      }
      case 'ReceiveStatement': {
        const __req = this.environment.getInternal('__req') as any;
        let __res = this.environment.getInternal('__res') as any;
        if (!__req) throw new RuntimeError(stmt as unknown as ast.Expr, "Cannot receive outside of a server channel context.");

        const getBody = async (req: any) => {
          return new Promise<string>((resolve, reject) => {
            let data = '';
            req.on('data', (chunk: string) => data += chunk);
            req.on('end', () => resolve(data));
            req.on('error', reject);
          });
        };

        const bodyStr = await getBody(__req);
        let parsed: any = bodyStr;

        if (stmt.format === 'json') {
          try {
            parsed = JSON.parse(bodyStr);
          } catch (e) {
            __res.writeHead(400, { 'Content-Type': 'text/plain' });
            __res.end('Bad Request - Invalid JSON Body');
            throw new HaltEx(null);
          }

          // Primitive Type Assertion via AST ObjectLiteral properties mapping
          if (stmt.expectedType) {
            for (const prop of stmt.expectedType.properties) {
              // VERY crude assert mappings
              const key = prop.key;
              if (!(key in parsed)) {
                __res.writeHead(400, { 'Content-Type': 'text/plain' });
                __res.end(`Bad Request - Missing field ${key}`);
                throw new HaltEx(null);
              }
              // Destructure directly into the environment
              this.environment.define(key, parsed[key], false);
            }
          } else if (stmt.destructuredNames) {
            // New destructured JSON array matching `receive body as { id, username }`
            for (const key of stmt.destructuredNames) {
              this.environment.define(key, parsed[key] ?? null, false);
            }
          } else if (stmt.variableName !== null) {
            this.environment.define(stmt.variableName, parsed, false);
          }
        } else {
          if (stmt.variableName !== null) {
            this.environment.define(stmt.variableName, parsed, false);
          }
        }

        break;
      }
      case 'InspectStatement': {
        const __req = this.environment.getInternal('__req') as any;
        if (!__req) throw new RuntimeError(stmt as unknown as ast.Expr, "Cannot inspect outside of a server channel context.");

        let sourceData: Record<string, string | undefined> = {};
        if (stmt.target === 'headers') {
          sourceData = __req.headers;
        } else if (stmt.target === 'params') {
          // Placeholder for URL params (requires router path parsing in server.ts)
          // For now, we'll extract query string as a fallback
          const urlObj = new URL(__req.url, `http://${__req.headers.host}`);
          for (const [key, value] of urlObj.searchParams.entries()) {
            sourceData[key] = value;
          }
          // We also merge __params if injected by server.ts router
          const __params = this.environment.getInternal('__params') as any;
          if (__params) {
            Object.assign(sourceData, __params);
          }
        }

        // Destructure into environment with null fallbacks
        for (const prop of stmt.expectedType.properties) {
          const key = prop.key;
          const value = sourceData[key.toLowerCase()] ?? sourceData[key] ?? null; // lowercase handles Node HTTP headers mostly
          this.environment.define(key, value, false);
        }
        break;
      }
      case 'ImportStatement': {
        if (!this.onImport) throw new RuntimeError(stmt as any, `Imports are not supported in this execution context.`);

        const importedModule = await this.onImport(stmt.path);

        if (stmt.alias) {
          // import "file.lth" as ns (object map)
          this.environment.define(stmt.alias, importedModule, false);
        } else {
          // inherit into flat namespace
          for (const [key, val] of Object.entries(importedModule)) {
            this.environment.define(key, val, false);
          }
        }
        break;
      }
      case 'EmitStatement': {
        const val = await this.evaluate(stmt.value);
        if (this.streamObservers.length > 0) {
          const currentObserver = this.streamObservers[this.streamObservers.length - 1];
          if (currentObserver) {
            await currentObserver(val);
          }
        }
        break;
      }
      case 'StreamBlock': {
        // Evaluate pipeline using a stream observer hook
        // stream StreamStory("prompt") as token: ...

        let loopHalt = false;
        const observer = async (val: LythraValue) => {
          if (loopHalt) return;
          const streamEnv = new Environment(this.environment);
          streamEnv.define(stmt.iteratorName, val, false);

          try {
            const previousEnv = this.environment;
            this.environment = streamEnv;
            // Execute loop body directly (non-blocking for the emit context, or blocking depending on flow)
            for (const bodyStmt of stmt.body.statements) {
              await this.execute(bodyStmt);
            }
            this.environment = previousEnv;
          } catch (e: any) {
            // Unhandled exceptions inside the stream block cancel the stream pipeline
            loopHalt = true;
            throw e;
          }
        };

        this.streamObservers.push(observer);
        try {
          // This evaluates the pipeline, triggering `emit` which fires the observer synchronously in our single thread
          await this.evaluate(stmt.pipelineCall);
        } finally {
          this.streamObservers.pop();
        }
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
      case 'InterpolatedStringExpr': {
        let result = '';
        for (const part of expr.parts) {
          if (typeof part === 'string') {
            result += part;
          } else {
            result += stringify(await this.evaluate(part));
          }
        }
        return result;
      }
      case 'EnvAccessExpr':
        return process.env as Record<string, any>;
      case 'ReadlineExpr': {
        const promptStr = stringify(await this.evaluate(expr.prompt));
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        const answer = await rl.question(promptStr);
        rl.close();
        return answer;
      }
      case 'FetchExpr': {
        const urlStr = stringify(await this.evaluate(expr.url));
        try {
          const res = await fetch(urlStr);
          if (!res.ok) throw new RuntimeError(expr, `Fetch failed with status ${res.status}`);
          if (expr.format === 'json') return await res.json();
          return await res.text();
        } catch (e: any) {
          throw new RuntimeError(expr, `Fetch failed: ${e.message}`);
        }
      }
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
      case 'NativePropertyExpr': {
        const obj = await this.evaluate(expr.object);
        if (Array.isArray(obj) || typeof obj === 'string') {
          if (expr.property === 'length') return obj.length;
        }
        throw new RuntimeError(expr.object, `Property '${expr.property}' is only available on arrays and strings.`);
      }
      case 'NativeMethodExpr': {
        const obj = await this.evaluate(expr.object);
        const arg = await this.evaluate(expr.argument);

        if (expr.method === 'contains') {
          if (Array.isArray(obj)) return obj.some(e => e === arg);
          if (typeof obj === 'string') return obj.includes(stringify(arg));
          throw new RuntimeError(expr.object, `'contains' is only available on arrays and strings.`);
        }

        if (expr.method === 'matches') {
          if (typeof obj !== 'string') throw new RuntimeError(expr.object, `'matches' is only available on strings.`);
          const regexStr = stringify(arg);
          try {
            const regex = new RegExp(regexStr);
            return regex.test(obj);
          } catch (e: any) {
            throw new RuntimeError(expr.argument, `Invalid regex: ${e.message}`);
          }
        }

        if (expr.method === 'starts with') {
          if (typeof obj !== 'string') throw new RuntimeError(expr.object, `'starts with' is only available on strings.`);
          return obj.startsWith(stringify(arg));
        }

        if (expr.method === 'ends with') {
          if (typeof obj !== 'string') throw new RuntimeError(expr.object, `'ends with' is only available on strings.`);
          return obj.endsWith(stringify(arg));
        }

        if (expr.method === 'map') {
          if (!Array.isArray(obj)) throw new RuntimeError(expr.object, `'map' is only available on arrays.`);
          if (!(arg instanceof LythraFunction)) throw new RuntimeError(expr.argument, `'map' argument must be a function.`);
          if (arg.arity !== 1) throw new RuntimeError(expr.argument, `'map' function must accept exactly 1 argument.`);

          const result: LythraValue[] = [];
          for (const item of obj) {
            result.push(await arg.call(this, [item]));
          }
          return result;
        }

        if (expr.method === 'filter') {
          if (!Array.isArray(obj)) throw new RuntimeError(expr.object, `'filter' is only available on arrays.`);
          if (!(arg instanceof LythraFunction)) throw new RuntimeError(expr.argument, `'filter' argument must be a function.`);
          if (arg.arity !== 1) throw new RuntimeError(expr.argument, `'filter' function must accept exactly 1 argument.`);

          const result: LythraValue[] = [];
          for (const item of obj) {
            const keep = await arg.call(this, [item]);
            if (this.isTruthy(keep)) {
              result.push(item);
            }
          }
          return result;
        }

        throw new RuntimeError(expr.object, `Unknown native method '${expr.method}'.`);
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
        if (expr.operator === 'await') {
          return await this.evaluate(expr.operand);
        }
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
          case '<':
            if (typeof left === 'number' && typeof right === 'number') return left < right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '>':
            if (typeof left === 'number' && typeof right === 'number') return left > right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '<=':
            if (typeof left === 'number' && typeof right === 'number') return left <= right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case '>=':
            if (typeof left === 'number' && typeof right === 'number') return left >= right;
            throw new RuntimeError(expr, 'Operands must be numbers.');
          case 'in':
            if (!Array.isArray(right) && typeof right !== 'string') {
              throw new RuntimeError(expr.right, "'in' operator requires an array or string on the right side.");
            }
            if (Array.isArray(right)) {
              return right.some(item => typeof left === typeof item && left === item);
            }
            return right.includes(stringify(left));
          default:
            throw new RuntimeError(expr, `Unknown binary operator '${expr.operator}'.`);
        }
      }
      case 'RangeExpr': {
        const start = await this.evaluate(expr.start);
        const end = await this.evaluate(expr.end);

        if (typeof start !== 'number' || typeof end !== 'number') {
          throw new RuntimeError(expr, 'Range bounds must evaluate to numbers.');
        }

        const arr: number[] = [];
        if (start <= end) {
          for (let i = start; i <= end; i++) arr.push(i);
        } else {
          // Count down cleanly
          for (let i = start; i >= end; i--) arr.push(i);
        }
        return arr;
      }
      case 'CallExpr': {
        const callee = await this.evaluate(expr.callee);
        const args: LythraValue[] = [];
        for (const argExpr of expr.args) args.push(await this.evaluate(argExpr));

        if (typeof callee === 'object' && callee !== null && !Array.isArray(callee) && 'call' in callee && typeof callee.call === 'function') {
          const callable = callee as LythraCallable;
          if (args.length !== callable.arity) throw new RuntimeError(expr, `Expected ${callable.arity} arguments but got ${args.length}.`);
          try {
            return await callable.call(this, args);
          } catch (e: any) {
            if (e instanceof RuntimeError) {
              const calleeName = expr.callee.kind === 'Identifier' ? expr.callee.name : stringify(callee);
              e.addTrace(calleeName, expr.line, expr.column);
            }
            throw e;
          }
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

        let mergedContext = contextVal;
        if (expr.secondaryContext) {
          const secondVal = await this.evaluate(expr.secondaryContext);
          // Combine primary and secondary contexts as a tuple string or object array if both exist
          if (mergedContext) {
            mergedContext = `[Context 1]:\n${stringify(mergedContext)}\n\n[Context 2]:\n${stringify(secondVal)}`;
          } else {
            mergedContext = secondVal;
          }
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
          context: mergedContext,
          seed,
          modifier,
          model: expr.modelOverride || (this.environment.getInternal('__model') as string | undefined),
          temperature: expr.temperatureOverride || undefined
        });

        // 2. Save hash if caching enabled
        if (cacheEnabled) {
          setCache(hash, JSON.stringify(resultValue));
        }

        return resultValue;
      }
      case 'ConsultExpr': {
        // consult is an explicit pipeline invocation modifier
        // e.g. consult Summarize("...")
        // Syntactically it just evaluates the underlying CallExpr
        try {
          return await this.evaluate(expr.pipeline);
        } catch (e: any) {
          // If we hit an error (e.g. Vision API error, halt, assertion fail) and have a fallback block, execute it instead!
          if (expr.fallback) {
            // Note: expr.fallback could be a block {} which evaluates as an ObjectLiteral or something similar depending on syntax.
            // Wait, we mapped fallback as an Expr. If they use a block {}, it's parsed as an ObjectLiteral.
            // If they use a function call, it's a CallExpr. Either way, evaluate it and return its value.
            return await this.evaluate(expr.fallback);
          }
          throw e; // Bubble up if no fallback specified
        }
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
    } catch (error: any) {
      if (error instanceof ReturnEx) return error.value;
      if (error instanceof RuntimeError) {
        error.addTrace(this.declaration.name, this.declaration.line, this.declaration.column);
      }
      throw error;
    }
    return null;
  }

  toString(): string {
    return `<fn ${this.declaration.name}>`;
  }
}
