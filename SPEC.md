# Lythra Language Specification
**Version 0.1 — Draft**

**Lythra** — *Language Yielding Typed Heuristic Reasoning Automatically*

Lythra is a scripting language designed around LLM integration as a first-class feature. It provides determinism controls, typed LLM outputs, and a clean pipeline model for building AI-powered programs.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Program Structure](#program-structure)
3. [Keywords](#keywords)
4. [Types](#types)
5. [Variables & Assignment](#variables--assignment)
6. [The `vision` Call](#the-vision-call)
7. [Determinism Controls](#determinism-controls)
8. [Pipelines](#pipelines)
9. [Control Flow](#control-flow)
10. [Functions](#functions)
11. [Error Handling](#error-handling)
12. [Web Server](#web-server)
13. [Caching & Memory](#caching--memory)
14. [Configuration](#configuration)
15. [Full Examples](#full-examples)

---

## Philosophy

Lythra is built on four principles:

- **LLM calls are typed.** Every `vision` call declares what it expects back. The runtime enforces it.
- **Determinism is explicit.** You choose how deterministic each call is. Nothing is hidden.
- **Failures are handled, not ignored.** Every LLM call must declare a fallback or be wrapped in a `consult` block.
- **Programs are pipelines.** Data flows through stages. Side effects are declared.

---

## Program Structure

A Lythra program is a `.lth` file. Top-level constructs are:

- `pipeline` definitions (named data flows)
- `server` blocks (web server entry points)
- `fn` definitions (pure helper functions)
- Bare statements (executed top to bottom as a script)

```lythra
pipeline Greet(name: String) -> String:
  result = vision<String> "say hello to {name}" warmly
  return result

server MyApp on 3000:
  channel "/hello":
    on call GET:
      transmit Greet("world")
```

---

## Keywords

### Core Language

| Keyword | Purpose |
|---|---|
| `let` | Declare a mutable variable |
| `const` | Declare an immutable variable |
| `fn` | Define a pure function |
| `return` | Return a value from a function or pipeline |
| `if` / `else` | Conditional branching |
| `while` | Loop while condition is true |
| `for` / `in` | Iterate over a collection |
| `match` | Pattern matching |
| `true` / `false` | Boolean literals |
| `null` | Null/empty value |

### LLM Integration

| Keyword | Purpose |
|---|---|
| `vision` | Make an LLM call (returns typed result) |
| `precise` | Force deterministic LLM call (temp=0, seed pinned) |
| `fuzzy` | Explicitly non-deterministic call (temp=0.7) |
| `wild` | High-creativity call (temp=1.2) |
| `attempt` | Retry an LLM call until assertion passes |
| `assert` | Declare a condition that must hold |
| `fallback` | Value to use if all attempts fail |
| `remember` | Cache an LLM call permanently by input |
| `forget` | Clear cached results for a call |
| `seed` | Pin a seed for reproducibility |
| `using` | Pass context/data into a vision call |
| `from` | Alias for `using` (reads more naturally) |

### Pipeline & Flow

| Keyword | Purpose |
|---|---|
| `pipeline` | Define a named pipeline |
| `consult` | Execute a pipeline |
| `stream` | Stream results token by token |
| `parallel` | Run multiple vision calls concurrently |
| `await` | Wait for an async operation |
| `emit` | Yield a value mid-pipeline (for streaming) |

### Web Server

| Keyword | Purpose |
|---|---|
| `server` | Define a web server |
| `channel` | Define a route |
| `on call` | Handle an HTTP method |
| `transmit` | Send a response |
| `receive` | Read request body |
| `inspect` | Access request headers/params |
| `filter` | Middleware applied to all or some channels |
| `open doors` | Start the server |

### Configuration & Meta

| Keyword | Purpose |
|---|---|
| `import` | Import another `.lth` file or module |
| `export` | Export a pipeline or function |
| `log` | Write to stdout |
| `halt` | Stop execution with an error |

---

## Types

Lythra is optionally typed. Types are declared in angle brackets on `vision` calls and in function/pipeline signatures.

### Primitives

| Type | Description | Example |
|---|---|---|
| `String` | Text | `"hello world"` |
| `Int` | Integer | `42` |
| `Float` | Decimal | `3.14` |
| `Boolean` | True or false | `true` |
| `Null` | Empty value | `null` |

### Composite

| Type | Description | Example |
|---|---|---|
| `String[]` | Array of strings | `["a", "b"]` |
| `Int[]` | Array of integers | `[1, 2, 3]` |
| `Object` | Key-value map | `{ name: "Alex", age: 30 }` |
| `String(max: N)` | String with max length | `String(max: 100)` |
| `Float(min: N, max: N)` | Float in a range | `Float(min: 0, max: 1)` |

### Enum (Union) Types

Constrain LLM output to a fixed set of values:

```lythra
vision<"positive" | "negative" | "neutral"> "what is the sentiment?" from text
```

---

## Variables & Assignment

```lythra
let x = 10           # mutable
const name = "Alex"  # immutable

let scores: Int[] = [1, 2, 3]
let profile: Object = { name: "Alex", score: 99 }

# Destructuring
let { name, score } = profile
```

---

## The `vision` Call

The core of Lythra. Makes a call to the configured LLM and returns a typed result.

### Syntax

```
vision<Type> "prompt" [modifier] [using/from expression]
```

### Basic Examples

```lythra
# Returns a String
let reply = vision<String> "say hello in French"

# Returns a Boolean
let isSpam = vision<Boolean> "is this email spam?" from emailText

# Returns an Int
let score = vision<Int> "rate this essay 1-10" using essayBody

# Returns a constrained enum
let mood = vision<"happy" | "sad" | "angry" | "neutral"> "what mood is this?" from message

# Returns a structured object
let summary = vision<Object> "extract name, email, and company from this text" using contactBlob

# Returns an array
let tags = vision<String[]> "list 5 relevant tags for this article" from articleText
```

### Inline Interpolation

```lythra
let language = "Spanish"
let result = vision<String> "translate this to {language}: {text}"
```

---

## Determinism Controls

### Modifiers

```lythra
precise:
  # temp=0, seed pinned — same input always produces same output
  let category = vision<String> "classify this document" from doc

fuzzy:
  # temp=0.7 — some variation allowed
  let summary = vision<String> "summarize this" from doc

wild:
  # temp=1.2 — maximum creativity
  let poem = vision<String> "write a poem about {topic}"
```

### Seed Pinning

```lythra
# Always produces the same result for the same input
let name = vision<String> "generate a fantasy character name" seed 42

# Varies per run (uses current timestamp as seed)
let name = vision<String> "generate a fantasy character name" seed time
```

### The `attempt` Block

Retry an LLM call until an assertion passes, with a fallback if all attempts fail.

```lythra
attempt 3 times:
  let price = vision<String> "extract the price from this text" from doc
  assert price matches /^\$[\d,.]+$/
fallback "$0.00"
```

Assertions can also be type checks:

```lythra
attempt 5 times:
  let rating = vision<Int> "rate this 1-10" from review
  assert rating >= 1
  assert rating <= 10
fallback 5
```

---

## Pipelines

Pipelines are named, typed data flows. They are the primary way to organize Lythra programs.

### Definition

```lythra
pipeline Summarize(text: String) -> Object:
  precise:
    let sentiment = vision<"positive" | "negative" | "neutral">
      "what is the overall sentiment?"
      from text

  attempt 3 times:
    let summary = vision<String(max: 150)>
      "summarize in one sentence"
      from text
    assert summary ends with "."
  fallback "No summary available."

  let tags = vision<String[]> "list up to 5 topic tags" from text

  return {
    sentiment: sentiment,
    summary: summary,
    tags: tags
  }
```

### Calling a Pipeline

```lythra
let result = consult Summarize("Lythra is a new programming language...")
log result.summary
```

### Parallel Calls

Run multiple vision calls at the same time:

```lythra
pipeline AnalyzeFull(text: String) -> Object:
  parallel:
    let sentiment = vision<"positive" | "negative" | "neutral"> "sentiment?" from text
    let language  = vision<String> "what language is this?" from text
    let topics    = vision<String[]> "list main topics" from text

  return { sentiment, language, topics }
```

### Streaming

Emit results as they arrive:

```lythra
pipeline StreamStory(prompt: String):
  stream:
    vision<String> "write a short story about {prompt}"
    emit each token
```

---

## Control Flow

### Conditionals

```lythra
if score > 8:
  log "Excellent"
else if score > 5:
  log "Average"
else:
  log "Poor"
```

### Loops

```lythra
while count < 10:
  count = count + 1

for item in items:
  log item

for i in 0..10:
  log i
```

### Match

```lythra
match sentiment:
  "positive" -> log "Great!"
  "negative" -> log "Oh no."
  "neutral"  -> log "Okay."
  _          -> log "Unknown"
```

---

## Functions

Pure functions — no LLM calls, no side effects. Use `pipeline` for anything involving `vision`.

```lythra
fn double(n: Int) -> Int:
  return n * 2

fn greet(name: String) -> String:
  return "Hello, {name}!"

fn clamp(val: Float, min: Float, max: Float) -> Float:
  if val < min: return min
  if val > max: return max
  return val
```

---

## Error Handling

### `attempt` / `fallback`

The primary mechanism — see Determinism Controls above.

### `halt`

Stop execution with an error message:

```lythra
if apiKey == null:
  halt "No API key configured. Set ORACLE_KEY in your environment."
```

### `consult` Error Handling

```lythra
let result = consult Summarize(text) or fallback { summary: "unavailable", tags: [] }
```

---

## Web Server

Lythra has a built-in HTTP server.

### Basic Server

```lythra
server MyAPI on 3000:
  channel "/":
    on call GET:
      transmit "Lythra is running."

open doors
```

### With Body & Params

```lythra
server MyAPI on 3000:

  channel "/analyze":
    on call POST:
      receive body as text: String
      let result = consult Summarize(text)
      transmit result

  channel "/greet/:name":
    on call GET:
      inspect params as { name: String }
      let reply = vision<String> "greet {name} warmly in one sentence"
      transmit { message: reply }

open doors
```

### Middleware (Filters)

```lythra
server MyAPI on 3000:

  # Applied to all channels
  filter all:
    inspect headers as { authorization: String }
    if authorization != "Bearer {env.API_KEY}":
      transmit 401 "Unauthorized"
      stop

  # Applied to specific channels
  filter "/admin/*":
    log "Admin access: {request.path}"

  channel "/admin/stats":
    on call GET:
      transmit { uptime: env.UPTIME, requests: counter.total }

open doors
```

### HTTP Status Codes

```lythra
transmit 200 result          # explicit 200
transmit 201 "created"       # 201 Created
transmit 400 "bad request"   # 400 Bad Request
transmit 404 "not found"     # 404 Not Found
transmit 500 "server error"  # 500 Internal Server Error
transmit result              # defaults to 200
```

---

## Caching & Memory

### `remember`

Cache `vision` results forever, keyed by prompt + input. Same input → same output after first call.

```lythra
remember:
  let translation = vision<String> "translate to French" from text
```

### `forget`

Clear cached results:

```lythra
forget translation      # clear one cached result
forget all              # clear entire cache
```

### Session Memory

Within a pipeline, Lythra can maintain a conversation context:

```lythra
pipeline Chat(history: Object[], message: String) -> String:
  let response = vision<String>
    "you are a helpful assistant. continue this conversation."
    using history
    with message

  return response
```

---

## Configuration

Lythra reads global defaults from a `lythra.json` file in the current working directory.

```json
{
  "model": "gpt-4o",
  "cache": true,
  "timeout": 30
}
```

### Per-Call Overrides

```lythra
let result = vision<String> "write a haiku" model "gpt-3.5-turbo" temperature 1.0
```

---

## Full Examples

### Example 1: Email Classifier (Script)

```lythra
let emails = [
  "Buy cheap meds now!!!",
  "Meeting at 3pm tomorrow",
  "Your invoice is attached"
]

for email in emails:
  precise:
    let category = vision<"spam" | "important" | "other">
      "classify this email"
      from email

  attempt 3 times:
    let summary = vision<String(max: 80)>
      "summarize in one short sentence"
      from email
    assert summary length < 80
  fallback "No summary."

  log "{email}"
  log "  → Category: {category}"
  log "  → Summary:  {summary}"
```

---

### Example 2: Content Pipeline

```lythra
pipeline ProcessArticle(url: String) -> Object:

  # Fetch the article text (built-in)
  let raw = fetch url as text

  parallel:
    precise:
      let language  = vision<String> "what language is this article written in?" from raw
      let wordCount = vision<Int>    "how many words approximately?" from raw

    attempt 3 times:
      let headline = vision<String(max: 80)>
        "write a punchy headline for this article"
        from raw
      assert headline length > 10
    fallback "Untitled Article"

    fuzzy:
      let tldr = vision<String(max: 200)>
        "give a 1-2 sentence TL;DR"
        from raw

    let tags = vision<String[]> "list up to 8 relevant tags" from raw

  return {
    url:       url,
    language:  language,
    wordCount: wordCount,
    headline:  headline,
    tldr:      tldr,
    tags:      tags
  }

# Run it
let result = consult ProcessArticle("https://example.com/article")
log result
```

---

### Example 3: Web Server with AI Endpoints

```lythra
pipeline Moderate(text: String) -> Object:
  precise:
    let safe     = vision<Boolean> "is this content safe for all audiences?" from text
    let category = vision<"clean" | "mild" | "adult" | "harmful"> "classify content level" from text

  return { safe, category }

server ContentAPI on 8080:

  filter all:
    inspect headers as { x_api_key: String }
    if x_api_key != env.API_KEY:
      transmit 401 { error: "Invalid API key" }
      stop

  channel "/moderate":
    on call POST:
      receive body as { text: String }
      if text == null:
        transmit 400 { error: "text is required" }
        stop
      let result = consult Moderate(text)
      transmit result

  channel "/summarize":
    on call POST:
      receive body as { text: String, style: String }
      let style = style or "neutral"

      fuzzy:
        let summary = vision<String(max: 300)>
          "summarize this text in a {style} tone"
          from text

      transmit { summary }

  channel "/classify":
    on call POST:
      receive body as { text: String, labels: String[] }
      if labels == null:
        transmit 400 { error: "labels array is required" }
        stop

      precise:
        let chosen = vision<String>
          "classify this text into exactly one of these categories: {labels}"
          from text
        assert chosen in labels

      transmit { label: chosen }

  channel "/health":
    on call GET:
      transmit { status: "ok", model: config.model }

open doors
```

---

### Example 4: CLI Chatbot

```lythra
let history: Object[] = []
let systemPrompt = "You are a helpful, concise assistant."

log "Lythra Chat — type 'quit' to exit\n"

while true:
  let input = readline "> "

  if input == "quit":
    log "Goodbye."
    halt

  let response = vision<String>
    "{systemPrompt}"
    using history
    with input

  history = history + [
    { role: "user",      content: input },
    { role: "assistant", content: response }
  ]

  log "\n{response}\n"
```

---

## File Extensions

Lythra uses two file extensions:

| Extension | Purpose |
|---|---|
| `.lth` | Source files — all Lythra code |
| `lythra.json` | Project config — dependencies, model settings, environment |

### Source Files (`.lth`)

```
main.lth
server.lth
pipelines/summarize.lth
pipelines/moderate.lth
```

### Project Config (`lythra.json`)

The `lythra.json` file lives at the root of your project, similar to `package.json` in Node or `pyproject.toml` in Python.

```json
{
  "name": "my-lythra-app",
  "version": "0.1.0",
  "entry": "main.lth",
  "model": "gpt-4o",
  "cache": true,
  "seed": 42,
  "dependencies": {
    "lythra-http": "^1.0.0",
    "lythra-db": "^0.3.0"
  },
  "env": {
    "required": ["LYTHRA_API_KEY"],
    "optional": ["PORT", "LOG_LEVEL"]
  }
}
```

---

## Roadmap / Future Considerations

- **Type inference** — infer types from usage without declarations
- **Model versioning** — pin model version per file like a dependency
- **Snapshot testing** — record first LLM run, replay in CI
- **Mock mode** — replace `vision` calls with fixtures for testing
- **Token budgets** — set max tokens per call or per pipeline
- **Multi-modal** — `vision<Image>` for image generation; input images to prompts
- **Tool calls** — allow `vision` to invoke built-in or custom tools
- **Reactive pipelines** — re-run pipelines when inputs change

---

*Lythra — Language Yielding Typed Heuristic Reasoning Automatically — Specification v0.1 Draft*
*lythra.com*