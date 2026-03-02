import { Token, TokenType, LythraError } from '../lexer/token.js';
import * as ast from './ast.js';

export interface ParserResult {
  readonly program: ast.Program;
  readonly errors: readonly LythraError[];
}

export function parse(tokens: readonly Token[]): ParserResult {
  const parser = new Parser(tokens);
  return parser.parse();
}

class Parser {
  private readonly tokens: readonly Token[];
  private current = 0;
  private readonly errors: LythraError[] = [];

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  // ─── Entry Point ───────────────────────────────────────────────────────────

  parse(): ParserResult {
    const statements: ast.Stmt[] = [];

    // Skip leading newlines and dedents/indents that shouldn't be here
    while (this.match(TokenType.NEWLINE, TokenType.INDENT, TokenType.DEDENT)) { }

    while (!this.isAtEnd()) {
      try {
        statements.push(this.parseStatement());
      } catch (e) {
        if (e === 'ParseError') {
          this.synchronize();
        } else {
          throw e; // unexpected error
        }
      }
    }

    return {
      program: { kind: 'Program', body: statements },
      errors: this.errors,
    };
  }

  // ─── Statements (Stubbed for Part 1) ───────────────────────────────────────

  private parseStatement(): ast.Stmt {
    // Skip extra newlines
    while (this.match(TokenType.NEWLINE)) { }

    if (this.match(TokenType.LET, TokenType.CONST)) return this.parseVarDeclaration();
    if (this.match(TokenType.LOG)) return this.parseLogStatement();
    if (this.match(TokenType.HALT)) return this.parseHaltStatement();
    if (this.match(TokenType.IF)) return this.parseIfStatement();
    if (this.match(TokenType.WHILE)) return this.parseWhileStatement();
    if (this.match(TokenType.FOR)) return this.parseForStatement();
    if (this.match(TokenType.RETURN)) return this.parseReturnStatement();
    if (this.match(TokenType.FN)) return this.parseFnDeclaration();
    if (this.match(TokenType.PIPELINE)) return this.parsePipelineDeclaration();
    if (this.match(TokenType.PRECISE, TokenType.FUZZY, TokenType.WILD)) return this.parseModifierBlock();
    if (this.match(TokenType.REMEMBER)) return this.parseRememberBlock();
    if (this.match(TokenType.FORGET)) return this.parseForgetStatement();
    if (this.match(TokenType.ATTEMPT)) return this.parseAttemptStatement();
    if (this.match(TokenType.ASSERT)) return this.parseAssertStatement();

    return this.parseExpressionStatement();
  }

  private parseVarDeclaration(): ast.Stmt {
    const mutable = this.previous().type === TokenType.LET;
    const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected variable name.');

    let typeAnnotation: ast.TypeAnnotation | null = null;
    if (this.match(TokenType.COLON)) {
      let typeStr = this.consume(TokenType.IDENTIFIER, 'Expected type name.').lexeme;
      if (this.match(TokenType.LEFT_BRACKET)) {
        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array type.");
        typeStr += '[]';
      }
      typeAnnotation = typeStr;
    }

    this.consume(TokenType.EQUAL, "Expected '=' after variable name.");
    const initializer = this.parseExpression();

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after variable declaration.');
    }

