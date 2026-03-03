# Architecture Overview

This section describes the internal architecture of the Lythra interpreter. Lythra follows a traditional **Lexer → Parser → Interpreter** pipeline, with added layers for LLM integration, caching, and module resolution.

## Execution Pipeline

When you run `lythra run script.lth`, the following stages execute:

```mermaid
graph LR
    A["📄 .lth Source"] --> B["🔤 Lexer"]
    B --> C["Token Stream"]
    C --> D["🌳 Parser"]
    D --> E["AST"]
    E --> F["⚙️ Interpreter"]
    F --> G["Result / Side Effects"]
```

1. **Lexer** — Converts raw source text into a stream of tokens
2. **Parser** — Converts tokens into an Abstract Syntax Tree (AST)
3. **Interpreter** — Tree-walks the AST, evaluating expressions and executing statements

## System Architecture

```mermaid
graph TD
    CLI["CLI<br/><code>cli/index.ts</code>"] --> Runtime["LythraRuntime<br/><code>runtime/runtime.ts</code>"]
    Runtime --> Lexer["Lexer<br/><code>lexer/lexer.ts</code>"]
    Runtime --> Parser["Parser<br/><code>parser/parser.ts</code>"]
    Runtime --> Interp["Interpreter<br/><code>interpreter/interpreter.ts</code>"]
    Interp --> Env["Environment<br/>(Scoped variable storage)"]
    Interp --> Vision["Vision<br/><code>llm/vision.ts</code>"]
    Interp --> Cache["Cache Layer<br/><code>llm/cache.ts</code>"]
    Interp --> Server["HTTP Server<br/><code>interpreter/server.ts</code>"]
    Interp --> Imports["Module Loader<br/>(via LythraRuntime)"]
    Imports -.-> Runtime
```

### Key Components

| Component | File | Responsibility |
|---|---|---|
| **CLI** | `src/cli/index.ts` | Entry point, argument parsing, loads `lythra.json` |
| **Runtime** | `src/runtime/runtime.ts` | Orchestrates lex → parse → interpret, handles imports |
| **Lexer** | `src/lexer/lexer.ts` | Tokenization with line/column tracking |
| **Parser** | `src/parser/parser.ts` | Recursive-descent parser, produces AST |
| **AST** | `src/parser/ast.ts` | Immutable node type definitions |
| **Interpreter** | `src/interpreter/interpreter.ts` | Tree-walking evaluator |
| **Environment** | `src/interpreter/environment.ts` | Scoped variable storage (nested closures) |
| **Vision** | `src/llm/vision.ts` | Gemini API integration, type coercion |
| **Cache** | `src/llm/cache.ts` | Prompt-keyed response caching |
| **Server** | `src/interpreter/server.ts` | Express-based HTTP server management |

## Vision Call Flow

This sequence diagram shows what happens when a `vision<Type>` call is evaluated:

```mermaid
sequenceDiagram
    participant Script
    participant Interpreter
    participant Cache
    participant Gemini as Gemini API

    Script->>Interpreter: vision<Type> "prompt" from ctx
    Interpreter->>Interpreter: Resolve temperature from modifier
    Interpreter->>Cache: Check cache (if in remember block)
    alt Cache Hit
        Cache-->>Interpreter: Cached result
    else Cache Miss
        Interpreter->>Gemini: Send prompt + context + temperature
        Gemini-->>Interpreter: Raw text response
        Interpreter->>Interpreter: Coerce to target Type
        Interpreter->>Cache: Store result (if in remember block)
    end
    Interpreter-->>Script: Typed LythraValue
```

## Module Resolution Flow

```mermaid
sequenceDiagram
    participant Main as main.lth
    participant RT as LythraRuntime
    participant ModRT as Module Runtime
    participant Cache as Module Cache

    Main->>RT: import "lib/math.lth" as Math
    RT->>Cache: Check module cache
    alt Already Imported
        Cache-->>RT: Cached exports
    else First Import
        RT->>RT: Check for circular dependency
        RT->>ModRT: Spawn child runtime
        ModRT->>ModRT: Lex → Parse → Interpret module
        ModRT-->>RT: Module exports (all top-level bindings)
        RT->>Cache: Store exports
    end
    RT-->>Main: Bind exports to alias "Math"
```

## Directory Structure

```
src/
├── cli/
│   ├── index.ts          # CLI entry point & command routing
│   └── repl.ts           # Interactive REPL
├── lexer/
│   ├── lexer.ts          # Tokenizer
│   └── token.ts          # Token type definitions
├── parser/
│   ├── parser.ts         # Recursive-descent parser
│   └── ast.ts            # AST node interfaces
├── interpreter/
│   ├── interpreter.ts    # Tree-walking evaluator
│   ├── environment.ts    # Scoped variable storage
│   ├── types.ts          # LythraValue, RuntimeError, etc.
│   └── server.ts         # HTTP server manager
├── llm/
│   ├── vision.ts         # Gemini API client
│   └── cache.ts          # Prompt-keyed caching
└── runtime/
    ├── runtime.ts        # Orchestrator (lex → parse → interpret)
    └── errors.ts         # Error formatting with source snippets
```

## Deep Dives

- [Lexer](./lexer) — Tokenization details
- [Parser](./parser) — AST construction and grammar
- [Interpreter](./interpreter) — Evaluation and runtime semantics
