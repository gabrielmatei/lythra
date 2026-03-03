# CLI Reference

The Lythra CLI is the primary interface for running and managing Lythra scripts.

## Commands

### `lythra run <file>`

Execute a `.lth` file:

```bash
lythra run main.lth
lythra run examples/04_vision.lth
```

### `lythra check <file>`

Type-check and syntax-check a file without executing it:

```bash
lythra check main.lth
```

Returns a list of lexer and parser errors, or confirms no errors were found.

### `lythra repl`

Start an interactive Read-Eval-Print Loop:

```bash
lythra
# or
lythra repl
```

Running `lythra` with no arguments also starts the REPL.

### `lythra init`

Create a starter `main.lth` file in the current directory:

```bash
lythra init
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | For `vision` calls | Your Google Gemini API key |

```bash
GEMINI_API_KEY="your-key-here" lythra run script.lth
```

## Configuration

The CLI automatically loads `lythra.json` from the current working directory. See [Configuration](./configuration) for the full schema.
