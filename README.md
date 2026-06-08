<p align="center">
  <img src="https://raw.githubusercontent.com/Tankonyako/mcp-locator/main/assets/logo.svg" alt="mcp-locator" width="580">
</p>

<p align="center">
  An <b>MCP (Model Context Protocol)</b> server that lets AI agents read and write your
  <b>locale JSON translation files</b> directly from the conversation —
  without ever loading the whole catalog into context.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/mcp-locator"><img src="https://img.shields.io/npm/v/mcp-locator?color=0f766e&label=npm" alt="npm version"></a>
  <a href="https://github.com/Tankonyako/mcp-locator/issues"><img src="https://img.shields.io/github/issues/Tankonyako/mcp-locator?color=5eead4" alt="issues"></a>
  <img src="https://img.shields.io/node/v/mcp-locator?color=1e1b4b" alt="node version">
</p>

---

Point the server at one or more JSON files with `--locale-<CODE>=<PATH>` and it dynamically creates a set of tools for **every locale**. The AI sees `set_en`, `get_fr`, `tree_de`, `search_uk`, etc. and knows immediately which language each tool targets.

## 💸 Why — token savings on large catalogs

The usual way an agent edits translations is to **read the entire locale file into context**, edit, and write it back. That cost scales with the size of your catalog and repeats on every turn.

`mcp-locator` instead exposes **targeted tools** — the agent fetches only the keys it needs (`get`, `search`, `diff`) and writes only what changed (`set_batch`). The full catalog never enters the context window.

Rough estimate (≈ 18–22 tokens per `"key.path": "value"` entry, measured on typical nested JSON):

| Catalog size | Locales | Paste whole files into context | `mcp-locator` (diff + fetch ~30 deltas) | Saved |
|---|---|---|---|---|
| 500 keys | 2 | ~20k tokens | ~1.5k tokens | **~92%** |
| 1,500 keys | 3 | ~90k tokens | ~2k tokens | **~97%** |
| 4,000 keys | 4 | ~320k tokens | ~3k tokens | **~99%** |

> Numbers are estimates for illustration — actual usage depends on key-path length, value length, and how many keys a task touches. The point holds: cost grows with *what you change*, not with *how big the catalog is*.

---

## 📦 Install

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
git clone https://github.com/Tankonyako/mcp-locator.git
cd mcp-locator
npm install
node bin/mcp-locator.js --locale-en=./locales/en.json
```

---

## 🤖 Agent / MCP client setup

Most agents just need a `command` + `args` pointing at `mcp-locator`. Use **absolute paths** in global configs so the server finds files regardless of the working directory.

### Claude Code

One-liner:
```bash
claude mcp add locator -- npx mcp-locator \
  --locale-en=./locales/en.json --locale-uk=./locales/uk.json
```

Or commit a project-scoped `.mcp.json` to the repo root:
```json
{
  "mcpServers": {
    "locator": {
      "command": "npx",
      "args": [
        "mcp-locator",
        "--locale-en=./locales/en.json",
        "--locale-uk=./locales/uk.json",
        "--mode=pretty"
      ]
    }
  }
}
```

### Gemini CLI

Add to `~/.gemini/settings.json` (or a project `.gemini/settings.json`):
```json
{
  "mcpServers": {
    "locator": {
      "command": "npx",
      "args": [
        "mcp-locator",
        "--locale-en=./locales/en.json",
        "--locale-uk=./locales/uk.json"
      ]
    }
  }
}
```

### Codex CLI

Add to `~/.codex/config.toml`:
```toml
[mcp_servers.locator]
command = "npx"
args = [
  "mcp-locator",
  "--locale-en=./locales/en.json",
  "--locale-uk=./locales/uk.json",
]
```

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

---

## 🧭 Practical workflow: English as the source of truth

A common setup is **"always write in English while you build, then translate the missing locales later in one pass."** Drop an instruction block like this into your agent's `AGENTS.md` / `CLAUDE.md` / system prompt:

```text
You manage translations through the `locator` MCP server. Rules:

1. ALWAYS write user-facing strings in English (`en`) — and ONLY `en`.
   English is the single source of truth. Use set_en / set_batch_en.
2. Do NOT translate into other locales while building a feature. Leave the
   other locales alone — they get filled in later, on demand (see below).
3. Never hand-edit the locale JSON files. Always go through the tools.
4. Keys are namespaced by domain: `OrderTopUp.minDepositTitle`, not full
   sentences. Search before inventing — reuse beats duplicate (search_en).
