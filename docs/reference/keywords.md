# Keywords Reference

A complete list of all reserved keywords in Lythra.

## Core Language

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

## LLM Integration

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

## Pipeline & Flow

| Keyword | Purpose |
|---|---|
| `pipeline` | Define a named pipeline |
| `consult` | Execute a pipeline |
| `stream` | Stream results token by token |
| `parallel` | Run multiple vision calls concurrently |
| `await` | Wait for an async operation |
| `emit` | Yield a value mid-pipeline (for streaming) |

## Web Server

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

## Meta

| Keyword | Purpose |
|---|---|
| `import` | Import another `.lth` file or module |
| `export` | Export a pipeline or function |
| `log` | Write to stdout |
| `halt` | Stop execution with an error |
