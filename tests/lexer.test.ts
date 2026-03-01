import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer/lexer.js';
import { TokenType } from '../src/lexer/token.js';

describe('Lexer', () => {
  it('tokenizes simple keywords and identifiers', () => {
    const { tokens, errors } = tokenize('let x = 10\nconst y = x');

    expect(errors).toHaveLength(0);
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.LET,
      TokenType.IDENTIFIER,
      TokenType.EQUAL,
      TokenType.NUMBER,
      TokenType.NEWLINE,
      TokenType.CONST,
      TokenType.IDENTIFIER,
      TokenType.EQUAL,
      TokenType.IDENTIFIER,
      TokenType.EOF,
    ]);
  });

  it('tokenizes numbers and floats', () => {
    const { tokens, errors } = tokenize('42 3.14 0 10.5');

    expect(errors).toHaveLength(0);
    expect(tokens.map(t => t.literal)).toEqual([
      42, 3.14, 0, 10.5, null
    ]);
  });

  it('tokenizes strings with escape sequences', () => {
    const { tokens, errors } = tokenize('"hello \\n world\\" "');

    expect(errors).toHaveLength(0);
    expect(tokens[0]!.type).toBe(TokenType.STRING);
    expect(tokens[0]!.literal).toBe('hello \n world" ');
  });

  it('reports unterminated strings', () => {
    const { tokens, errors } = tokenize('"unterminated\nstring"');

    expect(errors).not.toHaveLength(0);
    expect(errors[0]!.message).toContain('Unterminated');
  });

  it('tokenizes basic operators', () => {
    const { tokens, errors } = tokenize('+ - * / == != < > <= >= -> ..');

    expect(errors).toHaveLength(0);
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.PLUS,
      TokenType.MINUS,
      TokenType.STAR,
      TokenType.SLASH,
      TokenType.EQUAL_EQUAL,
      TokenType.BANG_EQUAL,
      TokenType.LESS,
      TokenType.GREATER,
      TokenType.LESS_EQUAL,
      TokenType.GREATER_EQUAL,
      TokenType.ARROW,
      TokenType.DOT_DOT,
      TokenType.EOF,
    ]);
  });

  it('handles indentation correctly (Python style)', () => {
    const code = `
config:
  model: "gpt-4o"
  cache: on

pipeline Greet(name: String) -> String:
  let result = vision<String> "say hello to {name}" warmly
  return result
`;
    const { tokens, errors } = tokenize(code);
    expect(errors).toHaveLength(0);

    // Quick check for INDENT/DEDENT match
    const indents = tokens.filter(t => t.type === TokenType.INDENT).length;
    const dedents = tokens.filter(t => t.type === TokenType.DEDENT).length;

    expect(indents).toBe(2);
    expect(dedents).toBe(2);
  });

  it('reports inconsistent indentation', () => {
    const code = `
if true:
    log "a"
  log "b"
`;
    const { errors } = tokenize(code);
    expect(errors).not.toHaveLength(0);
    expect(errors[0]!.message).toContain('Inconsistent indentation');
  });

  it('skips comments', () => {
    const { tokens, errors } = tokenize('let x = 10 # this is a comment\nlet y = 20');
    expect(errors).toHaveLength(0);

    // Ensure no comment token exists and NEWLINE is hit
    const types = tokens.map(t => t.type);
    expect(types).not.toContain('COMMENT');

    expect(types).toEqual([
      TokenType.LET,
      TokenType.IDENTIFIER,
      TokenType.EQUAL,
      TokenType.NUMBER,
      TokenType.NEWLINE,
      TokenType.LET,
      TokenType.IDENTIFIER,
      TokenType.EQUAL,
      TokenType.NUMBER,
      TokenType.EOF
    ]);
  });

  it('tokenizes LLM specific keywords', () => {
    const code = 'vision precise fuzzy wild attempt assert fallback remember forget seed using from consult stream parallel await emit';
    const { tokens, errors } = tokenize(code);
    expect(errors).toHaveLength(0);

    const expected = [
      TokenType.VISION, TokenType.PRECISE, TokenType.FUZZY, TokenType.WILD,
      TokenType.ATTEMPT, TokenType.ASSERT, TokenType.FALLBACK, TokenType.REMEMBER,
      TokenType.FORGET, TokenType.SEED, TokenType.USING, TokenType.FROM,
      TokenType.CONSULT, TokenType.STREAM, TokenType.PARALLEL, TokenType.AWAIT,
      TokenType.EMIT, TokenType.EOF
    ];

    expect(tokens.map(t => t.type)).toEqual(expected);
  });
});
