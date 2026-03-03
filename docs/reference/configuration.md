# Configuration Reference

Lythra reads global defaults from a `lythra.json` file in the current working directory.

## Schema

```json
{
  "model": "gpt-4o",
  "cache": true,
  "timeout": 30
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `model` | `string` | `"gemini-2.5-flash"` | LLM model to use for `vision` calls |
| `cache` | `boolean` | `false` | Enable global caching for all `vision` calls |
| `timeout` | `number` | — | Max seconds before a vision call times out |

## Loading Behavior

The CLI loads `lythra.json` from `process.cwd()` before executing any script. If the file does not exist, defaults are used.

## Module Inheritance

When a module is imported, the child runtime inherits the parent's config values (model, cache, timeout). This ensures consistent behavior across module boundaries.

## Per-Call Overrides

Individual `vision` calls can override global settings inline:

```lythra
let result = vision<String> "write a haiku" model "gpt-3.5-turbo" temperature 1.0
```

::: info
Per-call override syntax is defined in the language specification but is not yet implemented in the interpreter.
:::
