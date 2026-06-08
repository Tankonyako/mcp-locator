# mcp-locator

An MCP (Model Context Protocol) server that lets AI clients read and write **locale JSON translation files** directly from the conversation.

Point it at one or more JSON files with `--locale-<CODE>=<PATH>` and the server dynamically creates a set of tools for every locale. The AI sees `set_en`, `get_fr`, `search_de`, etc. and knows immediately which language each tool targets.

---

## Install

**Global (use as a CLI):**
```bash
npm install -g mcp-locator
mcp-locator --locale-en=./locales/en.json --locale-fr=./locales/fr.json
```

**Without installing (npx):**
```bash
npx mcp-locator --locale-en=./locales/en.json --locale-fr=./locales/fr.json
```

**From source:**
```bash
git clone <repo>
cd mcp_locator
npm install
node bin/mcp-locator.js --locale-en=./locales/en.json
```

---

## CLI Flags

| Flag | Required | Default | Description |
|---|---|---|---|
| `--locale-<CODE>=<PATH>` | Yes (at least one) | — | Locale code → JSON file path. Repeat for multiple locales. |
| `--mode=pretty\|inline` | No | `pretty` | JSON storage format (see Modes below). |
| `--splitter=<str>` | No | `.` | Key delimiter used in tool inputs and `inline` mode storage. |
| `--version` | No | — | Print version and exit. |
| `--help` | No | — | Print help and exit. |

**Examples:**
```bash
# Two locales, default pretty mode with dot splitter
mcp-locator --locale-en=./en.json --locale-fr=./fr.json

# Three locales, inline mode, double-underscore splitter
mcp-locator --locale-en=./en.json --locale-fr=./fr.json --locale-de=./de.json \
  --mode=inline --splitter=__
```

---

## Modes

### `pretty` (default)
Keys are stored as a **nested JSON object**. The splitter is used to split a key path into nested levels.

Tool input key `"user.profile.name"` with splitter `.` produces:
```json
{
  "user": {
    "profile": {
      "name": "Alice"
    }
  }
}
```

### `inline`
Keys are stored in a **flat JSON object**. The full key string (including the splitter) is used as the object property.

Tool input key `"user__profile__name"` with splitter `__` produces:
```json
{
  "user__profile__name": "Alice"
}
```

---

## Tools (per locale)

For each locale `<CODE>`, the server registers these tools:

### `set_<CODE>`
Set (create or overwrite) a translation value. Writes to disk atomically.

| Input | Type | Description |
|---|---|---|
| `key` | string | Full key path, e.g. `"user.profile.name"` |
| `value` | string | Translation string in that language |

```json
{ "ok": true, "locale": "en", "key": "user.profile.name", "value": "Alice" }
```

### `get_<CODE>`
Get a translation by key. Throws if the key does not exist.

| Input | Type | Description |
|---|---|---|
| `key` | string | Full key path |

```json
{ "locale": "en", "key": "user.profile.name", "value": "Alice" }
```

### `has_<CODE>`
Check whether a key exists.

| Input | Type | Description |
|---|---|---|
| `key` | string | Full key path |

```json
{ "locale": "en", "key": "user.profile.name", "exists": true }
```

### `list_<CODE>`
Return every key in the locale, sorted alphabetically.

```json
{ "locale": "en", "count": 3, "keys": ["app.title", "user.name", "user.profile.name"] }
```

### `search_<CODE>`
Substring-search key paths. Returns all matching key/value pairs.

| Input | Type | Description |
|---|---|---|
| `query` | string | Substring to search for in key paths |

```json
{
  "locale": "en",
  "query": "profile",
  "count": 1,
  "matches": [{ "key": "user.profile.name", "value": "Alice" }]
}
```

---

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "locator": {
      "command": "npx",
      "args": [
        "mcp-locator",
        "--locale-en=/absolute/path/to/locales/en.json",
        "--locale-fr=/absolute/path/to/locales/fr.json"
      ]
    }
  }
}
```

### Claude Code (CLI)

Add to `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "locator": {
      "command": "npx",
      "args": [
        "mcp-locator",
        "--locale-en=./locales/en.json",
        "--locale-fr=./locales/fr.json",
        "--mode=pretty"
      ]
    }
  }
}
```

> **Tip:** Use absolute paths in client configs to ensure the server finds files regardless of the working directory.

---

## Troubleshooting

- **Server logs appear in tool output** — logs go to `stderr`, not `stdout`. `stdout` is the JSON-RPC channel. Check your client's stderr pane or run the server in a terminal to see logs.
- **File not found on startup** — the server starts with an empty locale and creates the file on the first `set_*` call.
- **Atomic writes** — all saves write to a `.tmp` file first then rename it, so a crash mid-write never corrupts your locale file.
- **Non-string values in existing files** — numbers, booleans, and arrays are coerced to strings with a warning logged to stderr.

---

## Testing with MCP Inspector

```bash
npm install
npx @modelcontextprotocol/inspector node bin/mcp-locator.js -- \
  --locale-en=/tmp/en.json --locale-fr=/tmp/fr.json --mode=pretty
```

Open the Inspector URL shown in the terminal to call tools interactively.
