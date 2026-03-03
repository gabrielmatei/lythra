# Vision Calls

The `vision` call is the heartbeat of a Lythra program. It connects your code directly to a Large Language Model (LLM) while maintaining type safety.

## Basic Syntax

```lythra
vision<Type> "prompt" [modifier] [using/from expression]
```

### Type Constraints
The return value of a `vision` call is strictly typed. If the LLM returns anything that doesn't match the type, Lythra will handle it (e.g., retrying if in an `attempt` block).

```lythra
# Returns a Boolean
let isSpam = vision<Boolean> "is this email spam?" from emailText
```

## Determinism Modifiers

You control how creative or predictable the LLM is by using block modifiers:

- **`precise`**: `temp=0`, seed pinned. Ideal for classification or extraction.
- **`fuzzy`**: `temp=0.7`. Good for summaries and general conversation.
- **`wild`**: `temp=1.2`. Maximum creativity for poetry or brainstorming.

```lythra
precise:
  let category = vision<String> "classify this" from text
```

## Retry Loops with `attempt`

When you need an LLM to satisfy specific rules, use `attempt`.

```lythra
attempt 3 times:
  let answer = vision<String> "summarize in one sentence" from text
  assert answer length < 100
fallback "Error: Summary too long."
```

In an `attempt` block, Lythra will re-run the `vision` call if the `assert` fails, up to the specified limit.
