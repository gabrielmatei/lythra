# Getting Started

## Prerequisites

- **Node.js** v18 or later
- A **Gemini API key** (for `vision` calls) — set as the `GEMINI_API_KEY` environment variable

## Installation

```bash
# Clone the repository
git clone https://github.com/gabrielmatei/lythra.git
cd lythra

# Install dependencies
npm install

# Build the TypeScript compiler
npm run build
```

## Running Your First Script

Create a file called `hello.lth`:

```lythra
log "Hello, Lythra world!"

let name = "Developer"
log "Welcome, {name}!"
```

Run it:

```bash
GEMINI_API_KEY="your-key" node ./bin/lythra run hello.lth
```

## CLI Commands

| Command | Description |
|---|---|
| `lythra run <file>` | Execute a `.lth` file |
| `lythra check <file>` | Syntax-check a file without running it |
| `lythra repl` | Start the interactive REPL |
| `lythra init` | Create a starter `main.lth` in the current directory |

## Running the Examples

The repository includes working examples in the `examples/` directory:

```bash
# Basic variables and operations
node ./bin/lythra run examples/01_basics.lth

# Vision calls (requires API key)
GEMINI_API_KEY="..." node ./bin/lythra run examples/04_vision.lth
```

## Next Steps

- Learn the [Language Basics](./basics) — variables, types, and operators
- Explore [Vision Calls](./vision) — the core LLM integration feature
