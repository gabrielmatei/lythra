# Control Flow

Lythra supports standard imperative control flow constructs.

## Conditionals

### `if` / `else if` / `else`

```lythra
let score = 85

if score >= 90:
  log "Grade: A"
else if score >= 80:
  log "Grade: B"
else if score >= 70:
  log "Grade: C"
else:
  log "Grade: Failing"
```

### Single-line `if`

```lythra
if val < min: return min
if val > max: return max
```

## Loops

### `while`

```lythra
let count = 3
while count > 0:
  log count
  count = count - 1
log "Blastoff! 🚀"
```

### `for ... in` (Arrays)

```lythra
let items = ["apple", "banana", "cherry"]

for fruit in items:
  log "I like " + fruit
```

### `for ... in` (Ranges)

```lythra
for i in 0..5:
  log i   # prints 0, 1, 2, 3, 4
```

## Pattern Matching

Use `match` for exhaustive branching on a value:

```lythra
match sentiment:
  "positive" -> log "Great!"
  "negative" -> log "Oh no."
  "neutral"  -> log "Okay."
  _          -> log "Unknown"
```

The `_` wildcard matches anything not covered by previous arms.
