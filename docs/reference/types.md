# Type System Reference

Lythra is optionally typed. Types are declared in `vision<Type>` calls and in function/pipeline signatures.

## Primitives

| Type | Description | Example |
|---|---|---|
| `String` | Textual data | `"hello world"` |
| `Int` | Integer numbers | `42` |
| `Float` | Decimal numbers | `3.14` |
| `Boolean` | True or false | `true` |
| `Null` | Empty value | `null` |

## Composite Types

| Type | Description | Example |
|---|---|---|
| `String[]` | Array of strings | `["a", "b"]` |
| `Int[]` | Array of integers | `[1, 2, 3]` |
| `Object` | Key-value map | `{ name: "Alex", age: 30 }` |

## Constrained Types

Used in `vision` calls to limit LLM output:

| Type | Description |
|---|---|
| `String(max: N)` | String with maximum length |
| `Float(min: N, max: N)` | Float within a numeric range |

```lythra
let summary = vision<String(max: 150)> "summarize in one sentence" from text
let score = vision<Float(min: 0, max: 1)> "rate confidence" from text
```

## Enum (Union) Types

Constrain LLM output to a fixed set of values:

```lythra
let mood = vision<"happy" | "sad" | "angry" | "neutral">
  "what mood is this?" from message
```

The runtime validates that the LLM's response matches one of the declared values.

## Type Annotations in Signatures

```lythra
fn add(a: Int, b: Int) -> Int:
  return a + b

pipeline Analyze(text: String) -> Object:
  # ...
```

## Type Coercion

When a `vision` call returns a raw text response, the interpreter coerces it to the target type:

| Target Type | Coercion |
|---|---|
| `String` | Used as-is |
| `Int` | Parsed as integer |
| `Float` | Parsed as float |
| `Boolean` | Parsed from `"true"` / `"false"` |
| `Object` | Parsed as JSON |
| `String[]`, `Int[]` | Parsed as JSON array |
| Enum | Validated against declared values |
