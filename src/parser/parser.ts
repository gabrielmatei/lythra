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
      // Eat trailing ignored tokens at global scope
      while (this.match(TokenType.NEWLINE, TokenType.DEDENT, TokenType.INDENT)) { }
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
    if (this.match(TokenType.SERVER)) return this.parseServerDeclaration();
    if (this.match(TokenType.CHANNEL)) return this.parseChannelDeclaration();
    if (this.match(TokenType.FILTER)) return this.parseFilterDeclaration();
    if (this.match(TokenType.ON)) return this.parseMethodHandler();
    if (this.match(TokenType.PRECISE, TokenType.FUZZY, TokenType.WILD)) return this.parseModifierBlock();
    if (this.match(TokenType.REMEMBER)) return this.parseRememberBlock();
    if (this.match(TokenType.FORGET)) return this.parseForgetStatement();
    if (this.match(TokenType.ATTEMPT)) return this.parseAttemptStatement();
    if (this.match(TokenType.ASSERT)) return this.parseAssertStatement();
    if (this.match(TokenType.OPEN)) return this.parseOpenDoorsStatement();
    if (this.match(TokenType.TRANSMIT)) return this.parseTransmitStatement();
    if (this.match(TokenType.RECEIVE)) return this.parseReceiveStatement();
    if (this.match(TokenType.INSPECT)) return this.parseInspectStatement();
    if (this.match(TokenType.STOP)) return this.parseStopStatement();
    if (this.match(TokenType.PARALLEL)) return this.parseParallelBlock();
    if (this.match(TokenType.IMPORT)) return this.parseImportStatement();
    if (this.match(TokenType.EXPORT)) return this.parseExportStatement();
    if (this.match(TokenType.EMIT)) return this.parseEmitStatement();
    if (this.match(TokenType.STREAM)) return this.parseStreamBlock();
    if (this.match(TokenType.MATCH)) return this.parseMatchStatement();

    return this.parseExpressionStatement();
  }

  private parseVarDeclaration(): ast.Stmt {
    const mutable = this.previous().type === TokenType.LET;

    let name = '';
    let destructuredNames: string[] | undefined = undefined;
    let line = 0;
    let column = 0;

    if (this.match(TokenType.LEFT_BRACE)) {
      destructuredNames = [];
      const braceTok = this.previous();
      line = braceTok.line;
      column = braceTok.column;

      do {
        const id = this.consume(TokenType.IDENTIFIER, 'Expected property name in destructuring.');
        destructuredNames.push(id.lexeme);
      } while (this.match(TokenType.COMMA));

      this.consume(TokenType.RIGHT_BRACE, "Expected '}' after destructured bindings.");
      name = `{${destructuredNames.join(', ')} } `;
    } else {
      const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected variable name.');
      name = nameToken.lexeme;
      line = nameToken.line;
      column = nameToken.column;
    }

    let typeAnnotation: ast.TypeAnnotation | null = null;
    if (this.match(TokenType.COLON)) {
      typeAnnotation = this.parseTypeAnnotation();
    }

    this.consume(TokenType.EQUAL, "Expected '=' after variable name.");
    const initializer = this.parseExpression();

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after variable declaration.');
    }

    return {
      kind: 'VarDeclaration',
      name,
      destructuredNames,
      mutable,
      typeAnnotation,
      initializer,
      line,
      column,
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

  private parseMatchStatement(): ast.Stmt {
    const start = this.previous();
    const expression = this.parseExpression();
    this.consume(TokenType.COLON, "Expected ':' after match expression.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    this.consume(TokenType.INDENT, "Expected indentation for match cases.");

    const cases: ast.MatchCase[] = [];

    while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
      while (this.match(TokenType.NEWLINE)) { } // skip blank lines
      if (this.check(TokenType.DEDENT)) break;

      let pattern: ast.Expr | null = null;
      if (this.match(TokenType.IDENTIFIER) && this.previous().lexeme === '_') {
        pattern = null; // Default case
      } else {
        pattern = this.parseExpression();
      }

      this.consume(TokenType.ARROW, "Expected '->' after match pattern.");

      let body: ast.Stmt | ast.Block;
      if (this.match(TokenType.NEWLINE)) {
        body = this.parseBlock();
      } else {
        body = this.parseStatement();
      }

      cases.push({ pattern, body });
      while (this.match(TokenType.NEWLINE)) { } // consume trailing
    }

    this.consume(TokenType.DEDENT, "Expected dedent after match block.");

    return {
      kind: 'MatchStatement',
      expression,
      cases,
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

  private parseParallelBlock(): ast.Stmt {
    const start = this.previous();

    this.consume(TokenType.COLON, "Expected ':' after 'parallel'.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");

    const body = this.parseBlock();

    return {
      kind: 'ParallelBlock',
      body,
      line: start.line,
      column: start.column,
    };
  }

  private parseImportStatement(): ast.Stmt {
    const start = this.previous();
    const path = this.consume(TokenType.STRING, "Expected string path after 'import'.").literal as string;
    let alias = null;

    if (this.match(TokenType.AS)) {
      alias = this.consume(TokenType.IDENTIFIER, "Expected identifier after 'as'.").lexeme;
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after import statement.');
    }

    return {
      kind: 'ImportStatement',
      path,
      alias,
      line: start.line,
      column: start.column
    };
  }

  private parseExportStatement(): ast.Stmt {
    const start = this.previous();
    const declaration = this.parseStatement();
    // ExportStatement wraps VarDecl, FnDecl, PipelineDecl etc.
    return {
      kind: 'ExportStatement',
      declaration,
      line: start.line,
      column: start.column
    };
  }

  private parseForgetStatement(): ast.Stmt {
    const start = this.previous();

    // Can be `forget all` or `forget ident`
    let target = '';
    if (this.match(TokenType.IDENTIFIER)) {
      if (this.previous().lexeme === 'all') {
        target = 'all';
      } else {
        target = this.previous().lexeme;
      }
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
      returnType = this.parseTypeAnnotation();
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
      returnType = this.parseTypeAnnotation();
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

  // ─── Phase 7: Web Server Parsing ───

  private parseServerDeclaration(): ast.Stmt {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, "Expected server name.");
    this.consume(TokenType.ON, "Expected 'on' before port number.");

    const port = this.parseExpression();

    this.consume(TokenType.COLON, "Expected ':' before server body.");
    this.consume(TokenType.NEWLINE, "Expected newline before server body.");

    const body = this.parseBlock();

    return {
      kind: 'ServerDeclaration',
      name: name.lexeme,
      port,
      body,
      line: start.line,
      column: start.column
    };
  }

  private parseChannelDeclaration(): ast.Stmt {
    const start = this.previous();
    let path = "/";
    if (this.match(TokenType.STRING)) {
      path = this.previous().lexeme.slice(1, -1); // strip quotes
    } else {
      throw this.error(this.peek(), "Expected string path after 'channel'.");
    }

    this.consume(TokenType.COLON, "Expected ':' before channel body.");
    this.consume(TokenType.NEWLINE, "Expected newline before channel body.");

    const body = this.parseBlock();

    return {
      kind: 'ChannelDeclaration',
      path,
      body,
      line: start.line,
      column: start.column
    };
  }

  private parseFilterDeclaration(): ast.Stmt {
    const start = this.previous();
    let pathPattern = "all";
    if (this.match(TokenType.IDENTIFIER) && this.previous().lexeme === "all") {
      pathPattern = "all";
    } else if (this.match(TokenType.STRING)) {
      pathPattern = this.previous().lexeme.slice(1, -1);
    } else {
      throw this.error(this.peek(), "Expected 'all' or string pattern after 'filter'.");
    }

    this.consume(TokenType.COLON, "Expected ':' before filter body.");
    this.consume(TokenType.NEWLINE, "Expected newline before filter body.");

    const body = this.parseBlock();

    return {
      kind: 'FilterDeclaration',
      pathPattern,
      body,
      line: start.line,
      column: start.column
    };
  }

  private parseMethodHandler(): ast.Stmt {
    const start = this.previous();
    this.consume(TokenType.CALL, "Expected 'call' after 'on'.");
    const methodToken = this.consume(TokenType.IDENTIFIER, "Expected HTTP method (GET, POST, etc.).");
    const method = methodToken.lexeme.toUpperCase();

    this.consume(TokenType.COLON, "Expected ':' before method body.");
    this.consume(TokenType.NEWLINE, "Expected newline before method body.");

    const body = this.parseBlock();

    return {
      kind: 'MethodHandler',
      method,
      body,
      line: start.line,
      column: start.column
    };
  }

  private parseOpenDoorsStatement(): ast.Stmt {
    const start = this.previous();
    this.consume(TokenType.DOORS, "Expected 'doors' after 'open'.");

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after open doors statement.');
    }

    return {
      kind: 'OpenDoorsStatement',
      line: start.line,
      column: start.column
    };
  }

  private parseTransmitStatement(): ast.Stmt {
    const start = this.previous();
    let status: ast.Expr | undefined = undefined;

    // Optional HTTP status code before payload
    if (this.check(TokenType.NUMBER)) {
      status = this.parseExpression();
    }

    const data = this.parseExpression();

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after transmit statement.');
    }

    return {
      kind: 'TransmitStatement',
      status,
      data,
      line: start.line,
      column: start.column
    };
  }

  private parseReceiveStatement(): ast.Stmt {
    const start = this.previous();
    if (this.match(TokenType.IDENTIFIER)) {
      if (this.previous().lexeme !== 'body') throw this.error(this.previous(), "Expected 'body' after 'receive'.");
    } else {
      throw this.error(this.peek(), "Expected 'body' after 'receive'.");
    }
    this.consume(TokenType.AS, "Expected 'as' after 'body'.");

    let format: 'text' | 'json' = 'json';
    let typeNode: ast.ObjectLiteral | undefined = undefined;
    let variableName: string | null = "text";
    let destructuredNames: string[] = [];

    if (this.match(TokenType.IDENTIFIER)) {
      if (this.previous().lexeme === "text") {
        format = "text";
        variableName = "text";
        if (this.match(TokenType.COLON)) {
          this.consume(TokenType.IDENTIFIER, "Expected 'String' after ':'.");
        }
      } else if (this.previous().lexeme === "json") {
        format = "json";
        variableName = "body";
      } else {
        // Assume it's a variable name for the whole body
        format = "json";
        variableName = this.previous().lexeme;
      }
    } else {
      // Must be an object literal for destructuring/schema
      format = "json";
      variableName = null;
      const expr = this.parseExpression();
      if (expr.kind === 'ObjectLiteral') {
        typeNode = expr;
        // Also populate destructuredNames for interpreter consistency if needed
        destructuredNames = expr.properties.map(p => p.key);
      } else {
        throw this.error(this.peek(), "Expected 'text', 'json', or object literal after 'as' in receive statement.");
      }
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after receive statement.');
    }

    return {
      kind: 'ReceiveStatement',
      format,
      variableName,
      destructuredNames: destructuredNames.length > 0 ? destructuredNames : undefined,
      expectedType: typeNode,
      line: start.line,
      column: start.column
    };
  }

  private parseInspectStatement(): ast.Stmt {
    const start = this.previous();
    let target: 'params' | 'headers' = 'params';

    if (this.match(TokenType.IDENTIFIER)) {
      if (this.previous().lexeme === 'params') {
        target = 'params';
      } else if (this.previous().lexeme === 'headers') {
        target = 'headers';
      } else {
        throw this.error(this.previous(), "Expected 'params' or 'headers' after 'inspect'.");
      }
    } else {
      throw this.error(this.peek(), "Expected 'params' or 'headers' after 'inspect'.");
    }

    this.consume(TokenType.AS, "Expected 'as' after target.");

    const expr = this.parseExpression();
    let expectedType: ast.ObjectLiteral;
    if (expr.kind === 'ObjectLiteral') {
      expectedType = expr;
    } else {
      throw this.error(this.peek(), "Expected object literal for inspect schema.");
    }

    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after inspect statement.');
    }

    return {
      kind: 'InspectStatement',
      target,
      expectedType,
      line: start.line,
      column: start.column
    };
  }

  private parseStopStatement(): ast.Stmt {
    const start = this.previous();
    if (!this.isAtEnd() && !this.check(TokenType.DEDENT)) {
      this.consume(TokenType.NEWLINE, 'Expected newline after stop statement.');
    }
    return {
      kind: 'StopStatement',
      line: start.line,
      column: start.column
    };
  }

  // ─── Helpers ───

  private parseParams(): ast.Param[] {
    const params: ast.Param[] = [];
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        const paramName = this.consume(TokenType.IDENTIFIER, "Expected parameter name.");
        let typeAnnotation: ast.TypeAnnotation | null = null;
        if (this.match(TokenType.COLON)) {
          typeAnnotation = this.parseTypeAnnotation();
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

  // ─── Type Annotation Parsing ───

  private parseTypeAnnotation(): ast.TypeAnnotation {
    let annotation: ast.TypeAnnotation;

    if (this.match(TokenType.STRING)) {
      // Union Enum parsing: "A" | "B" | "C"
      const variants = [this.previous().literal as string];
      while (this.match(TokenType.PIPE)) {
        const nextVariant = this.consume(TokenType.STRING, "Expected string literal in union type.");
        variants.push(nextVariant.literal as string);
      }
      annotation = {
        kind: 'UnionTypeAnnotation',
        variants
      };
    } else {
      // Identifier base type
      const identifier = this.consume(TokenType.IDENTIFIER, "Expected type name or string literal.");
      let base = identifier.lexeme;

      // Check for constraints: String(max: 100)
      if (this.match(TokenType.LEFT_PAREN)) {
        const constraints: Record<string, number> = {};
        if (!this.check(TokenType.RIGHT_PAREN)) {
          do {
            const constraintName = this.consume(TokenType.IDENTIFIER, "Expected constraint name (e.g., 'max', 'min').");
            this.consume(TokenType.COLON, "Expected ':' after constraint name.");
            const constraintValue = this.consume(TokenType.NUMBER, "Expected numeric literal for constraint.");
            constraints[constraintName.lexeme] = constraintValue.literal as number;
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RIGHT_PAREN, "Expected ')' after constraints.");
        annotation = {
          kind: 'ConstrainedTypeAnnotation',
          base,
          constraints
        };
      } else {
        annotation = {
          kind: 'PlainTypeAnnotation',
          name: base
        };
      }
    }

    // Array type suffix: []
    while (this.match(TokenType.LEFT_BRACKET)) {
      this.consume(TokenType.RIGHT_BRACKET, "Expected ']' after '[' in array type.");
      annotation = {
        kind: 'ArrayTypeAnnotation',
        element: annotation
      };
    }

    return annotation;
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
    let expr = this.parseRange();
    // Also use LESS and GREATER for angle brackets in expressions
    while (this.match(TokenType.LESS, TokenType.GREATER, TokenType.LESS_EQUAL, TokenType.GREATER_EQUAL, TokenType.IN)) {
      const operator = this.previous().lexeme;
      const right = this.parseRange();
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

  private parseRange(): ast.Expr {
    let expr = this.parseTerm();
    if (this.match(TokenType.DOT_DOT)) {
      const end = this.parseTerm();
      return {
        kind: 'RangeExpr',
        start: expr,
        end,
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
    if (this.match(TokenType.CONSULT)) {
      const token = this.previous();
      const pipelineExpr = this.parseCall(); // Usually an invocation like `Summarize(text)`
      return {
        kind: 'ConsultExpr',
        pipeline: pipelineExpr,
        args: [],
        fallback: null,
        line: token.line,
        column: token.column,
      };
    }
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
      } else if (this.match(TokenType.LENGTH)) {
        expr = {
          kind: 'NativePropertyExpr',
          object: expr,
          property: 'length',
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.CONSULT)) {
        const pipeline = this.parseExpression(); // This handles parsing right side of pipe 
        expr = {
          kind: 'ConsultExpr',
          pipeline,
          args: [],
          fallback: null,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.CONTAINS)) {
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'contains',
          argument,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.MATCHES)) {
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'matches',
          argument,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.STARTS)) {
        this.consume(TokenType.WITH, "Expected 'with' after 'starts'.");
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'starts with',
          argument,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.ENDS)) {
        this.consume(TokenType.WITH, "Expected 'with' after 'ends'.");
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'ends with',
          argument,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.MAP)) {
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'map',
          argument,
          line: expr.line,
          column: expr.column,
        };
      } else if (this.match(TokenType.FILTER)) {
        const argument = this.parseExpression();
        expr = {
          kind: 'NativeMethodExpr',
          object: expr,
          method: 'filter',
          argument,
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

    if (this.match(TokenType.STRING_HEAD)) {
      const start = this.previous();
      const parts: (string | ast.Expr)[] = [start.literal as string];

      while (!this.isAtEnd()) {
        parts.push(this.parseExpression());

        if (this.match(TokenType.STRING_MID)) {
          parts.push(this.previous().literal as string);
        } else if (this.match(TokenType.STRING_TAIL)) {
          parts.push(this.previous().literal as string);
          break;
        } else {
          throw this.error(this.peek(), `Expected '}' or proper string continuation.`);
        }
      }

      return { kind: 'InterpolatedStringExpr', parts, line: start.line, column: start.column };
    }

    if (this.match(TokenType.IDENTIFIER)) {
      return { kind: 'Identifier', name: this.previous().lexeme, line: this.previous().line, column: this.previous().column };
    }

    // Config is treated similarly to an environment/global access
    if (this.match(TokenType.CONFIG)) {
      return { kind: 'Identifier', name: 'config', line: this.previous().line, column: this.previous().column };
    }

    if (this.match(TokenType.ENV)) {
      return { kind: 'EnvAccessExpr', line: this.previous().line, column: this.previous().column };
    }

    if (this.match(TokenType.READLINE)) {
      const start = this.previous();
      const prompt = this.parseExpression();
      return { kind: 'ReadlineExpr', prompt, line: start.line, column: start.column };
    }

    if (this.match(TokenType.FETCH)) {
      const start = this.previous();
      const url = this.parseExpression();
      let format: 'text' | 'json' = 'text';
      if (this.match(TokenType.AS)) {
        if (this.match(TokenType.IDENTIFIER)) {
          if (this.previous().lexeme === 'text') {
            format = 'text';
          } else if (this.previous().lexeme === 'json') {
            format = 'json';
          } else {
            throw this.error(this.previous(), `Expected 'text' or 'json' after 'as' in fetch.`);
          }
        } else {
          throw this.error(this.peek(), `Expected 'text' or 'json' after 'as' in fetch.`);
        }
      }
      return { kind: 'FetchExpr', url, format, line: start.line, column: start.column };
    }

    // Phase 4: Vision Call
    if (this.match(TokenType.VISION)) {
      const start = this.previous();
      this.consume(TokenType.LESS, "Expected '<' after 'vision' for type annotation.");

      const typeAnnotation = this.parseTypeAnnotation();
      this.consume(TokenType.GREATER, "Expected '>' after type annotation.");

      const prompt = this.parseExpression(); // This should typically be a string literal, but we allow expressions for interpolation

      let context: ast.Expr | null = null;
      if (this.match(TokenType.FROM, TokenType.USING)) {
        context = this.parseExpression();
      }

      let secondaryContext: ast.Expr | null = null;
      if (this.match(TokenType.WITH)) {
        secondaryContext = this.parseExpression();
      }

      let modelOverride: string | null = null;
      if (this.match(TokenType.MODEL)) {
        modelOverride = this.consume(TokenType.STRING, "Expected string literal for model override.").literal as string;
      }

      // Note: temperature could be just a number identifier or a literal in some cases, but the spec says `temperature 1.0`.
      // The keyword 'temperature' is not yet in our token map! Let's just use IDENTIFIER 'temperature' for now to avoid re-mapping if we don't have to,
      // or we can add TEMPERATURE to keywords. Wait, we don't have TEMPERATURE in token.ts. 
      // Let's check if the identifier matches "temperature".
      let temperatureOverride: number | null = null;
      if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === 'temperature') {
        this.advance(); // consume 'temperature'
        temperatureOverride = this.consume(TokenType.NUMBER, "Expected number literal for temperature override.").literal as number;
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
        typeAnnotation,
        prompt,
        context,
        secondaryContext,
        modelOverride,
        temperatureOverride,
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

        let keyName = "";
        if (this.match(TokenType.IDENTIFIER, TokenType.STRING)) {
          keyName = this.previous().lexeme;
          if (this.previous().type === TokenType.STRING) {
            keyName = keyName.slice(1, -1);
          }
        } else {
          // Allow keywords as property names
          keyName = this.advance().lexeme;
        }

        let value: ast.Expr;
        if (this.match(TokenType.COLON)) {
          value = this.parseExpression();
        } else {
          // Shorthand: { id } => { id: id }
          value = {
            kind: 'Identifier',
            name: keyName,
            line: start.line, // best effort
            column: start.column,
          };
        }

        properties.push({
          key: keyName,
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



  private parseEmitStatement(): ast.Stmt {
    const start = this.previous();
    // emit each token
    if (this.match(TokenType.IDENTIFIER) && this.previous().lexeme === 'each') {
      // Ignore "each" keyword fluff optionally used in stream block tokens
    }
    const value = this.parseExpression();
    return {
      kind: 'EmitStatement',
      value,
      line: start.line,
      column: start.column
    };
  }

  private parseStreamBlock(): ast.Stmt {
    const start = this.previous();
    const pipelineCall = this.parseExpression(); // StreamStory(prompt)
    let iteratorName = 'token'; // default variable
    if (this.match(TokenType.AS)) {
      iteratorName = this.consume(TokenType.IDENTIFIER, "Expected identifier after 'as' in stream block.").lexeme;
    }
    this.consume(TokenType.COLON, "Expected ':' after stream expression.");
    this.consume(TokenType.NEWLINE, "Expected newline after ':'.");
    const body = this.parseBlock();
    // Assume blocks inside emit implicitly to loop scope
    return {
      kind: 'StreamBlock',
      pipelineCall,
      iteratorName,
      body,
      line: start.line,
      column: start.column
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
      ? `[line ${token.line}] Error at end: ${message} `
      : `[line ${token.line}] Error at '${token.lexeme}': ${message} `;

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
