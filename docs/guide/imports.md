# Imports & Modules

Lythra supports splitting code across multiple files using `import`.

## Importing a Module

```lythra
import "lib/math.lth" as Math

log Math.pi              # 3.14159
log Math.add(10, 20)     # 30
```

The path is resolved relative to the current file. All top-level bindings (variables, functions, pipelines) in the imported file become available under the alias.

## Creating a Module

Any `.lth` file can be a module. Simply define your functions and variables at the top level:

```lythra
# lib/math.lth

const pi = 3.14159

fn add(a: Int, b: Int) -> Int:
  return a + b
```

## Circular Dependency Detection

Lythra detects circular imports at runtime and will throw a clear error:

```
Circular dependency detected: main.lth -> a.lth -> b.lth -> a.lth
```

## Module Caching

Modules are evaluated only once. If multiple files import the same module, the second import returns the cached result instantly.

## Project Configuration with `lythra.json`

Place a `lythra.json` file in your project root to configure global settings:

```json
{
  "model": "gemini-2.5-flash",
  "cache": true,
  "timeout": 30
}
```

| Key | Type | Description |
|---|---|---|
| `model` | `string` | LLM model to use for `vision` calls |
| `cache` | `boolean` | Enable caching for all `vision` calls globally |
| `timeout` | `number` | Max seconds before a `vision` call times out |

The CLI automatically loads `lythra.json` from the current working directory before executing any script.
