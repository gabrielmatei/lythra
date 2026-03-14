# Lythra

**Language Yielding Typed Heuristic Reasoning Automatically**

Lythra is a modern scripting language designed around LLM integration as a first-class citizen. It provides determinism controls, typed LLM outputs, and a clean pipeline model for building robust AI-powered programs.

## Key Features

- **Typed LLM Calls:** Declare expected output types (e.g., `vision<String>`). The runtime handles coercion and validation.
- **Explicit Determinism:** Control AI "creativity" with `precise`, `fuzzy`, and `wild` modifiers.
- **Robust Flow:** Built-in `attempt`/`fallback` loops for self-correcting AI interactions.
- **First-class Pipelines:** Organize complex AI workflows into modular, concurrent data pipelines.
- **Embedded Web Server:** Turn AI logic into an API endpoint in seconds.

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Run an Example

```bash
# Requires GEMINI_API_KEY environment variable
export GEMINI_API_KEY="your_api_key"
node bin/lythra run examples/04_vision.lth
```

## Example Sentiment Analysis

```lythra
pipeline Analyze(text: String) -> "positive" | "negative" | "neutral":
    precise:
        let sentiment = vision<String> "what is the sentiment of this text?" from text
    return sentiment

let result = consult Analyze("I love using Lythra!")
log "Sentiment: {result}"
```

## Documentation

Comprehensive documentation is available in the `docs/` directory.

- **Dev Server:** `npm run docs:dev`
- **Build:** `npm run docs:build`

Visit [the documentation site](http://localhost:5000) for deep dives into language syntax, architecture, and examples.

## License

MIT
