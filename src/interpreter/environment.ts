import { LythraValue, RuntimeError } from './types.js';
import * as ast from '../parser/ast.js';

export class Environment {
  private readonly values = new Map<string, { value: LythraValue; mutable: boolean }>();

  constructor(public readonly enclosing: Environment | null = null) { }

  define(name: string, value: LythraValue, mutable: boolean): void {
    // In Lythra, we allow shadowing previously defined variables in the same scope
    // just like typical scripting languages, though we could be stricter later.
    this.values.set(name, { value, mutable });
  }

  get(name: string, node?: ast.Expr): LythraValue {
    if (this.values.has(name)) {
      return this.values.get(name)!.value;
    }

    if (this.enclosing !== null) {
      return this.enclosing.get(name, node);
    }

    throw new RuntimeError(node as ast.Expr, `Undefined variable '${name}'.`);
  }

  assign(name: string, value: LythraValue, node: ast.Expr): void {
    if (this.values.has(name)) {
      const current = this.values.get(name)!;
      if (!current.mutable) {
        throw new RuntimeError(node, `Cannot reassign to constant variable '${name}'.`);
      }
      current.value = value;
      return;
    }

    if (this.enclosing !== null) {
      this.enclosing.assign(name, value, node);
      return;
    }

    throw new RuntimeError(node, `Undefined variable '${name}'.`);
  }
}
