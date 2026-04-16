// ─── Token Types ─────────────────────────────────────────────────────────────

export const enum TokenType {
  // ── Literals ──────────────────────────────────────────────────────────────
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  STRING_HEAD = 'STRING_HEAD',
  STRING_MID = 'STRING_MID',
  STRING_TAIL = 'STRING_TAIL',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',

  // ── Identifier ────────────────────────────────────────────────────────────
  IDENTIFIER = 'IDENTIFIER',

  // ── Keywords — Core Language ──────────────────────────────────────────────
  LET = 'LET',
  CONST = 'CONST',
  FN = 'FN',
  RETURN = 'RETURN',
  IF = 'IF',
  ELSE = 'ELSE',
  WHILE = 'WHILE',
  FOR = 'FOR',
  IN = 'IN',
  MATCH = 'MATCH',

  // ── Keywords — LLM Integration ────────────────────────────────────────────
  VISION = 'VISION',
  PRECISE = 'PRECISE',
  FUZZY = 'FUZZY',
  WILD = 'WILD',
  ATTEMPT = 'ATTEMPT',
  ASSERT = 'ASSERT',
  FALLBACK = 'FALLBACK',
  REMEMBER = 'REMEMBER',
  FORGET = 'FORGET',
  SEED = 'SEED',
  USING = 'USING',
  FROM = 'FROM',

  // ── Keywords — Pipeline & Flow ────────────────────────────────────────────
  PIPELINE = 'PIPELINE',
  // Phase 11 & Advanced flow
  CONSULT = 'CONSULT',
  STREAM = 'STREAM',
  PARALLEL = 'PARALLEL',
  AWAIT = 'AWAIT',
  EMIT = 'EMIT',

  // ── Keywords — Web Server ─────────────────────────────────────────────────
  SERVER = 'SERVER',
  CHANNEL = 'CHANNEL',
  ON = 'ON',
  CALL = 'CALL',
  TRANSMIT = 'TRANSMIT',
  RECEIVE = 'RECEIVE',
  INSPECT = 'INSPECT',
  FILTER = 'FILTER',
  OPEN = 'OPEN',
  DOORS = 'DOORS',
  STOP = 'STOP',

  // ── Keywords — Configuration & Meta ───────────────────────────────────────
  CONFIG = 'CONFIG',
  MODEL = 'MODEL',
  TEMPERATURE = 'TEMPERATURE',
  CACHE = 'CACHE',
  TIMEOUT = 'TIMEOUT',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',

  // ── Keywords — Misc ───────────────────────────────────────────────────────
  WITH = 'WITH',
  OR = 'OR',
  AND = 'AND',
  NOT = 'NOT',
  AS = 'AS',
  READLINE = 'READLINE',
  FETCH = 'FETCH',
  ENV = 'ENV',
  EACH = 'EACH',
  TOKEN = 'TOKEN',

  // ── Native ──────────────────────────────────────────────────────────────
  LOG = 'LOG',
  HALT = 'HALT',
  LENGTH = 'LENGTH',
  CONTAINS = 'CONTAINS',
  MATCHES = 'MATCHES',
  TIMES = 'TIMES',
  STARTS = 'STARTS',
  ENDS = 'ENDS',
  MAP = 'MAP',

  // ── Operators ─────────────────────────────────────────────────────────────
  EQUAL = 'EQUAL',
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  EQUAL_EQUAL = 'EQUAL_EQUAL',
  BANG_EQUAL = 'BANG_EQUAL',
  LESS = 'LESS',
  GREATER = 'GREATER',
  LESS_EQUAL = 'LESS_EQUAL',
  GREATER_EQUAL = 'GREATER_EQUAL',

  // ── Punctuation ───────────────────────────────────────────────────────────
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',
  COLON = 'COLON',
  COMMA = 'COMMA',
  DOT = 'DOT',
  DOT_DOT = 'DOT_DOT',
  ARROW = 'ARROW',
  PIPE = 'PIPE',

  // ── Structure ─────────────────────────────────────────────────────────────
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',
  EOF = 'EOF',
}

// ─── Token Interface ─────────────────────────────────────────────────────────

export interface Token {
  readonly type: TokenType;
  readonly lexeme: string;
  readonly literal: string | number | boolean | null;
  readonly line: number;
  readonly column: number;
}

// ─── Error Interface ─────────────────────────────────────────────────────────

export interface LythraError {
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly hint?: string;
}

// ─── Lexer Result ────────────────────────────────────────────────────────────

export interface LexerResult {
  readonly tokens: ReadonlyArray<Token>;
  readonly errors: ReadonlyArray<LythraError>;
}

// ─── Keyword Map ─────────────────────────────────────────────────────────────

export const KEYWORDS: ReadonlyMap<string, TokenType> = new Map<string, TokenType>([
  ['let', TokenType.LET],
  ['const', TokenType.CONST],
  ['fn', TokenType.FN],
  ['return', TokenType.RETURN],
  ['if', TokenType.IF],
  ['else', TokenType.ELSE],
  ['while', TokenType.WHILE],
  ['for', TokenType.FOR],
  ['in', TokenType.IN],
  ['match', TokenType.MATCH],
  ['true', TokenType.TRUE],
  ['false', TokenType.FALSE],
  ['null', TokenType.NULL],
  ['vision', TokenType.VISION],
  ['precise', TokenType.PRECISE],
  ['fuzzy', TokenType.FUZZY],
  ['wild', TokenType.WILD],
  ['attempt', TokenType.ATTEMPT],
  ['assert', TokenType.ASSERT],
  ['fallback', TokenType.FALLBACK],
  ['remember', TokenType.REMEMBER],
  ['forget', TokenType.FORGET],
  ['seed', TokenType.SEED],
  ['using', TokenType.USING],
  ['from', TokenType.FROM],
  ['pipeline', TokenType.PIPELINE],
  ['consult', TokenType.CONSULT],
  ['stream', TokenType.STREAM],
  ['parallel', TokenType.PARALLEL],
  ['await', TokenType.AWAIT],
  ['emit', TokenType.EMIT],
  ['server', TokenType.SERVER],
  ['channel', TokenType.CHANNEL],
  ['on', TokenType.ON],
  ['call', TokenType.CALL],
  ['transmit', TokenType.TRANSMIT],
  ['receive', TokenType.RECEIVE],
  ['inspect', TokenType.INSPECT],
  ['filter', TokenType.FILTER],
  ['open', TokenType.OPEN],
  ['doors', TokenType.DOORS],
  ['stop', TokenType.STOP],
  ['config', TokenType.CONFIG],
  ['model', TokenType.MODEL],
  ['temperature', TokenType.TEMPERATURE],
  ['cache', TokenType.CACHE],
  ['timeout', TokenType.TIMEOUT],
  ['import', TokenType.IMPORT],
  ['export', TokenType.EXPORT],
  ['log', TokenType.LOG],
  ['halt', TokenType.HALT],
  ['with', TokenType.WITH],
  ['times', TokenType.TIMES],
  ['or', TokenType.OR],
  ['and', TokenType.AND],
  ['not', TokenType.NOT],
  ['as', TokenType.AS],
  ['readline', TokenType.READLINE],
  ['fetch', TokenType.FETCH],
  ['env', TokenType.ENV],
  ['each', TokenType.EACH],
  ['token', TokenType.TOKEN],
  ['length', TokenType.LENGTH],
  ['contains', TokenType.CONTAINS],
  ['matches', TokenType.MATCHES],
  ['starts', TokenType.STARTS],
  ['ends', TokenType.ENDS],
  ['map', TokenType.MAP],
]);
