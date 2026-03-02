import { KEYWORDS, } from './token.js';
// ─── Lexer ───────────────────────────────────────────────────────────────────
export function tokenize(source) {
    const lexer = new Lexer(source);
    return lexer.scanTokens();
}
// ─── Internal Lexer Class ────────────────────────────────────────────────────
class Lexer {
    source;
    tokens = [];
    errors = [];
    // ── Scanner state ───────────────────────────────────────────────────────
    start = 0; // start of current lexeme
    current = 0; // current position in source
    line = 1; // current line (1-indexed)
    column = 1; // current column (1-indexed)
    startColumn = 1; // column at start of current lexeme
    // ── Indentation state ──────────────────────────────────────────────────
    indentStack = [0];
    atLineStart = true;
    constructor(source) {
        this.source = source;
    }
    // ── Public API ─────────────────────────────────────────────────────────
    scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.startColumn = this.column;
            if (this.atLineStart) {
                this.handleIndentation();
                if (this.atLineStart)
                    continue; // blank line or comment line, loop again
                if (this.isAtEnd())
                    break;
                this.start = this.current;
                this.startColumn = this.column;
            }
            this.scanToken();
        }
        // Emit remaining DEDENTs at EOF
        while (this.indentStack.length > 1) {
            this.indentStack.pop();
            this.addToken("DEDENT" /* TokenType.DEDENT */, '', null);
        }
        this.addToken("EOF" /* TokenType.EOF */, '', null);
        return {
            tokens: this.tokens,
            errors: this.errors,
        };
    }
    // ── Indentation Handling ───────────────────────────────────────────────
    handleIndentation() {
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
            this.addError('Tabs are not allowed for indentation. Use spaces.', 'Replace tabs with spaces (2 or 4 per indent level).');
            // Skip the tab and continue
            this.advance();
            return;
        }
        const currentIndent = this.indentStack[this.indentStack.length - 1];
        if (spaces > currentIndent) {
            this.indentStack.push(spaces);
            this.addToken("INDENT" /* TokenType.INDENT */, '', null);
        }
        else if (spaces < currentIndent) {
            while (this.indentStack.length > 1 &&
                this.indentStack[this.indentStack.length - 1] > spaces) {
                this.indentStack.pop();
                this.addToken("DEDENT" /* TokenType.DEDENT */, '', null);
            }
            if (this.indentStack[this.indentStack.length - 1] !== spaces) {
                this.addError(`Inconsistent indentation: expected ${this.indentStack[this.indentStack.length - 1]} spaces, got ${spaces}.`, 'Make sure your indentation matches a previous level.');
            }
        }
        this.atLineStart = false;
    }
    // ── Main Token Scanner ─────────────────────────────────────────────────
    scanToken() {
        const c = this.advance();
        switch (c) {
            // ── Single-character tokens ───────────────────────────────────────
            case '(':
                this.addTokenFromLexeme("LEFT_PAREN" /* TokenType.LEFT_PAREN */);
                break;
            case ')':
                this.addTokenFromLexeme("RIGHT_PAREN" /* TokenType.RIGHT_PAREN */);
                break;
            case '{':
                this.addTokenFromLexeme("LEFT_BRACE" /* TokenType.LEFT_BRACE */);
                break;
            case '}':
                this.addTokenFromLexeme("RIGHT_BRACE" /* TokenType.RIGHT_BRACE */);
                break;
            case '[':
                this.addTokenFromLexeme("LEFT_BRACKET" /* TokenType.LEFT_BRACKET */);
                break;
            case ']':
                this.addTokenFromLexeme("RIGHT_BRACKET" /* TokenType.RIGHT_BRACKET */);
                break;
            case ':':
                this.addTokenFromLexeme("COLON" /* TokenType.COLON */);
                break;
            case ',':
                this.addTokenFromLexeme("COMMA" /* TokenType.COMMA */);
                break;
            case '+':
                this.addTokenFromLexeme("PLUS" /* TokenType.PLUS */);
                break;
            case '*':
                this.addTokenFromLexeme("STAR" /* TokenType.STAR */);
                break;
            case '|':
                this.addTokenFromLexeme("PIPE" /* TokenType.PIPE */);
                break;
            // ── Dot or range ──────────────────────────────────────────────────
            case '.':
                if (this.match('.')) {
                    this.addTokenFromLexeme("DOT_DOT" /* TokenType.DOT_DOT */);
                }
                else {
                    this.addTokenFromLexeme("DOT" /* TokenType.DOT */);
                }
                break;
            // ── Minus or arrow ────────────────────────────────────────────────
            case '-':
                if (this.match('>')) {
                    this.addTokenFromLexeme("ARROW" /* TokenType.ARROW */);
                }
                else {
                    this.addTokenFromLexeme("MINUS" /* TokenType.MINUS */);
                }
                break;
            // ── Slash or comment ──────────────────────────────────────────────
            case '/':
                this.addTokenFromLexeme("SLASH" /* TokenType.SLASH */);
                break;
            // ── Operators with = variants ─────────────────────────────────────
            case '=':
                if (this.match('=')) {
                    this.addTokenFromLexeme("EQUAL_EQUAL" /* TokenType.EQUAL_EQUAL */);
                }
                else {
                    this.addTokenFromLexeme("EQUAL" /* TokenType.EQUAL */);
                }
                break;
            case '!':
                if (this.match('=')) {
                    this.addTokenFromLexeme("BANG_EQUAL" /* TokenType.BANG_EQUAL */);
                }
                else {
                    this.addError(`Unexpected character '!'. Did you mean '!='?`, `Lythra uses 'not' for boolean negation and '!=' for inequality.`);
                }
                break;
            case '<':
                if (this.match('=')) {
                    this.addTokenFromLexeme("LESS_EQUAL" /* TokenType.LESS_EQUAL */);
                }
                else {
                    this.addTokenFromLexeme("LESS" /* TokenType.LESS */);
                }
                break;
            case '>':
                if (this.match('=')) {
                    this.addTokenFromLexeme("GREATER_EQUAL" /* TokenType.GREATER_EQUAL */);
                }
                else {
                    this.addTokenFromLexeme("GREATER" /* TokenType.GREATER */);
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
                this.addError('Tabs are not allowed. Use spaces for indentation.', 'Replace tabs with spaces.');
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
                    this.addError(`Unexpected character '${c}'.`);
                }
                break;
        }
    }
    // ── Newline Handling ───────────────────────────────────────────────────
    handleNewline() {
        // Only emit NEWLINE if there's a meaningful token before it
        // (avoids double newlines and leading newlines)
        if (this.tokens.length > 0) {
            const lastToken = this.tokens[this.tokens.length - 1];
            if (lastToken.type !== "NEWLINE" /* TokenType.NEWLINE */ &&
                lastToken.type !== "INDENT" /* TokenType.INDENT */ &&
                lastToken.type !== "DEDENT" /* TokenType.DEDENT */) {
                this.addToken("NEWLINE" /* TokenType.NEWLINE */, '\\n', null);
            }
        }
        this.atLineStart = true;
    }
    // ── String Scanning ────────────────────────────────────────────────────
    readString() {
        let value = '';
        while (!this.isAtEnd() && this.peek() !== '"') {
            if (this.peek() === '\n') {
                this.addError('Unterminated string. Strings cannot span multiple lines.', 'Close the string with a double quote before the end of the line.');
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
                    case 'n':
                        value += '\n';
                        break;
                    case 't':
                        value += '\t';
                        break;
                    case '\\':
                        value += '\\';
                        break;
                    case '"':
                        value += '"';
                        break;
                    case '{':
                        value += '{';
                        break;
                    case '}':
                        value += '}';
                        break;
                    default:
                        this.addError(`Unknown escape sequence '\\${escaped}'.`, `Valid escape sequences: \\n, \\t, \\\\, \\"`);
                        value += escaped;
                        break;
                }
            }
            else {
                value += this.advance();
            }
        }
        if (this.isAtEnd()) {
            this.addError('Unterminated string.', 'Close the string with a double quote.');
            return;
        }
        // Consume the closing "
        this.advance();
        const lexeme = this.source.slice(this.start, this.current);
        this.addToken("STRING" /* TokenType.STRING */, lexeme, value);
    }
    // ── Number Scanning ────────────────────────────────────────────────────
    readNumber() {
        while (!this.isAtEnd() && isDigit(this.peek())) {
            this.advance();
        }
        // Check for float
        if (!this.isAtEnd() &&
            this.peek() === '.' &&
            !this.isAtEnd() &&
            this.peekNext() !== undefined &&
            this.peekNext() !== '.' && // Don't consume `..` (range operator)
            isDigit(this.peekNext())) {
            this.advance(); // consume the '.'
            while (!this.isAtEnd() && isDigit(this.peek())) {
                this.advance();
            }
        }
        const lexeme = this.source.slice(this.start, this.current);
        const value = Number(lexeme);
        this.addToken("NUMBER" /* TokenType.NUMBER */, lexeme, value);
    }
    // ── Identifier / Keyword Scanning ──────────────────────────────────────
    readIdentifier() {
        while (!this.isAtEnd() && isAlphaNumeric(this.peek())) {
            this.advance();
        }
        const lexeme = this.source.slice(this.start, this.current);
        const keywordType = KEYWORDS.get(lexeme);
        if (keywordType !== undefined) {
            if (keywordType === "TRUE" /* TokenType.TRUE */) {
                this.addToken("TRUE" /* TokenType.TRUE */, lexeme, true);
            }
            else if (keywordType === "FALSE" /* TokenType.FALSE */) {
                this.addToken("FALSE" /* TokenType.FALSE */, lexeme, false);
            }
            else if (keywordType === "NULL" /* TokenType.NULL */) {
                this.addToken("NULL" /* TokenType.NULL */, lexeme, null);
            }
            else {
                this.addToken(keywordType, lexeme, null);
            }
        }
        else {
            this.addToken("IDENTIFIER" /* TokenType.IDENTIFIER */, lexeme, null);
        }
    }
    // ── Comment Scanning ───────────────────────────────────────────────────
    skipComment() {
        while (!this.isAtEnd() && this.peek() !== '\n') {
            this.advance();
        }
    }
    // ── Character Helpers ──────────────────────────────────────────────────
    isAtEnd() {
        return this.current >= this.source.length;
    }
    peek() {
        return this.source[this.current];
    }
    peekNext() {
        if (this.current + 1 >= this.source.length)
            return undefined;
        return this.source[this.current + 1];
    }
    advance() {
        const c = this.source[this.current];
        this.current++;
        if (c === '\n') {
            this.line++;
            this.column = 1;
        }
        else {
            this.column++;
        }
        return c;
    }
    match(expected) {
        if (this.isAtEnd())
            return false;
        if (this.source[this.current] !== expected)
            return false;
        this.advance();
        return true;
    }
    // ── Token Helpers ──────────────────────────────────────────────────────
    addToken(type, lexeme, literal) {
        this.tokens.push({
            type,
            lexeme,
            literal,
            line: type === "NEWLINE" /* TokenType.NEWLINE */ ? this.line - 1 : this.line,
            column: this.startColumn,
        });
    }
    addTokenFromLexeme(type) {
        const lexeme = this.source.slice(this.start, this.current);
        this.addToken(type, lexeme, null);
    }
    // ── Error Helpers ──────────────────────────────────────────────────────
    addError(message, hint) {
        this.errors.push({
            message,
            line: this.line,
            column: this.startColumn,
            hint,
        });
    }
}
// ─── Character Classification ────────────────────────────────────────────────
function isDigit(c) {
    return c >= '0' && c <= '9';
}
function isAlpha(c) {
    return (c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        c === '_';
}
function isAlphaNumeric(c) {
    return isAlpha(c) || isDigit(c);
}
//# sourceMappingURL=lexer.js.map