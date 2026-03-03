# Example: CLI Chatbot

A simple interactive chatbot that maintains conversation history.

## Features Demonstrated

- `while true` infinite loop
- `readline` for interactive user input
- `vision` with conversation context via `using`
- Array concatenation for history management
- `halt` to exit the program

## Source

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

## How It Works

1. The script starts an infinite loop, reading user input via `readline`
2. Each message is sent to the LLM along with the full conversation `history`
3. Both the user message and assistant response are appended to `history`
4. The conversation context grows with each exchange, enabling multi-turn dialogue
5. Typing `quit` triggers `halt`, ending the program