```

**Then, once the English copy is finished**, you ask for translations as a separate step. A natural-language command like this scans for everything missing and fills it in across every locale and phrase:

> **"Sync translations: run `diff` to find keys missing from each locale, read the English source for each with `get_en`, translate them, and write them back with `set_batch_<code>`."**

Under the hood the agent runs:

1. **`diff`** → for each non-base locale, the list of keys present in `en` but missing.
2. **`get_batch_en`** → the English source strings for those keys (one call).
3. translate them, then **`set_batch_<code>`** → write all translations per locale in one call.

Because only the *missing* keys move through the context, syncing a 2,000-key
catalog costs a few thousand tokens, not a few hundred thousand.

---

## 🗂️ Works with any locale JSON — nested *or* flat

`mcp-locator` reads any JSON object, whether your keys are **nested objects** or a **flat map**. The on-disk shape is controlled by `--mode`; tool inputs always use the same dotted key paths (`user.profile.name`).

**Nested keys** (`--mode=pretty`, the default):
```json
{
  "app": { "title": "My App" },
  "user": {
    "email": "Email address",
    "profile": { "name": "Name", "age": "Age" }
  }
}
```

**Flat keys** (`--mode=inline`):
```json
{
  "app.title": "My App",
  "user.email": "Email address",
  "user.profile.name": "Name",
  "user.profile.age": "Age"
}
```

Both files expose the **exact same key paths** to the AI. Pick whichever your project already uses — point the server at it and go.

### ✨ Ideal for next-intl & one-file-per-locale projects

`mcp-locator` fits perfectly with **[next-intl](https://next-intl.dev/)**, **i18next**, **react-i18next**, **vue-i18n**, and any setup where **each locale lives in a single JSON file** (`messages/en.json`, `messages/uk.json`, …). That's the canonical layout these libraries use, and it's exactly what `--locale-<CODE>=<PATH>` maps onto:

```bash
mcp-locator \
  --locale-en=./messages/en.json \
  --locale-uk=./messages/uk.json
```

> **🛣️ Roadmap:** today each locale is **one JSON file** (one file = one locale's full catalog). Pointing a locale at a **folder of split message files** (e.g. `messages/en/*.json` namespaced per file) is **planned** — for now, consolidate to a single file per locale.

---

## 🚩 CLI flags

| Flag | Required | Default | Description |
|---|---|---|---|
| `--locale-<CODE>=<PATH>` | Yes (at least one) | — | Locale code → JSON file path. Repeat for multiple locales. |
| `--mode=pretty\|inline` | No | `pretty` | JSON storage format (see above). |
| `--splitter=<str>` | No | `.` | Key delimiter used in tool inputs and `inline` mode storage. |
| `--version` | No | — | Print version and exit. |
| `--help` | No | — | Print help and exit. |

```bash
# Two locales, default pretty mode with dot splitter
mcp-locator --locale-en=./en.json --locale-fr=./fr.json

# Three locales, inline mode, double-underscore splitter
mcp-locator --locale-en=./en.json --locale-fr=./fr.json --locale-de=./de.json \
  --mode=inline --splitter=__
```

---

## 🛠️ Tools (per locale)

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

```json
{ "locale": "en", "key": "user.profile.name", "value": "Alice" }
```

### `has_<CODE>`
Check whether a key exists.

```json
{ "locale": "en", "key": "user.profile.name", "exists": true }
```

### `list_<CODE>`
Return every key in the locale, sorted alphabetically.

```json
{ "locale": "en", "count": 3, "keys": ["app.title", "user.email", "user.profile.name"] }
```

### `tree_<CODE>`
Render the locale keys as an ASCII tree, reconstructed from the key paths.

| Input | Type | Description |
|---|---|---|
| `depth` | boolean | `true` (default) = full tree with every key. `false` = namespace structure only, hiding the string-leaf keys. |

`depth: true` — the whole tree:
```text
EN locale — 4 key(s)
├─ app
│  └─ title
└─ user
   ├─ email
   └─ profile
      ├─ age
      └─ name
```

`depth: false` — structure only (string leaves hidden — great for a quick map of a large catalog):
```text
EN locale — 4 key(s) (structure only)
├─ app
└─ user
   └─ profile
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

### Batch tools (per locale)
`has_batch_<CODE>`, `get_batch_<CODE>`, `set_batch_<CODE>` — the same operations across many keys in a single call. `set_batch_<CODE>` writes all entries and saves the file once at the end.

### Cross-locale tools
- **`get_all`** — get one key's value across every loaded locale at once.
- **`set_all`** — set one key in many locales in a single call (pass `{ "en": "Hello", "fr": "Bonjour" }`).
- **`diff`** — compare every locale against the base (first-loaded) locale; reports `missing` and `extra` keys per locale. This is what powers the "sync translations" workflow above.

---

## 🧪 Testing with MCP Inspector

```bash
npm install
npx @modelcontextprotocol/inspector node bin/mcp-locator.js -- \
  --locale-en=/tmp/en.json --locale-fr=/tmp/fr.json --mode=pretty
```

Open the Inspector URL shown in the terminal to call tools interactively.

---

## 🔧 Troubleshooting

- **Server logs appear in tool output** — logs go to `stderr`, not `stdout`. `stdout` is the JSON-RPC channel. Check your client's stderr pane.
- **File not found on startup** — the server starts with an empty locale and creates the file on the first `set_*` call.
- **Atomic writes** — all saves write to a `.tmp` file first, then rename, so a crash mid-write never corrupts your locale file.
- **Non-string values in existing files** — numbers, booleans, and arrays are coerced to strings with a warning logged to stderr.

---

## 🐛 Issues & contributing

Hit a bug, or want a feature? 🙌 **Open an issue** at
**https://github.com/Tankonyako/mcp-locator/issues** — please include your
`--mode`, your `--splitter`, and a small snippet of the locale file if it's
relevant. 💬

Pull requests are very welcome! 🚀 Fork, branch, and open a PR against `main`.

---

<p align="center"><sub>Built with ❤️ for the Model Context Protocol.</sub></p>
