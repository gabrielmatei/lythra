import {
  type Token,
  type LythraError,
  type LexerResult,
  TokenType,
  KEYWORDS,
} from './token.js';

// ─── Lexer ───────────────────────────────────────────────────────────────────

export function tokenize(source: string): LexerResult {
  const lexer = new Lexer(source);
  return lexer.scanTokens();
}

// ─── Internal Lexer Class ────────────────────────────────────────────────────

class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private readonly errors: LythraError[] = [];

  // ── Scanner state ───────────────────────────────────────────────────────
  private start = 0;        // start of current lexeme
  private current = 0;      // current position in source
  private line = 1;         // current line (1-indexed)
  private column = 1;       // current column (1-indexed)
  private startColumn = 1;  // column at start of current lexeme

  // ── Indentation state ──────────────────────────────────────────────────
  private readonly indentStack: number[] = [0];
  private atLineStart = true;

  constructor(source: string) {
    this.source = source;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  scanTokens(): LexerResult {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startColumn = this.column;

      if (this.atLineStart) {
        this.handleIndentation();
        if (this.atLineStart) continue; // blank line or comment line, loop again
        if (this.isAtEnd()) break;
        this.start = this.current;
        this.startColumn = this.column;
      }

      this.scanToken();
    }

    // Emit remaining DEDENTs at EOF
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      this.addToken(TokenType.DEDENT, '', null);
    }

    this.addToken(TokenType.EOF, '', null);

    return {
      tokens: this.tokens,
      errors: this.errors,
    };
  }

  // ── Indentation Handling ───────────────────────────────────────────────

  private handleIndentation(): void {
    let spaces = 0;
    while (!this.isAtEnd() && this.peek() === ' ') {
      this.advance();
      spaces++;
    }

    // Skip blank lines entirely (only whitespace then newline or EOF)
    if (this.isAtEnd() || this.peek() === '\n') {
      if (!this.isAtEnd()) {
        this.advance(); // consume the newline
      }
      // Stay at line start for the next line
      return;
    }

    // Skip comment-only lines
    if (this.peek() === '#') {
      this.skipComment();
      if (!this.isAtEnd() && this.peek() === '\n') {
        this.advance();
      }
      return;
    }

    // Tab check
    if (this.peek() === '\t') {
      this.addError(
        'Tabs are not allowed for indentation. Use spaces.',
        'Replace tabs with spaces (2 or 4 per indent level).',
      );
      // Skip the tab and continue
      this.advance();
      return;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1]!;

    if (spaces > currentIndent) {
      this.indentStack.push(spaces);
      this.addToken(TokenType.INDENT, '', null);
    } else if (spaces < currentIndent) {
      while (
        this.indentStack.length > 1 &&
        this.indentStack[this.indentStack.length - 1]! > spaces
      ) {
        this.indentStack.pop();
        this.addToken(TokenType.DEDENT, '', null);
      }

      if (this.indentStack[this.indentStack.length - 1] !== spaces) {
        this.addError(
          `Inconsistent indentation: expected ${this.indentStack[this.indentStack.length - 1]!} spaces, got ${spaces}.`,
          'Make sure your indentation matches a previous level.',
        );
      }
    }

    this.atLineStart = false;
  }

  // ── Main Token Scanner ─────────────────────────────────────────────────

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // ── Single-character tokens ───────────────────────────────────────
      case '(': this.addTokenFromLexeme(TokenType.LEFT_PAREN); break;
      case ')': this.addTokenFromLexeme(TokenType.RIGHT_PAREN); break;
      case '{': this.addTokenFromLexeme(TokenType.LEFT_BRACE); break;
      case '}': this.addTokenFromLexeme(TokenType.RIGHT_BRACE); break;
      case '[': this.addTokenFromLexeme(TokenType.LEFT_BRACKET); break;
      case ']': this.addTokenFromLexeme(TokenType.RIGHT_BRACKET); break;
      case ':': this.addTokenFromLexeme(TokenType.COLON); break;
      case ',': this.addTokenFromLexeme(TokenType.COMMA); break;
      case '+': this.addTokenFromLexeme(TokenType.PLUS); break;
      case '*': this.addTokenFromLexeme(TokenType.STAR); break;
      case '|': this.addTokenFromLexeme(TokenType.PIPE); break;

      // ── Dot or range ──────────────────────────────────────────────────
      case '.':
        if (this.match('.')) {
          this.addTokenFromLexeme(TokenType.DOT_DOT);
        } else {
          this.addTokenFromLexeme(TokenType.DOT);
        }
        break;

      // ── Minus or arrow ────────────────────────────────────────────────
      case '-':
        if (this.match('>')) {
          this.addTokenFromLexeme(TokenType.ARROW);
        } else {
          this.addTokenFromLexeme(TokenType.MINUS);
        }
        break;

      // ── Slash or comment ──────────────────────────────────────────────
      case '/': this.addTokenFromLexeme(TokenType.SLASH); break;

      // ── Operators with = variants ─────────────────────────────────────
      case '=':
        if (this.match('=')) {
          this.addTokenFromLexeme(TokenType.EQUAL_EQUAL);
        } else {
          this.addTokenFromLexeme(TokenType.EQUAL);
        }
        break;

      case '!':
        if (this.match('=')) {
          this.addTokenFromLexeme(TokenType.BANG_EQUAL);
        } else {
          this.addError(
            `Unexpected character '!'. Did you mean '!='?`,
            `Lythra uses 'not' for boolean negation and '!=' for inequality.`,
          );
        }
        break;

      case '<':
        if (this.match('=')) {
          this.addTokenFromLexeme(TokenType.LESS_EQUAL);
        } else {
          this.addTokenFromLexeme(TokenType.LESS);
        }
        break;

      case '>':
        if (this.match('=')) {
          this.addTokenFromLexeme(TokenType.GREATER_EQUAL);
        } else {
          this.addTokenFromLexeme(TokenType.GREATER);
        }
        break;

      // ── Comments ──────────────────────────────────────────────────────
      case '#':
        this.skipComment();
        break;

      // ── Whitespace ────────────────────────────────────────────────────
      case ' ':
      case '\r':
        // Ignore (non-leading whitespace is insignificant)
        break;

      case '\t':
        this.addError(
          'Tabs are not allowed. Use spaces for indentation.',
          'Replace tabs with spaces.',
        );
        break;

      // ── Newlines ──────────────────────────────────────────────────────
      case '\n':
        this.handleNewline();
        break;

      // ── Strings ───────────────────────────────────────────────────────
      case '"':
        this.readString();
        break;

      default:
        // ── Numbers ───────────────────────────────────────────────────
        if (isDigit(c)) {
          this.readNumber();
        }
        // ── Identifiers / Keywords ────────────────────────────────────
        else if (isAlpha(c)) {
          this.readIdentifier();
        }
        else {
          this.addError(
            `Unexpected character '${c}'.`,
          );
        }
        break;
    }
  }

  // ── Newline Handling ───────────────────────────────────────────────────

  private handleNewline(): void {
    // Only emit NEWLINE if there's a meaningful token before it
    // (avoids double newlines and leading newlines)
    if (this.tokens.length > 0) {
      const lastToken = this.tokens[this.tokens.length - 1]!;
      if (
        lastToken.type !== TokenType.NEWLINE &&
        lastToken.type !== TokenType.INDENT &&
        lastToken.type !== TokenType.DEDENT
      ) {
        this.addToken(TokenType.NEWLINE, '\\n', null);
      }
    }
    this.atLineStart = true;
  }

  // ── String Scanning ────────────────────────────────────────────────────

  private readString(): void {
    let value = '';

    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === '\n') {
        this.addError(
          'Unterminated string. Strings cannot span multiple lines.',
          'Close the string with a double quote before the end of the line.',
        );
        return;
      }

      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        if (this.isAtEnd()) {
          this.addError('Unterminated escape sequence at end of file.');
          return;
        }
        const escaped = this.advance();
        switch (escaped) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case '{': value += '{'; break;
          case '}': value += '}'; break;
          default:
            this.addError(
              `Unknown escape sequence '\\${escaped}'.`,
              `Valid escape sequences: \\n, \\t, \\\\, \\"`,
            );
            value += escaped;
            break;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.addError(
        'Unterminated string.',
        'Close the string with a double quote.',
      );
      return;
    }

    // Consume the closing "
    this.advance();

    const lexeme = this.source.slice(this.start, this.current);
    this.addToken(TokenType.STRING, lexeme, value);
  }

  // ── Number Scanning ────────────────────────────────────────────────────

  private readNumber(): void {
    while (!this.isAtEnd() && isDigit(this.peek())) {
      this.advance();
    }

    // Check for float
    if (
      !this.isAtEnd() &&
      this.peek() === '.' &&
      !this.isAtEnd() &&
      this.peekNext() !== undefined &&
      this.peekNext() !== '.' &&  // Don't consume `..` (range operator)
      isDigit(this.peekNext()!)
    ) {
      this.advance(); // consume the '.'
      while (!this.isAtEnd() && isDigit(this.peek())) {
        this.advance();
      }
    }

    const lexeme = this.source.slice(this.start, this.current);
    const value = Number(lexeme);
    this.addToken(TokenType.NUMBER, lexeme, value);
  }

  // ── Identifier / Keyword Scanning ──────────────────────────────────────

  private readIdentifier(): void {
    while (!this.isAtEnd() && isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const lexeme = this.source.slice(this.start, this.current);
    const keywordType = KEYWORDS.get(lexeme);

    if (keywordType !== undefined) {
      if (keywordType === TokenType.TRUE) {
        this.addToken(TokenType.TRUE, lexeme, true);
      } else if (keywordType === TokenType.FALSE) {
        this.addToken(TokenType.FALSE, lexeme, false);
      } else if (keywordType === TokenType.NULL) {
        this.addToken(TokenType.NULL, lexeme, null);
      } else {
        this.addToken(keywordType, lexeme, null);
      }
    } else {
      this.addToken(TokenType.IDENTIFIER, lexeme, null);
    }
  }

  // ── Comment Scanning ───────────────────────────────────────────────────

  private skipComment(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  // ── Character Helpers ──────────────────────────────────────────────────

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private peek(): string {
    return this.source[this.current]!;
  }

  private peekNext(): string | undefined {
    if (this.current + 1 >= this.source.length) return undefined;
    return this.source[this.current + 1];
  }

  private advance(): string {
    const c = this.source[this.current]!;
    this.current++;
    if (c === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return c;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source[this.current] !== expected) return false;
    this.advance();
    return true;
  }

  // ── Token Helpers ──────────────────────────────────────────────────────

  private addToken(
    type: TokenType,
    lexeme: string,
    literal: string | number | boolean | null,
  ): void {
    this.tokens.push({
      type,
      lexeme,
      literal,
      line: type === TokenType.NEWLINE ? this.line - 1 : this.line,
      column: this.startColumn,
    });
  }

  private addTokenFromLexeme(type: TokenType): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.addToken(type, lexeme, null);
  }

  // ── Error Helpers ──────────────────────────────────────────────────────

  private addError(message: string, hint?: string): void {
    this.errors.push({
      message,
      line: this.line,
      column: this.startColumn,
      hint,
    });
  }
}

// ─── Character Classification ────────────────────────────────────────────────

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isAlpha(c: string): boolean {
  return (c >= 'a' && c <= 'z') ||
    (c >= 'A' && c <= 'Z') ||
    c === '_';
}

function isAlphaNumeric(c: string): boolean {
  return isAlpha(c) || isDigit(c);
}
