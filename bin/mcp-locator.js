#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseArgs } from '../src/cli.js';
import { LocaleStore } from '../src/store.js';
import { registerLocaleTools, registerLocaleBatchTools, registerGlobalTools } from '../src/tools.js';

const cfg = parseArgs(process.argv.slice(2));

const stores = new Map();
for (const [code, filePath] of cfg.locales) {
  const store = new LocaleStore(code, filePath, cfg.mode, cfg.splitter);
  await store.load();
  stores.set(code, store);
}

const server = new McpServer({
  name: 'mcp-locator',
  version: '1.0.0',
});

for (const store of stores.values()) {
  registerLocaleTools(server, store);
  registerLocaleBatchTools(server, store);
}
registerGlobalTools(server, stores);

const [baseCode] = stores.keys();
process.stderr.write(
  `[mcp-locator] Starting — ${stores.size} locale(s): ${[...stores.keys()].join(', ')} | base: ${baseCode} | mode: ${cfg.mode} | splitter: "${cfg.splitter}"\n`
);

await server.connect(new StdioServerTransport());