    return {
      kind: 'VarDeclaration',
      name: nameToken.lexeme,
      mutable,
      typeAnnotation,
      initializer,
      line: nameToken.line,
      column: nameToken.column,
    };
  }

  private parseLogStatement(): ast.Stmt {
    const start = this.previous();
    const expression = this.parseExpression();

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after log statement.');
    }

    return {
      kind: 'LogStatement',
      expression,
      line: start.line,
      column: start.column,
    };
  }

  private parseHaltStatement(): ast.Stmt {
    const start = this.previous();

    let expression: ast.Expr;
    if (this.check(TokenType.NEWLINE) || this.check(TokenType.EOF) || this.check(TokenType.DEDENT)) {
      expression = { kind: 'NullLiteral', line: start.line, column: start.column };
    } else {
      expression = this.parseExpression();
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after halt statement.');
    }

    return {
      kind: 'HaltStatement',
      expression,
      line: start.line,
      column: start.column,
    };
  }

  private parseIfStatement(): ast.Stmt {
    const start = this.previous();
    const condition = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after if condition.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    const elseIfs: ast.ElseIfClause[] = [];
    while (this.match(TokenType.ELSE)) {
      if (this.match(TokenType.IF)) {
        const elseIfCondition = this.parseExpression();
        this.consume(TokenType.COLON, "Expected ':' after else if condition.");
        this.consume(TokenType.NEWLINE, "Expected newline after ':'.");
        const elseIfBody = this.parseBlock();
        elseIfs.push({ condition: elseIfCondition, body: elseIfBody });
      } else {
        this.consume(TokenType.COLON, "Expected ':' after else.");
        this.consume(TokenType.NEWLINE, "Expected newline after ':'.");
        const elseBody = this.parseBlock();
        return {
          kind: 'IfStatement',
          condition,
          body,
          elseIfs,
          elseBody,
          line: start.line,
          column: start.column,
        };
      }
    }

    return {
      kind: 'IfStatement',
      condition,
      body,
      elseIfs,
      elseBody: null,
      line: start.line,
      column: start.column,
    };
  }

  private parseWhileStatement(): ast.Stmt {
    const start = this.previous();
    const condition = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after while condition.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    return {
      kind: 'WhileStatement',
      condition,
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseForStatement(): ast.Stmt {
    const start = this.previous();
    const loopVar = this.consume(TokenType.IDENTIFIER, "Expected variable name after 'for'.");
    this.consume(TokenType.IN, "Expected 'in' after variable name.");
    const iterable = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after for iterable.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    return {
      kind: 'ForStatement',
      variable: loopVar.lexeme,
      iterable,
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseReturnStatement(): ast.Stmt {
    const start = this.previous();
    let value: ast.Expr | null = null;

    if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.DEDENT) && !this.check(TokenType.EOF)) {
      value = this.parseExpression();
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after return value.');
    }

    return {
      kind: 'ReturnStatement',
      value,
      line: start.line,
      column: start.column,
    };
  }

  private parseModifierBlock(): ast.Stmt {
    const modifierToken = this.previous();
    const modifierRaw = modifierToken.lexeme;

    let modifier: 'precise' | 'fuzzy' | 'wild';
    if (modifierRaw === 'precise' || modifierRaw === 'fuzzy' || modifierRaw === 'wild') {
      modifier = modifierRaw;
    } else {
      this.error(modifierToken, `Unknown determinism modifier '${modifierRaw}'.`);
      modifier = 'precise'; // fallback for typescript strictness
    }

    this.consume(TokenType.COLON, `Expected ':' after ${modifier} block.`);
    this.consume(TokenType.NEWLINE, `Expected newline after ':'.`);

    const body = this.parseBlock();

    return {
      kind: 'ModifierBlock',
      modifier,
      body,
      line: modifierToken.line,
      column: modifierToken.column,
    };
  }

  private parseRememberBlock(): ast.Stmt {
    const start = this.previous();
    this.consume(TokenType.COLON, "Expected ':' after 'remember'.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    return {
      kind: 'RememberBlock',
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseForgetStatement(): ast.Stmt {
    const start = this.previous();

    // Can be `forget all` or `forget ident`
    let target = '';
    if (this.match(TokenType.ALL)) {
      target = 'all';
    } else if (this.match(TokenType.IDENTIFIER)) {
      target = this.previous().lexeme;
    } else {
      throw this.error(this.peek(), "Expected 'all' or a variable name after 'forget'.");
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, "Expected newline after forget statement.");
    }

    return {
      kind: 'ForgetStatement',
      target,
      line: start.line,
      column: start.column,
    };
  }

  private parseAttemptStatement(): ast.Stmt {
    const start = this.previous();

    // Parse the attempt count (must evaluate to a number)
    const attempts = this.parseExpression();

    this.consume(TokenType.TIMES, "Expected 'times' after attempt count.");
    this.consume(TokenType.COLON, "Expected ':' after 'times'.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    let fallback: ast.Stmt | null = null;
    if (this.match(TokenType.FALLBACK)) {
      fallback = this.parseStatement();
    }

    return {
      kind: 'AttemptStatement',
      attempts,
      body,
      fallback,
      line: start.line,
      column: start.column,
    };
  }

  private parseAssertStatement(): ast.Stmt {
    const start = this.previous();
    const condition = this.parseExpression();

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, "Expected newline after assert statement.");
    }

    return {
      kind: 'AssertStatement',
      condition,
      line: start.line,
      column: start.column,
    };
  }

  private parseFnDeclaration(): ast.Stmt {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, "Expected function name.");
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after function name.");

    const params = this.parseParams();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters.");

    let returnType: ast.TypeAnnotation | null = null;
    if (this.match(TokenType.ARROW)) {
      returnType = this.consume(TokenType.IDENTIFIER, "Expected return type.").lexeme;
    }

    this.consume(TokenType.COLON, "Expected ':' before function body.");
    this.consume(TokenType.NEWLINE, "Expected newline before function body.");

    const body = this.parseBlock();

    return {
      kind: 'FnDeclaration',
      name: name.lexeme,
      params,
      returnType,
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parsePipelineDeclaration(): ast.Stmt {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, "Expected pipeline name.");
    this.consume(TokenType.LEFT_PAREN, "Expected '(' after pipeline name.");

    const params = this.parseParams();
    this.consume(TokenType.RIGHT_PAREN, "Expected ')' after parameters.");

    let returnType: ast.TypeAnnotation | null = null;
    if (this.match(TokenType.ARROW)) {
      returnType = this.consume(TokenType.IDENTIFIER, "Expected return type.").lexeme;
    }

    this.consume(TokenType.COLON, "Expected ':' before pipeline body.");
    this.consume(TokenType.NEWLINE, "Expected newline before pipeline body.");

    const body = this.parseBlock();

    return {
      kind: 'PipelineDeclaration',
      name: name.lexeme,
      params,
      returnType,
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseParams(): ast.Param[] {
    const params: ast.Param[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, "Expected parameter name.");
        let typeAnnotation: ast.TypeAnnotation | null = null;
        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.consume(TokenType.IDENTIFIER, "Expected parameter type.").lexeme;
        }
        params.push({ name: paramName.lexeme, type: typeAnnotation });
      } while (this.match(TokenType.COMMA));
    }
    return params;
  }

  private parseBlock(): ast.Block {
    const start = this.peek();

    if (!this.match(TokenType.INDENT)) {
      throw this.error(start, "Expected indentation for block.");
    }

    const statements: ast.Stmt[] = [];
    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      // skip blank lines if any made it here
      if (this.match(TokenType.NEWLINE)) continue;
      statements.push(this.parseStatement());
    }

    this.consume(TokenType.DEDENT, "Expected dedent after block.");

    return {
      kind: 'Block',
      statements,
      line: start.line,
      column: start.column,
    };
  }

  private parseExpressionStatement(): ast.Stmt {
    const expr = this.parseExpression();

    if (this.match(TokenType.EQUAL)) {
      const equals = this.previous();
      const value = this.parseExpression();

      if (expr.kind === 'Identifier' || expr.kind === 'MemberExpr' || expr.kind === 'ComputedMemberExpr') {
        if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
          this.consume(TokenType.NEWLINE, 'Expected newline after assignment.');
        }
        return {
          kind: 'Assignment',
          target: expr,
          value,
          line: equals.line,
          column: equals.column,
        };
      }
      this.error(equals, 'Invalid assignment target.');
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after statement.');
    }

    return {
      kind: 'ExpressionStatement',
      expression: expr,
      line: expr.line,
      column: expr.column,
    };
  }

  // ─── Expressions (Precedence Climbing) ─────────────────────────────────────

  private parseExpression(): ast.Expr {
    return this.parseOr();
  }

  private parseOr(): ast.Expr {
    let expr = this.parseAnd();
    while (this.match(TokenType.OR)) {
      const operator = this.previous().lexeme;
      const right = this.parseAnd();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseAnd(): ast.Expr {
    let expr = this.parseEquality();
    while (this.match(TokenType.AND)) {
      const operator = this.previous().lexeme;
      const right = this.parseEquality();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseEquality(): ast.Expr {
    let expr = this.parseComparison();
    while (this.match(TokenType.EQUAL_EQUAL, TokenType.BANG_EQUAL)) {
      const operator = this.previous().lexeme;
      const right = this.parseComparison();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseComparison(): ast.Expr {
    let expr = this.parseTerm();
    // Also use LESS and GREATER for angle brackets in expressions
    while (this.match(TokenType.LESS, TokenType.GREATER, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL)) {
      const operator = this.previous().lexeme;
      const right = this.parseTerm();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseTerm(): ast.Expr {
    let expr = this.parseFactor();
    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous().lexeme;
      const right = this.parseFactor();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseFactor(): ast.Expr {
    let expr = this.parseUnary();
    while (this.match(TokenType.STAR, TokenType.SLASH)) {
      const operator = this.previous().lexeme;
      const right = this.parseUnary();
      expr = {
        kind: 'BinaryExpr',
        left: expr,
        operator,
        right,
        line: expr.line,
        column: expr.column,
      };
    }
    return expr;
  }

  private parseUnary(): ast.Expr {
    if (this.match(TokenType.MINUS, TokenType.NOT)) {
      const token = this.previous();
      const operator = token.lexeme;
      const operand = this.parseUnary();
      return {
        kind: 'UnaryExpr',
        operator,
        operand,
        line: token.line,
        column: token.column,
      };
    }
    return this.parseCall();
  }

  private parseCall(): ast.Expr {
    let expr = this.parsePrimary();

    while (true) {
      if (this.match(TokenType.LEFT_PAREN)) {
        expr = this.finishCall(expr);
      } else if (this.match(TokenType.DOT)) {
        const name = this.consume(TokenType.IDENTIFIER, "Expected property name after '.'.");
        expr = {
          kind: 'MemberExpr',
          object: expr,
          property: name.lexeme,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.LEFT_BRACKET)) {
        const property = this.parseExpression();
        this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after computed property.");
        expr = {
          kind: 'ComputedMemberExpr',
          object: expr,
          property,
          line: expr.line,
          column: expr.column,
        };
      } else {
        break;
      }
    }

    return expr;
  }

  private finishCall(callee: ast.Expr): ast.Expr {
    const args: ast.Expr[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    const paren = this.consume(TokenType.RIGHT_PAREN, "Expected ')' after arguments.");

    return {
      kind: 'CallExpr',
      callee,
      args,
      line: callee.line,
      column: callee.column,
    };
  }

  private parsePrimary(): ast.Expr {
    if (this.match(TokenType.FALSE)) {
      return { kind: 'BooleanLiteral', value: false, line: this.previous().line, column: this.previous().column };
    }
    if (this.match(TokenType.TRUE)) {
      return { kind: 'BooleanLiteral', value: true, line: this.previous().line, column: this.previous().column };
    }
    if (this.match(TokenType.NULL)) {
      return { kind: 'NullLiteral', line: this.previous().line, column: this.previous().column };
    }
    if (this.match(TokenType.NUMBER)) {
      return { kind: 'NumberLiteral', value: this.previous().literal as number, line: this.previous().line, column: this.previous().column };
    }
    if (this.match(TokenType.STRING)) {
      return { kind: 'StringLiteral', value: this.previous().literal as string, line: this.previous().line, column: this.previous().column };
    }
    if (this.match(TokenType.IDENTIFIER)) {
      return { kind: 'Identifier', name: this.previous().lexeme, line: this.previous().line, column: this.previous().column };
    }

    // Phase 4: Vision Call
    if (this.match(TokenType.VISION)) {
      const start = this.previous();
      this.consume(TokenType.LESS, "Expected '<' after 'vision' for type annotation.");

      let typeAnnotation = '';
      // Very basic type parsing: could be `String`, `Int`, or `"spam" | "ok"`
      let bCount = 1;
      while (!this.isAtEnd() && bCount > 0) {
        if (this.check(TokenType.GREATER)) bCount--;
        if (this.check(TokenType.LESS)) bCount++;
        if (bCount > 0) {
          typeAnnotation += this.advance().lexeme;
        } else {
          this.advance(); // consume the >
        }
      }

      if (typeAnnotation.trim() === '') {
        this.error(start, "Expected type annotation after 'vision<'.");
      }

      const prompt = this.parseExpression(); // This should typically be a string literal, but we allow expressions for interpolation

      let context: ast.Expr | null = null;
      if (this.match(TokenType.FROM, TokenType.USING)) {
        context = this.parseExpression();
      }

      let seed: ast.Expr | null = null;
      if (this.match(TokenType.SEED)) {
        if (this.match(TokenType.IDENTIFIER) && this.previous().lexeme === 'time') {
          // Special literal for seed time
          seed = { kind: 'Identifier', name: 'time', line: this.previous().line, column: this.previous().column };
        } else {
          seed = this.parseExpression();
        }
      }

      return {
        kind: 'VisionExpr',
        typeAnnotation: typeAnnotation.trim(),
        prompt,
        context,
        seed,
        modifiers: [],
        line: start.line,
        column: start.column
      };
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const start = this.previous();
      const expr = this.parseExpression();
      this.consume(TokenType.RIGHT_PAREN, "Expected ')' after expression.");
      return { kind: 'GroupingExpr', expression: expr, line: start.line, column: start.column };
    }

    if (this.match(TokenType.LEFT_BRACKET)) {
      return this.parseArrayLiteral();
    }

    if (this.match(TokenType.LEFT_BRACE)) {
      return this.parseObjectLiteral();
    }

    throw this.error(this.peek(), 'Expected expression.');
  }

  private parseArrayLiteral(): ast.Expr {
    const start = this.previous();
    const elements: ast.Expr[] = [];

    // Arrays can span multiple lines, so we might need to skip newlines here
    // But for now, let's keep it simple standard list parsing
    if (!this.check(TokenType.RIGHT_BRACKET)) {
      do {
        while (this.match(TokenType.NEWLINE)) { } // skip newlines in arrays
        if (this.check(TokenType.RIGHT_BRACKET)) break; // trailing comma
        elements.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    while (this.match(TokenType.NEWLINE)) { } // skip newlines before closing ]
    this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after array elements.");

    return {
      kind: 'ArrayLiteral',
      elements,
      line: start.line,
      column: start.column,
    };
  }

  private parseObjectLiteral(): ast.Expr {
    const start = this.previous();
    const properties: ast.ObjectProperty[] = [];

    if (!this.check(TokenType.RIGHT_BRACE)) {
      do {
        while (this.match(TokenType.NEWLINE)) { } // skip newlines in objects
        if (this.check(TokenType.RIGHT_BRACE)) break; // trailing comma

        const nameToken = this.consume(TokenType.IDENTIFIER, "Expected property name.");
        this.consume(TokenType.COLON, "Expected ':' after property name.");
        const value = this.parseExpression();

        properties.push({
          key: nameToken.lexeme,
          value,
        });
      } while (this.match(TokenType.COMMA));
    }

    while (this.match(TokenType.NEWLINE)) { } // skip newlines before closing }
    this.consume(TokenType.RIGHT_BRACE, "Expected '}' after object properties.");

    return {
      kind: 'ObjectLiteral',
      properties,
      line: start.line,
      column: start.column,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): string {
    const msg = token.type === TokenType.EOF
      ? `[line ${token.line}] Error at end: ${message}`
      : `[line ${token.line}] Error at '${token.lexeme}': ${message}`;

    this.errors.push({
      message,
      line: token.line,
      column: token.column,
    });

    // We throw a primitive string instead of an Error object for lightweight unwinding
    return 'ParseError';
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.NEWLINE || this.previous().type === TokenType.DEDENT) return;

      switch (this.peek().type) {
        case TokenType.LET:
        case TokenType.CONST:
        case TokenType.FN:
        case TokenType.IF:
        case TokenType.WHILE:
        case TokenType.FOR:
        case TokenType.MATCH:
        case TokenType.RETURN:
        case TokenType.LOG:
        case TokenType.PIPELINE:
          return;
      }

      this.advance();
    }
  }
}
