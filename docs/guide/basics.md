# Language Basics

Lythra is designed to be familiar yet powerful. It supports standard variable declarations, control flow, and functions, but adds special syntax for LLM integration.

## Variables

Use `let` for mutable variables and `const` for immutable ones.

```lythra
let counter = 0
const name = "Lythra"

counter = counter + 1
# name = "New Name" # This would error
```

## Types

Lythra is optionally typed. Types are declared after a colon or within angle brackets for vision calls.

| Type | Description |
|---|---|
| `String` | Textual data |
| `Int` | Integer numbers |
| `Float` | Decimal numbers |
| `Boolean` | `true` or `false` |
| `Null` | Represents nothing |

## Functions

Define pure helper functions with `fn`. These cannot make LLM calls.

```lythra
fn add(a: Int, b: Int) -> Int:
  return a + b

let sum = add(10, 20)
```

## Control Flow

Lythra supports standard `if`, `while`, and `for` loops.

```lythra
if score > 50:
  log "Pass"
else:
  log "Fail"

for i in 0..5:
  log i
```

In the next section, we'll cover the core feature: **Vision Calls**.
