# Determinism Controls

Lythra gives you explicit control over how predictable or creative LLM responses are. No hidden defaults — you declare the behavior.

## Modifier Blocks

Wrap any `vision` call in a modifier block to control the LLM's temperature:

### `precise` — Deterministic

Temperature is set to `0` and the seed is pinned. Same input always produces the same output. Ideal for classification and extraction tasks.

```lythra
precise:
  let category = vision<"spam" | "important" | "other">
    "classify this email"
    from email
```

### `fuzzy` — Balanced

Temperature is set to `0.7`. Some variation is allowed. Good for summaries and conversation.

```lythra
fuzzy:
  let summary = vision<String> "summarize this article" from text
```

### `wild` — Creative

Temperature is set to `1.2`. Maximum creativity. Use for poetry, brainstorming, or story generation.

```lythra
wild:
  let story = vision<String>
    "write a 1 sentence creative story about a robot learning to code"
```

## Seed Pinning

Pin a specific seed for reproducibility:

```lythra
let name = vision<String> "generate a fantasy character name" seed 42
```

## The `attempt` Block

Retry a `vision` call until an assertion passes. If all attempts fail, the `fallback` value is used.

```lythra
attempt 3 times:
  let price = vision<String> "extract the price from this text" from doc
  assert price matches "^\\$[\\d,.]+$"
fallback "$0.00"
```

### Numeric Assertions

```lythra
attempt 3 times:
  let num = vision<Int> "give me a random even integer between 1 and 20"
  assert num > 10
fallback -1
```

In each iteration, if the `assert` fails, Lythra automatically re-invokes the `vision` call. After exhausting all attempts, execution continues with the `fallback` value.

## Combining Modifiers with Attempts

You can nest modifier blocks inside `attempt` blocks:

```lythra
attempt 5 times:
  precise:
    let rating = vision<Int> "rate this essay 1-10" from essay
  assert rating >= 1
  assert rating <= 10
fallback 5
```
