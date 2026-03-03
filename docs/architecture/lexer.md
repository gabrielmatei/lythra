# Lexer

The lexer (tokenizer) is the first stage of the Lythra execution pipeline. It converts raw source text into a stream of tokens.

## Responsibilities

- Recognize keywords, operators, literals, and identifiers
- Track line and column numbers for error reporting
- Handle string interpolation (`"hello {name}"`)
- Skip comments (`# ...`)
- Detect indentation for block structure

## Token Types

The lexer produces tokens defined in `src/lexer/token.ts`. Key categories include:

### Keywords
All Lythra reserved words: `let`, `const`, `fn`, `pipeline`, `vision`, `precise`, `fuzzy`, `wild`, `server`, `channel`, `import`, etc.

### Literals
- **String** — `"hello"` (with interpolation support)
- **Number** — `42`, `3.14`
- **Boolean** — `true`, `false`
- **Null** — `null`

### Operators & Punctuation
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `==`, `!=`, `>`, `>=`, `<`, `<=`
- Logical: `and`, `or`, `not`
- Structural: `(`, `)`, `[`, `]`, `{`, `}`, `:`, `,`, `.`
- Type annotations: `<`, `>`, `|`

## String Interpolation

When the lexer encounters a string like `"hello {name}"`, it produces an interpolated string token that contains both literal text segments and expression references. The parser later converts these into `InterpolatedStringExpr` AST nodes.

## Error Handling

The lexer collects errors (e.g., unterminated strings) without stopping. It returns both the token stream _and_ any errors, allowing the parser to attempt recovery or report all issues at once.

```typescript
const { tokens, errors } = tokenize(source);
```
