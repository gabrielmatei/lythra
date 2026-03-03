# Pipelines

Pipelines are named, typed data flows — the primary way to organize non-trivial Lythra programs.

## Declaring a Pipeline

```lythra
pipeline Summarize(text: String) -> Object:
  precise:
    let sentiment = vision<"positive" | "negative" | "neutral">
      "what is the overall sentiment?"
      from text

  let tags = vision<String[]> "list up to 5 topic tags" from text

  return {
    sentiment: sentiment,
    tags: tags
  }
```

Pipelines can contain `vision` calls, modifier blocks, and all other statements.

## Calling a Pipeline with `consult`

```lythra
let result = consult Summarize("Lythra is a new programming language...")
log result.sentiment
log result.tags
```

## Parallel Execution

Run multiple `vision` calls concurrently with a `parallel` block. Since vision calls are I/O-bound (network requests), this saves significant execution time.

```lythra
let desc1 = "pending"
let desc2 = "pending"
let desc3 = "pending"

parallel:
  desc1 = vision<String> "Describe the homepage of example.com"
  desc2 = vision<String> "Describe the homepage of example.org"
  desc3 = vision<String> "Describe the homepage of example.net"

log [desc1, desc2, desc3]
```

All three vision calls fire concurrently and the block resolves when all have completed.

## Streaming

Emit results as they arrive with `stream` and `emit`:

```lythra
pipeline StreamStory(prompt: String):
  stream:
    vision<String> "write a short story about {prompt}"
    emit each token
```

::: info
Streaming is defined in the language specification but is not yet fully implemented in the interpreter.
:::

## Pipeline vs Function

| Feature | `fn` | `pipeline` |
|---|---|---|
| LLM calls (`vision`) | ❌ Not allowed | ✅ Full support |
| Side effects | None (pure) | Allowed |
| Calling convention | Direct call | `consult PipelineName(args)` |
| Use case | Math, string helpers | AI workflows |
