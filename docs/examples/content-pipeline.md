# Example: Content Pipeline

A pipeline that fetches an article and runs multiple AI analysis tasks in parallel.

## Features Demonstrated

- `pipeline` declaration with typed return
- `parallel` block for concurrent vision calls
- `precise` and `fuzzy` modifier blocks
- `attempt` / `fallback` for validated output
- `consult` to call pipelines

## Source

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

## Key Concepts

- **`parallel:`** — All vision calls inside fire concurrently, significantly reducing total execution time
- **Modifier nesting** — `precise:` and `fuzzy:` blocks can be nested inside `parallel:` blocks
- **Mixed strategies** — Classification tasks use `precise`, creative tasks use `fuzzy`
