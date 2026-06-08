import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return '1.0.0';
  }
}

const HELP = `
mcp-locator — MCP server for locale JSON translation files

Usage:
  mcp-locator --locale-<CODE>=<PATH> [--locale-<CODE>=<PATH> ...] [options]

Required:
  --locale-<CODE>=<PATH>   Point locale code CODE to a JSON file path.
                           Example: --locale-en=./locales/en.json
                           Can be repeated for multiple locales.

Options:
  --mode=pretty|inline     Storage format for JSON files.
                             pretty  — nested objects  (default)
                             inline  — flat object with splitter-joined keys
  --splitter=<str>         Key delimiter used in tool inputs and inline-mode storage.
                           Default: "."
  --version                Print version and exit.
  --help                   Print this help and exit.

Examples:
  mcp-locator --locale-en=./en.json --locale-fr=./fr.json
  mcp-locator --locale-en=./en.json --mode=inline --splitter=__
`.trim();

/**
 * @param {string[]} argv  process.argv.slice(2)
 * @returns {{ locales: Map<string, string>, mode: string, splitter: string }}
 */
export function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stderr.write(HELP + '\n');
    process.exit(0);
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stderr.write(getVersion() + '\n');
    process.exit(0);
  }

  const locales = new Map();
  let mode = 'pretty';
  let splitter = '.';

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      die(`Unknown argument: ${arg}\nRun with --help for usage.`);
    }

    const eq = arg.indexOf('=');
    if (eq === -1) {
      die(`Argument "${arg}" requires a value (e.g. ${arg}=value)\nRun with --help for usage.`);
    }

    const key = arg.slice(2, eq);
    const val = arg.slice(eq + 1);

    if (key.startsWith('locale-')) {
      const code = key.slice('locale-'.length);
      if (!code) die('Locale code cannot be empty (e.g. --locale-en=./en.json)');
      if (!val) die(`Path for locale "${code}" cannot be empty`);
      locales.set(code, resolve(process.cwd(), val));
      continue;
    }

    if (key === 'mode') {
      if (val !== 'pretty' && val !== 'inline') {
        die(`--mode must be "pretty" or "inline", got "${val}"`);
      }
      mode = val;
      continue;
    }

    if (key === 'splitter') {
      if (!val) die('--splitter cannot be empty');
      splitter = val;
      continue;
    }

    die(`Unknown option: --${key}\nRun with --help for usage.`);
  }

  if (locales.size === 0) {
    die('At least one --locale-<CODE>=<PATH> argument is required.\nRun with --help for usage.');
  }

  return { locales, mode, splitter };
}

function die(msg) {
  process.stderr.write(`[mcp-locator] Error: ${msg}\n`);
  process.exit(1);
}
