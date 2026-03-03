# Caching & Memory

Lythra provides built-in caching for `vision` calls, so identical prompts don't hit the LLM API repeatedly.

## The `remember` Block

Wrap `vision` calls in a `remember` block to cache results by their prompt + context. The same input will always return the cached output after the first call.

```lythra
remember:
  let translation = vision<String> "translate to French" from text
```

### Example: Caching in Action

```lythra
forget all   # start clean

remember:
  # This call hits the LLM API
  let cached_1 = vision<String> "say the word 'Banana'"
  log cached_1

  # This returns INSTANTLY from cache
  let cached_2 = vision<String> "say the word 'Banana'"
  log cached_2
```

## Clearing the Cache

### `forget all`

Clear the entire cache:

```lythra
forget all
```

### `forget <variable>`

Clear a specific cached result:

```lythra
forget translation
```

## Global Cache via Configuration

You can enable caching globally in your `lythra.json`:

```json
{
  "cache": true
}
```

When `cache` is set to `true`, all `vision` calls behave as if they're inside a `remember` block.
