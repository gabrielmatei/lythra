# Example: AI Web Server

A full HTTP server with AI-powered endpoints for content moderation, summarization, and classification.

## Features Demonstrated

- `server` / `channel` / `on call` for HTTP endpoints
- `filter` middleware for authentication
- `receive` / `inspect` for request parsing
- `transmit` with status codes
- `pipeline` for reusable AI logic
- `stop` to short-circuit request handling

## Source

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
      transmit { status: "ok" }

open doors
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/moderate` | Check content safety |
| `POST` | `/summarize` | Summarize text in a given style |
| `POST` | `/classify` | Classify text into provided labels |
| `GET` | `/health` | Health check |
