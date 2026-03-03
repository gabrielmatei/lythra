# Introduction

**Lythra** (*Language Yielding Typed Heuristic Reasoning Automatically*) is a scripting language built from the ground up for the era of Large Language Models (LLMs).

## Why Lythra?

Most AI-integrated programs today are built by stuffing prompts into strings and hoping for the best. Lythra changes this by making the LLM a first-class citizen of the language.

### Core Philosophy

1. **LLM calls are typed.** Every `vision` call declares what it expects back. The runtime enforces it.
2. **Determinism is explicit.** You choose how deterministic each call is. Nothing is hidden.
3. **Failures are handled, not ignored.** Every LLM call must declare a fallback or be wrapped in a `consult` block.
4. **Programs are pipelines.** Data flows through stages. Side effects are declared.

## A Quick Peek

```lythra
pipeline Greet(name: String) -> String:
  # A typed, precise vision call
  result = vision<String> "say hello to {name}" warmly
  return result

# Calling the pipeline
let message = consult Greet("Developer")
log message
```

## Getting Started

To install Lythra and run your first script, move on to the [Basics](./basics) guide.
