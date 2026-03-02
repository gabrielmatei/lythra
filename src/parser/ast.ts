// ─── AST Node Types ──────────────────────────────────────────────────────────
//
// Every node has a `kind` discriminant for exhaustive pattern matching.
// All fields are readonly — AST is immutable after construction.

// ─── Expressions ─────────────────────────────────────────────────────────────

export interface NumberLiteral {
  readonly kind: 'NumberLiteral';
  readonly value: number;
  readonly line: number;
  readonly column: number;
}

export interface StringLiteral {
  readonly kind: 'StringLiteral';
  readonly value: string;
  readonly line: number;
  readonly column: number;
}

export interface BooleanLiteral {
  readonly kind: 'BooleanLiteral';
  readonly value: boolean;
  readonly line: number;
  readonly column: number;
}

export interface NullLiteral {
  readonly kind: 'NullLiteral';
  readonly line: number;
  readonly column: number;
}

export interface Identifier {
  readonly kind: 'Identifier';
  readonly name: string;
  readonly line: number;
  readonly column: number;
}

export interface BinaryExpr {
  readonly kind: 'BinaryExpr';
  readonly left: Expr;
  readonly operator: string;
  readonly right: Expr;
  readonly line: number;
  readonly column: number;
}

export interface UnaryExpr {
  readonly kind: 'UnaryExpr';
  readonly operator: string;
  readonly operand: Expr;
  readonly line: number;
  readonly column: number;
}

export interface GroupingExpr {
  readonly kind: 'GroupingExpr';
  readonly expression: Expr;
  readonly line: number;
  readonly column: number;
}

export interface CallExpr {
  readonly kind: 'CallExpr';
  readonly callee: Expr;
  readonly args: readonly Expr[];
  readonly line: number;
  readonly column: number;
}

export interface MemberExpr {
  readonly kind: 'MemberExpr';
  readonly object: Expr;
  readonly property: string;
  readonly line: number;
  readonly column: number;
}

export interface ComputedMemberExpr {
  readonly kind: 'ComputedMemberExpr';
  readonly object: Expr;
  readonly property: Expr;
  readonly line: number;
  readonly column: number;
}

export interface ArrayLiteral {
  readonly kind: 'ArrayLiteral';
  readonly elements: readonly Expr[];
  readonly line: number;
  readonly column: number;
}

export interface ObjectLiteral {
  readonly kind: 'ObjectLiteral';
  readonly properties: readonly ObjectProperty[];
  readonly line: number;
  readonly column: number;
}

export interface ObjectProperty {
  readonly key: string;
  readonly value: Expr;
}

export interface VisionExpr {
  readonly kind: 'VisionExpr';
  readonly typeAnnotation: TypeAnnotation;
  readonly prompt: Expr;
  readonly context: Expr | null; // using/from
  readonly seed: Expr | null;
  readonly modifiers: readonly string[]; // reserved for inline modifiers if any exist
  readonly line: number;
  readonly column: number;
}

// ─── Expression Union ────────────────────────────────────────────────────────

export type Expr =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | GroupingExpr
  | CallExpr
  | MemberExpr
  | ComputedMemberExpr
  | ArrayLiteral
  | ObjectLiteral
  | VisionExpr;

// ─── Statements ──────────────────────────────────────────────────────────────

export interface VarDeclaration {
  readonly kind: 'VarDeclaration';
  readonly name: string;
  readonly mutable: boolean;
  readonly typeAnnotation: TypeAnnotation | null;
  readonly initializer: Expr;
  readonly line: number;
  readonly column: number;
}

export interface Assignment {
  readonly kind: 'Assignment';
  readonly target: Expr;
  readonly value: Expr;
  readonly line: number;
  readonly column: number;
}

export interface LogStatement {
  readonly kind: 'LogStatement';
  readonly expression: Expr;
  readonly line: number;
  readonly column: number;
}

export interface HaltStatement {
  readonly kind: 'HaltStatement';
  readonly expression: Expr;
  readonly line: number;
  readonly column: number;
}

export interface IfStatement {
  readonly kind: 'IfStatement';
  readonly condition: Expr;
  readonly body: Block;
  readonly elseIfs: readonly ElseIfClause[];
  readonly elseBody: Block | null;
  readonly line: number;
  readonly column: number;
}

export interface ElseIfClause {
  readonly condition: Expr;
  readonly body: Block;
}

export interface WhileStatement {
  readonly kind: 'WhileStatement';
  readonly condition: Expr;
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface ForStatement {
  readonly kind: 'ForStatement';
  readonly variable: string;
  readonly iterable: Expr;
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface ReturnStatement {
  readonly kind: 'ReturnStatement';
  readonly value: Expr | null;
  readonly line: number;
  readonly column: number;
}

export interface FnDeclaration {
  readonly kind: 'FnDeclaration';
  readonly name: string;
  readonly params: readonly Param[];
  readonly returnType: TypeAnnotation | null;
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface PipelineDeclaration {
  readonly kind: 'PipelineDeclaration';
  readonly name: string;
  readonly params: readonly Param[];
  readonly returnType: TypeAnnotation | null;
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface Block {
  readonly kind: 'Block';
  readonly statements: readonly Stmt[];
  readonly line: number;
  readonly column: number;
}

export interface ExpressionStatement {
  readonly kind: 'ExpressionStatement';
  readonly expression: Expr;
  readonly line: number;
  readonly column: number;
}

export interface ModifierBlock {
  readonly kind: 'ModifierBlock';
  readonly modifier: 'precise' | 'fuzzy' | 'wild';
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface RememberBlock {
  readonly kind: 'RememberBlock';
  readonly body: Block;
  readonly line: number;
  readonly column: number;
}

export interface ForgetStatement {
  readonly kind: 'ForgetStatement';
  readonly target: string; // "all" or variable name
  readonly line: number;
  readonly column: number;
}

export interface AttemptStatement {
  readonly kind: 'AttemptStatement';
  readonly attempts: Expr;
  readonly body: Block;
  readonly fallback: Stmt | null;
  readonly line: number;
  readonly column: number;
}

export interface AssertStatement {
  readonly kind: 'AssertStatement';
  readonly condition: Expr;
  readonly line: number;
  readonly column: number;
}

// ─── Statement Union ─────────────────────────────────────────────────────────

export type Stmt =
  | VarDeclaration
  | Assignment
  | LogStatement
  | HaltStatement
  | IfStatement
  | WhileStatement
  | ForStatement
  | ReturnStatement
  | FnDeclaration
  | PipelineDeclaration
  | ModifierBlock
  | RememberBlock
  | ForgetStatement
  | AttemptStatement
  | AssertStatement
  | ExpressionStatement;

// ─── Program (Root) ──────────────────────────────────────────────────────────

export interface Program {
  readonly kind: 'Program';
  readonly body: readonly Stmt[];
}

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface Param {
  readonly name: string;
  readonly type: TypeAnnotation | null;
}

// Simple type annotation — will be expanded in Phase 4 for vision<Type>
export type TypeAnnotation = string;

// In Lythra, type annotations can be literals (e.g. `vision<"spam" | "ok">`)
// For now, we store the full type string as parsed.
