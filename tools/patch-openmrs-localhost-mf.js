#!/usr/bin/env node
/**
 * openmrs develop puts the MF bundle URL in the import map as http://localhost:<port>/...
 * On many macOS setups, "localhost" resolves to IPv6 (::1) first while webpack-dev-server
 * bound to 0.0.0.0 only listens on IPv4 — the browser then fails to load the remote entry.
 * Re-run after `yarn install` if node_modules/openmrs is re-fetched.
 */
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'node_modules', 'openmrs', 'dist', 'utils', 'importmap.js'),
  path.join(__dirname, '..', 'node_modules', 'openmrs', 'src', 'utils', 'importmap.ts'),
];

const needle = '?? `http://localhost:${port}`';
const replacement = '?? `http://127.0.0.1:${port}`';

for (const file of files) {
  if (!fs.existsSync(file)) {
    continue;
  }
  const rel = path.relative(path.join(__dirname, '..'), file);
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(replacement)) {
    continue;
  }
  if (!content.includes(needle)) {
    console.warn(`[patch-openmrs-localhost-mf] Skip ${rel}: expected snippet missing (openmrs version changed?)`);
    continue;
  }
  content = content.split(needle).join(replacement);
  fs.writeFileSync(file, content, 'utf8');
  console.log(`[patch-openmrs-localhost-mf] Patched ${rel} (MF URL uses 127.0.0.1)`);
}
