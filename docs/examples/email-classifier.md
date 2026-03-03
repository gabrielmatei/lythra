# Example: Email Classifier

A script that classifies and summarizes a list of emails using typed vision calls with retry logic.

## Features Demonstrated

- `for` loops over arrays
- `precise` modifier for deterministic classification
- `attempt` / `assert` / `fallback` for validated summaries
- Enum types (`"spam" | "important" | "other"`)
- String interpolation

## Source

```lythra
let emails = [
  "Buy cheap meds now!!!",
  "Meeting at 3pm tomorrow",
  "Your invoice is attached"
]

for email in emails:
  precise:
    let category = vision<"spam" | "important" | "other">
      "classify this email"
      from email

  attempt 3 times:
    let summary = vision<String(max: 80)>
      "summarize in one short sentence"
      from email
    assert summary length < 80
  fallback "No summary."

  log "{email}"
  log "  → Category: {category}"
  log "  → Summary:  {summary}"
```

## Expected Output

```
Buy cheap meds now!!!
  → Category: spam
  → Summary:  Unsolicited advertisement for medication.

Meeting at 3pm tomorrow
  → Category: important
  → Summary:  Reminder about a scheduled meeting tomorrow at 3pm.

Your invoice is attached
  → Category: other
  → Summary:  Notification about an attached invoice.
```
