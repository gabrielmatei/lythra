# Error Handling

Lythra provides structured error handling at every level — from LLM retries to hard stops.

## `attempt` / `fallback`

The primary mechanism for handling unreliable LLM output. See [Determinism Controls](./determinism) for full details.

```lythra
attempt 3 times:
  let price = vision<String> "extract the price" from text
  assert price matches "^\\$[\\d,.]+$"
fallback "$0.00"
```

If all attempts fail, execution continues with the fallback value instead of crashing.

## `halt`

Stop execution immediately with an error message:

```lythra
if apiKey == null:
  halt "No API key configured. Set GEMINI_API_KEY in your environment."
```

`halt` terminates the entire program. It is useful for precondition checks.

## Pipeline Error Handling

When calling a pipeline with `consult`, you can provide a fallback for the entire pipeline:

```lythra
let result = consult Summarize(text) or fallback {
  summary: "unavailable",
  tags: []
}
```

## Runtime Errors

Runtime errors include:
- **Type mismatches** — e.g., trying to add a string and an array
- **Undefined variables** — referencing a name that hasn't been declared
- **Division by zero**
- **Circular imports** — detected automatically

All runtime errors include the source line, column number, and a stack trace for debugging:

```
[Runtime] Cannot divide by zero
  → line 12, column 15

  10 | let a = 100
  11 | let b = 0
> 12 | let result = a / b
  13 |
```
