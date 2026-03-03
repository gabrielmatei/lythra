# Web Server

Lythra has a built-in HTTP server, allowing you to create AI-powered API endpoints directly in your scripts.

## Basic Server

```lythra
server MainApi on 4567:
  channel "/ping":
    on call GET:
      transmit "pong"

open doors
```

- `server Name on Port:` — declares the server
- `channel "/path":` — declares a route
- `on call METHOD:` — handles an HTTP method (GET, POST, etc.)
- `transmit` — sends a response
- `open doors` — starts listening

## Request Body

Use `receive` to read the incoming request body:

```lythra
server MyAPI on 3000:
  channel "/echo":
    on call POST:
      receive body as { message: String }
      transmit { response: message }

open doors
```

The `receive body as { ... }` syntax destructures the JSON body into local variables.

## Route Parameters & Headers

Use `inspect` to access URL params or request headers:

```lythra
channel "/greet/:name":
  on call GET:
    inspect params as { name: String }
    let reply = vision<String> "greet {name} warmly in one sentence"
    transmit { message: reply }
```

```lythra
channel "/secure":
  on call GET:
    inspect headers as { authorization: String }
    transmit { token: authorization }
```

## HTTP Status Codes

You can specify explicit status codes with `transmit`:

```lythra
transmit 200 result          # explicit 200
transmit 201 "created"       # 201 Created
transmit 400 "bad request"   # 400 Bad Request
transmit 404 "not found"     # 404 Not Found
transmit result              # defaults to 200
```

## Middleware with `filter`

Apply shared logic to all or specific channels:

```lythra
server MyAPI on 3000:
  # Applied to all channels
  filter all:
    inspect headers as { authorization: String }
    if authorization != "Bearer secret":
      transmit 401 "Unauthorized"
      stop

  # Applied to specific channels
  filter "/admin/*":
    log "Admin access: {request.path}"

  channel "/admin/stats":
    on call GET:
      transmit { status: "ok" }

open doors
```

The `stop` keyword halts further processing of the current request.
