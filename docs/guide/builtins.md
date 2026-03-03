# Built-in Functions & Methods

Lythra includes native built-ins for environment access, HTTP requests, interactive input, and common operations on strings and arrays.

## Environment Variables

Access system environment variables via `env`:

```lythra
let user = env.USER
log "Hello {user}!"
```

## Interactive Input

Read a line from stdin:

```lythra
let answer = readline "What is your favorite color? "
log "Nice, {answer} is a great color!"
```

## HTTP Fetch

Fetch data from a URL:

```lythra
# As JSON (parsed into an Object)
let todo = fetch "https://jsonplaceholder.typicode.com/todos/2" as json
log todo.title

# As plain text
let html = fetch "https://example.com" as text
```

## Properties

### `length`

Works on both strings and arrays:

```lythra
let arr = [10, 20, 30, 40]
log arr length    # 4

let str = "Lythra"
log str length    # 6
```

## Methods

### `contains`

Check if a value exists in an array or a substring exists in a string:

```lythra
let arr = [10, 20, 30]
log arr contains 20    # true
log arr contains 50    # false

let str = "Lythra is awesome!"
log str contains "Lythra"    # true
```

### `matches`

Test a string against a regular expression:

```lythra
let str = "Lythra is awesome!"
log str matches "^Lythra.*"    # true
log str matches "[0-9]"        # false
```

### `starts with` / `ends with`

```lythra
let greeting = "Hello, world!"
log greeting starts with "Hello"    # true
log greeting ends with "!"          # true
```

### `map`

Transform each element of an array using a function:

```lythra
fn double(n: Int) -> Int:
  return n * 2

let nums = [1, 2, 3, 4]
let doubled = nums map double
log doubled    # [2, 4, 6, 8]
```

### `filter`

Keep only elements that pass a predicate function:

```lythra
fn isEven(n: Int) -> Boolean:
  return n % 2 == 0

let nums = [1, 2, 3, 4, 5, 6]
let evens = nums filter isEven
log evens    # [2, 4, 6]
```
