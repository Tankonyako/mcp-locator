/**
 * Recursively flattens a nested object into a Map<string, string>.
 * Non-string leaf values are coerced to string with a stderr warning.
 * @param {object} obj
 * @param {string} splitter
 * @param {Map<string, string>} [map]
 * @param {string} [prefix]
 * @returns {Map<string, string>}
 */
export function flatten(obj, splitter, map = new Map(), prefix = '') {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}${splitter}${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, splitter, map, fullKey);
    } else {
      if (typeof v !== 'string') {
        process.stderr.write(
          `[mcp-locator] Warning: key "${fullKey}" has non-string value (${typeof v}), coercing to string\n`
        );
      }
      map.set(fullKey, String(v ?? ''));
    }
  }
  return map;
}

/**
 * Unflattens a Map<string, string> into a nested object for "pretty" mode disk writes.
 * @param {Map<string, string>} map
 * @param {string} splitter
 * @returns {object}
 */
export function unflattenPretty(map, splitter) {
  const root = {};
  for (const [key, value] of map) {
    const parts = key.split(splitter);
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (node[part] === undefined || typeof node[part] !== 'object') {
        node[part] = {};
      }
      node = node[part];
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
}

/**
 * Converts a Map<string, string> to a flat object for "inline" mode disk writes.
 * Keys are kept as-is (they already contain the splitter).
 * @param {Map<string, string>} map
 * @returns {object}
 */
export function unflattenInline(map) {
  const obj = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Builds a nested tree from flat key paths.
 * Each node is { children: {...}, leaf: boolean }. A node is a `leaf` when a
 * key path terminates at it (it holds a string value); a node with a non-empty
 * `children` map is a namespace.
 * @param {string[]} keys
 * @param {string} splitter
 * @returns {Record<string, {children: object, leaf: boolean}>}
 */
export function buildTree(keys, splitter) {
  const root = {};
  for (const key of keys) {
    const parts = key.split(splitter);
    let node = root;
    parts.forEach((part, i) => {
      if (!node[part]) node[part] = { children: {}, leaf: false };
      if (i === parts.length - 1) node[part].leaf = true;
      node = node[part].children;
    });
  }
  return root;
}

/**
 * Renders a tree (from {@link buildTree}) into an ASCII tree string.
 * When `full` is false, string-leaf keys are omitted and only namespace nodes
 * (keys that contain nested children) are shown.
 * @param {Record<string, {children: object, leaf: boolean}>} tree
 * @param {boolean} full
 * @returns {string}
 */
export function renderTree(tree, full) {
  const lines = [];
  const walk = (node, prefix) => {
    let names = Object.keys(node).sort((a, b) => a.localeCompare(b));
    if (!full) names = names.filter(n => Object.keys(node[n].children).length > 0);
    names.forEach((name, idx) => {
      const last = idx === names.length - 1;
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${name}`);
      walk(node[name].children, `${prefix}${last ? '   ' : '│  '}`);
    });
  };
  walk(tree, '');
  return lines.join('\n');
}
