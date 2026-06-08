import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Registers 5 tools per locale on the McpServer:
 *   set_<code>, get_<code>, has_<code>, list_<code>, search_<code>
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./store.js').LocaleStore} store
 */
export function registerLocaleTools(server, store) {
  const { code } = store;
  const label = code.toUpperCase();

  server.registerTool(
    `set_${code}`,
    {
      title: `Set ${label} translation`,
      description:
        `Set (create or overwrite) a translation value in the ${label} locale. ` +
        `Pass the full key path (e.g. "user.profile.name") and the ${label}-language string value. ` +
        `The change is written to disk immediately.`,
      inputSchema: {
        key: z.string().min(1).describe('Full key path (e.g. "user.profile.name")'),
        value: z.string().describe(`Translation string in ${label}`),
      },
    },
    async ({ key, value }) => {
      await store.set(key, value);
      return text({ ok: true, locale: code, key, value });
    }
  );

  server.registerTool(
    `get_${code}`,
    {
      title: `Get ${label} translation`,
      description:
        `Get the translation value for a key from the ${label} locale. ` +
        `Returns the ${label}-language string, or an error if the key does not exist.`,
      inputSchema: {
        key: z.string().min(1).describe('Full key path (e.g. "user.profile.name")'),
      },
    },
    async ({ key }) => {
      if (!store.has(key)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Key "${key}" not found in locale "${code}"`
        );
      }
      return text({ locale: code, key, value: store.get(key) });
    }
  );

  server.registerTool(
    `has_${code}`,
    {
      title: `Check ${label} key`,
      description: `Check whether a translation key exists in the ${label} locale.`,
      inputSchema: {
        key: z.string().min(1).describe('Full key path to check'),
      },
    },
    async ({ key }) => {
      return text({ locale: code, key, exists: store.has(key) });
    }
  );

  server.registerTool(
    `list_${code}`,
    {
      title: `List ${label} keys`,
      description: `Return a sorted list of every translation key in the ${label} locale.`,
      inputSchema: {},
    },
    async () => {
      const keys = store.list();
      return text({ locale: code, count: keys.length, keys });
    }
  );

  server.registerTool(
    `search_${code}`,
    {
      title: `Search ${label} keys`,
      description:
        `Substring-search translation keys in the ${label} locale. ` +
        `Returns all key/value pairs whose key contains the query string.`,
      inputSchema: {
        query: z.string().min(1).describe('Substring to search for in key paths'),
      },
    },
    async ({ query }) => {
      const matches = store.search(query);
      return text({ locale: code, query, count: matches.length, matches });
    }
  );
}

/**
 * Registers 3 batch tools per locale on the McpServer:
 *   has_batch_<code>, get_batch_<code>, set_batch_<code>
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {import('./store.js').LocaleStore} store
 */
export function registerLocaleBatchTools(server, store) {
  const { code } = store;
  const label = code.toUpperCase();

  server.registerTool(
    `has_batch_${code}`,
    {
      title: `Batch check ${label} keys`,
      description:
        `Check whether multiple keys exist in the ${label} locale in one call. ` +
        `Returns an array of { key, exists } results.`,
      inputSchema: {
        keys: z.array(z.string().min(1)).min(1).describe('Array of key paths to check'),
      },
    },
    async ({ keys }) => {
      const results = keys.map(key => ({ key, exists: store.has(key) }));
      return text({ locale: code, results });
    }
  );

  server.registerTool(
    `get_batch_${code}`,
    {
      title: `Batch get ${label} translations`,
      description:
        `Get translations for multiple keys from the ${label} locale in one call. ` +
        `Missing keys return null instead of throwing an error.`,
      inputSchema: {
        keys: z.array(z.string().min(1)).min(1).describe('Array of key paths to retrieve'),
      },
    },
    async ({ keys }) => {
      const results = keys.map(key => ({
        key,
        value: store.has(key) ? store.get(key) : null,
      }));
      return text({ locale: code, results });
    }
  );

  server.registerTool(
    `set_batch_${code}`,
    {
      title: `Batch set ${label} translations`,
      description:
        `Set multiple translation key/value pairs in the ${label} locale in one call. ` +
        `All entries are written and the file is saved once at the end.`,
      inputSchema: {
        entries: z
          .array(z.object({ key: z.string().min(1), value: z.string() }))
          .min(1)
          .describe('Array of { key, value } pairs to set'),
      },
    },
    async ({ entries }) => {
      for (const { key, value } of entries) {
        store.data.set(key, String(value));
      }
      await store.save();
      return text({ ok: true, locale: code, count: entries.length, entries });
    }
  );
}

/**
 * Registers cross-locale tools: get_all, set_all, diff.
 * The first entry in `stores` is treated as the base locale for diff comparisons.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {Map<string, import('./store.js').LocaleStore>} stores
 */
export function registerGlobalTools(server, stores) {
  const codes = [...stores.keys()];
  const baseCode = codes[0];
  const baseStore = stores.get(baseCode);

  server.registerTool(
    'get_all',
    {
      title: 'Get translation from all locales',
      description:
        `Get the translation for a key from every loaded locale at once. ` +
        `Returns a map of locale code → value. Missing keys show null. ` +
        `Loaded locales: ${codes.join(', ')}.`,
      inputSchema: {
        key: z.string().min(1).describe('Full key path (e.g. "user.profile.name")'),
      },
    },
    async ({ key }) => {
      const translations = {};
      for (const [code, store] of stores) {
        translations[code] = store.has(key) ? store.get(key) : null;
      }
      return text({ key, translations });
    }
  );

  server.registerTool(
    'set_all',
    {
      title: 'Set translation in all locales',
      description:
        `Set a translation key in multiple locales at once. ` +
        `Pass an object mapping locale code → translated string. ` +
        `You may provide a subset of locales — only the ones included are updated. ` +
        `Loaded locales: ${codes.join(', ')}.`,
      inputSchema: {
        key: z.string().min(1).describe('Full key path (e.g. "user.profile.name")'),
        values: z
          .record(z.string(), z.string())
          .describe(`Object mapping locale code to translated string, e.g. {"en":"Hello","fr":"Bonjour"}`),
      },
    },
    async ({ key, values }) => {
      const unknown = Object.keys(values).filter(c => !stores.has(c));
      if (unknown.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unknown locale code(s): ${unknown.join(', ')}. Loaded: ${codes.join(', ')}`
        );
      }
      const updated = {};
      for (const [code, value] of Object.entries(values)) {
        await stores.get(code).set(key, value);
        updated[code] = value;
      }
      return text({ ok: true, key, updated });
    }
  );

  server.registerTool(
    'diff',
    {
      title: 'Diff locales against base',
      description:
        `Compare every locale against the base locale (${baseCode}, the first one loaded). ` +
        `For each non-base locale, shows keys that are missing (present in base but absent in locale) ` +
        `and extra keys (present in locale but absent in base). ` +
        `Loaded locales: ${codes.join(', ')}.`,
      inputSchema: {},
    },
    async () => {
      const baseKeys = new Set(baseStore.list());
      const byLocale = {};
      for (const [code, store] of stores) {
        if (code === baseCode) continue;
        const localeKeys = new Set(store.list());
        byLocale[code] = {
          missing: [...baseKeys].filter(k => !localeKeys.has(k)).sort(),
          extra: [...localeKeys].filter(k => !baseKeys.has(k)).sort(),
        };
      }
      return text({ base: baseCode, diff: byLocale });
    }
  );
}

function text(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}
