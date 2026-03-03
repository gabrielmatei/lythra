# Functions

Functions in Lythra are **pure helpers** — they cannot make LLM calls or cause side effects. Use [pipelines](./pipelines) for anything involving `vision`.

## Declaration

```lythra
fn add(a: Int, b: Int) -> Int:
  return a + b

log add(5, 7)   # 12
```

## Parameters and Return Types

Type annotations are optional but recommended:

```lythra
fn greet(name: String) -> String:
  return "Hello, {name}!"

fn clamp(val: Float, min: Float, max: Float) -> Float:
  if val < min: return min
  if val > max: return max
  return val
```

## Recursion

Functions can call themselves:

```lythra
fn factorial(n: Int) -> Int:
  if n <= 1:
    return 1
  return n * factorial(n - 1)

log factorial(5)   # 120
```

## Closures

Functions capture their enclosing scope, enabling stateful patterns:

```lythra
fn makeCounter():
  let count = 0

  fn step():
    count = count + 1
    return count

  return step

let counterA = makeCounter()
let counterB = makeCounter()

log counterA()   # 1
log counterA()   # 2
log counterB()   # 1 (independent state)
log counterA()   # 3
```

Each call to `makeCounter()` creates a separate closure with its own `count` variable.
