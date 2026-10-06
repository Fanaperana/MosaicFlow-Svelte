// Remembers the last content the app read or wrote per file, so the file watcher can tell
// the app's own writes apart from edits made by other tools (MCP server, editors, sync).

const known = new Map<string, string>();

export function normalizePath(path: string): string {
  const p = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  return /^[a-z]:\//i.test(p) ? p.toLowerCase() : p;
}

export function rememberContent(path: string, content: string) {
  known.set(normalizePath(path), content);
}

export function forgetContent(path: string) {
  const prefix = normalizePath(path);
  for (const key of known.keys()) if (key === prefix || key.startsWith(`${prefix}/`)) known.delete(key);
}

export function isKnownContent(path: string, content: string): boolean {
  return known.get(normalizePath(path)) === content;
}

export function clearKnownContent() {
  known.clear();
}
