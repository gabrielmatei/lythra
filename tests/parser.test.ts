import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { parse } from '../src/parser/parser.js';
import * as ast from '../src/parser/ast.js';

function getAst(source: string) {
  const { tokens, errors: lexErrors } = tokenize(source);
  if (lexErrors.length > 0) throw new Error(`Lex errors: ${lexErrors.map(e => e.message).join(', ')}`);

  const { program, errors: parseErrors } = parse(tokens);
  if (parseErrors.length > 0) console.log("PARSE ERRORS:", parseErrors);
  return { program, parseErrors };
}

describe('Parser', () => {
  it('parses literal expressions', () => {
    const { program, parseErrors } = getAst('42\n"hello"\ntrue\nnull\n');
    expect(parseErrors).toHaveLength(0);

    expect((program.body[0] as ast.ExpressionStatement).expression.kind).toBe('NumberLiteral');
    expect((program.body[1] as ast.ExpressionStatement).expression.kind).toBe('StringLiteral');
    expect((program.body[2] as ast.ExpressionStatement).expression.kind).toBe('BooleanLiteral');
    expect((program.body[3] as ast.ExpressionStatement).expression.kind).toBe('NullLiteral');
  });

  it('parses binary expressions with precedence', () => {
    const { program, parseErrors } = getAst('1 + 2 * 3');
    expect(parseErrors).toHaveLength(0);

    const expr = (program.body[0] as ast.ExpressionStatement).expression as ast.BinaryExpr;
    expect(expr.operator).toBe('+');
    expect(expr.left.kind).toBe('NumberLiteral');

    const right = expr.right as ast.BinaryExpr;
    expect(right.operator).toBe('*');
    expect(right.left.kind).toBe('NumberLiteral');
  });

  it('parses unary and grouping', () => {
    const { program, parseErrors } = getAst('-(1 + 2)');
    expect(parseErrors).toHaveLength(0);

    const expr = (program.body[0] as ast.ExpressionStatement).expression as ast.UnaryExpr;
    expect(expr.operator).toBe('-');
    expect(expr.operand.kind).toBe('GroupingExpr');
  });

  it('parses variable declarations and assignments', () => {
    const { program, parseErrors } = getAst('let x: Int = 10\nx = 20\n');
    expect(parseErrors).toHaveLength(0);

    const decl = program.body[0] as ast.VarDeclaration;
    expect(decl.kind).toBe('VarDeclaration');
    expect(decl.name).toBe('x');
    expect(decl.mutable).toBe(true);
    expect(decl.typeAnnotation).toBe('Int');

    const assign = program.body[1] as ast.Assignment;
    expect(assign.kind).toBe('Assignment');
    expect((assign.target as ast.Identifier).name).toBe('x');
  });

  it('parses function calls and member access', () => {
    const { program, parseErrors } = getAst('math.abs(hello, 42)');
    expect(parseErrors).toHaveLength(0);

    const call = (program.body[0] as ast.ExpressionStatement).expression as ast.CallExpr;
    expect(call.kind).toBe('CallExpr');
    const callee = call.callee as ast.MemberExpr;
    expect(callee.property).toBe('abs');
    expect((callee.object as ast.Identifier).name).toBe('math');
    expect(call.args).toHaveLength(2);
  });

  it('parses arrays and objects', () => {
    const { program, parseErrors } = getAst('let arr = [1, 2]\nlet obj = { a: 1, b: 2 }');
    expect(parseErrors).toHaveLength(0);

    const arrDecl = program.body[0] as ast.VarDeclaration;
    expect(arrDecl.initializer.kind).toBe('ArrayLiteral');

    const objDecl = program.body[1] as ast.VarDeclaration;
    expect(objDecl.initializer.kind).toBe('ObjectLiteral');
  });

  it('parses if statements with else if and else', () => {
    const code = `
if x > 5:
  log "big"
else if x > 2:
  log "medium"
else:
  log "small"
`;
    const { program, parseErrors } = getAst(code);
    expect(parseErrors).toHaveLength(0);

    const ifStmt = program.body[0] as ast.IfStatement;
    expect(ifStmt.kind).toBe('IfStatement');
    expect(ifStmt.body.statements).toHaveLength(1);
    expect(ifStmt.elseIfs).toHaveLength(1);
    expect(ifStmt.elseBody!.statements).toHaveLength(1);
  });

  it('parses while and for loops', () => {
    const code = `
while count < 10:
  count = count + 1

for item in items:
  log item
`;
    const { program, parseErrors } = getAst(code);
    expect(parseErrors).toHaveLength(0);

    expect(program.body[0]!.kind).toBe('WhileStatement');
    expect(program.body[1]!.kind).toBe('ForStatement');
  });

  it('parses function and pipeline declarations', () => {
    const code = `
fn double(n: Int) -> Int:
  return n * 2

pipeline Greet(name: String) -> String:
  let result = "say hello"
  return result
`;
    const { program, parseErrors } = getAst(code);
    expect(parseErrors).toHaveLength(0);

    expect(program.body[0]!.kind).toBe('FnDeclaration');
    expect(program.body[1]!.kind).toBe('PipelineDeclaration');
  });

  it('recovers from errors', () => {
    const { program, parseErrors } = getAst('let x = \nlet y = 20');
    expect(parseErrors).not.toHaveLength(0);
    // Even with an error in the first statement, it should recover and parse the second
    expect(program.body.length).toBeGreaterThanOrEqual(1);
  });
});
