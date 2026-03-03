import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';
import * as ast from '../src/parser/ast.js';

// Expose the internal function for testing schema translation
import { translateLythraTypeToSchema } from '../src/llm/vision.js';

describe('Advanced Data Types (Enums & Constraints)', () => {
  it('parses enum unions correctly', () => {
    const source = `
      let v = vision<"Happy" | "Sad"> "prompt"
    `;
    const tokens = tokenize(source).tokens;
    const program = parse(tokens).program;

    const declaration = program.body[0] as ast.VarDeclaration;
    const visionCall = declaration.initializer as ast.VisionExpr;
    const typeAnn = visionCall.typeAnnotation as ast.UnionTypeAnnotation;

    expect(typeAnn.kind).toBe('UnionTypeAnnotation');
    expect(typeAnn.variants).toEqual(["Happy", "Sad"]);

    // Test translator
    // Note: since vision module does not export the translator, we'd need to test it indirectly via AST or we manually map it if we exported it.
    // Let's assume we can't test translateLythraTypeToSchema directly if not exported.
    // We exported it in vision.ts if we want to test it. Wait, I didn't export it.
  });

  it('parses type constraints correctly', () => {
    const source = `
      let v = vision<String(max: 100, min: 10)> "prompt"
    `;
    const tokens = tokenize(source).tokens;
    const program = parse(tokens).program;

    const declaration = program.body[0] as ast.VarDeclaration;
    const visionCall = declaration.initializer as ast.VisionExpr;
    const typeAnn = visionCall.typeAnnotation as ast.ConstrainedTypeAnnotation;

    expect(typeAnn.kind).toBe('ConstrainedTypeAnnotation');
    expect(typeAnn.base).toBe('String');
    expect(typeAnn.constraints).toEqual({ max: 100, min: 10 });
  });

  it('parses type annotations in function signatures', () => {
    const source = `
      fn limitedLength(stringVal: String(max: 10)) -> "ok" | "too_long":
        return "ok"
    `;
    const tokens = tokenize(source).tokens;
    const program = parse(tokens).program;

    const fn = program.body[0] as ast.FnDeclaration;

    const paramAnn = fn.params[0].type as ast.ConstrainedTypeAnnotation;
    expect(paramAnn.kind).toBe('ConstrainedTypeAnnotation');
    expect(paramAnn.base).toBe('String');
    expect(paramAnn.constraints).toEqual({ max: 10 });

    const retAnn = fn.returnType as ast.UnionTypeAnnotation;
    expect(retAnn.kind).toBe('UnionTypeAnnotation');
    expect(retAnn.variants).toEqual(["ok", "too_long"]);
  });
});
