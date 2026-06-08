import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { flatten, unflattenPretty, unflattenInline } from './modes.js';

export class LocaleStore {
  /** @type {string} */ code;
  /** @type {string} */ path;
  /** @type {'pretty'|'inline'} */ mode;
  /** @type {string} */ splitter;
  /** @type {Map<string, string>} */ data;

  constructor(code, path, mode, splitter) {
    this.code = code;
    this.path = path;
    this.mode = mode;
    this.splitter = splitter;
    this.data = new Map();
  }

  async load() {
    let raw;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        process.stderr.write(`[mcp-locator] Locale "${this.code}" file not found, starting empty: ${this.path}\n`);
        return;
      }
      throw err;
    }

    let obj;
    try {
      obj = JSON.parse(raw);
    } catch {
      throw new Error(`[mcp-locator] Failed to parse JSON for locale "${this.code}" at ${this.path}`);
    }

    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error(`[mcp-locator] Locale file must be a JSON object, got ${Array.isArray(obj) ? 'array' : typeof obj}: ${this.path}`);
    }

    if (this.mode === 'pretty') {
      this.data = flatten(obj, this.splitter);
    } else {
      this.data = new Map();
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v !== 'string') {
          process.stderr.write(
            `[mcp-locator] Warning: inline key "${k}" has non-string value (${typeof v}), coercing\n`
          );
        }
        this.data.set(k, String(v ?? ''));
      }
    }

    process.stderr.write(`[mcp-locator] Loaded locale "${this.code}" (${this.data.size} keys) from ${this.path}\n`);
  }

  has(key) {
    return this.data.has(key);
  }

  get(key) {
    return this.data.get(key);
  }

  list() {
    return Array.from(this.data.keys()).sort();
  }

  search(query) {
    const results = [];
    for (const [key, value] of this.data) {
      if (key.includes(query)) {
        results.push({ key, value });
      }
    }
    results.sort((a, b) => a.key.localeCompare(b.key));
    return results;
  }

  async set(key, value) {
    this.data.set(key, String(value));
    await this.save();
  }

  async save() {
    const obj =
      this.mode === 'pretty'
        ? unflattenPretty(this.data, this.splitter)
        : unflattenInline(this.data);

    const json = JSON.stringify(obj, null, 2) + '\n';
    const tmp = this.path + '.tmp';

    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(tmp, json, 'utf8');
    await rename(tmp, this.path);
  }
}
