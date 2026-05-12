#!/usr/bin/env node
/**
 * Runs `openmrs develop` for local work against Docker or a shared dev server.
 *
 * Backend URL resolution (first wins):
 *   1) CLI: `yarn start:local -- --backend https://...`
 *   2) `.env` / shell: `OPENMRS_BACKEND_URL`
 *   3) Default: `https://dev2.openmrs.org`
 *
 * Optional `--host` / `--port` (CLI or `OPENMRS_DEVELOP_HOST` / `OPENMRS_DEVELOP_PORT` in `.env`):
 * if unset, those flags are omitted and the OpenMRS CLI uses its own defaults.
 *
 * Only keys matching /^(OPENMRS_|NODE_)/ from `.env` are merged into the child env (Playwright `E2E_*`
 * stays out of the child process). Extra CLI tokens after known flags are forwarded to `openmrs develop`.
 *
 * See `example.env`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const DEFAULT_BACKEND = 'https://dev2.openmrs.org';

function normalizeBackendUrl(url) {
  const s = String(url).trim();
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

/** @returns {{ backend: string | null, host: string | null, port: string | null, rest: string[] }} */
function splitCli(argv) {
  const out = { backend: null, host: null, port: null, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--' || a === '') {
      continue;
    }
    if (a === '--backend' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      out.backend = argv[++i];
      continue;
    }
    if (a.startsWith('--backend=')) {
      out.backend = a.slice('--backend='.length);
      continue;
    }
    if (a === '--host' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      out.host = argv[++i];
      continue;
    }
    if (a.startsWith('--host=')) {
      out.host = a.slice('--host='.length);
      continue;
    }
    if (a === '--port' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      out.port = argv[++i];
      continue;
    }
    if (a.startsWith('--port=')) {
      out.port = a.slice('--port='.length);
      continue;
    }
    out.rest.push(a);
  }
  return out;
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const fromFile = existsSync(envPath) ? parse(readFileSync(envPath, 'utf8')) : {};

const cli = splitCli(process.argv.slice(2));

function pickEnv(key) {
  const v = fromFile[key] ?? process.env[key];
  return v != null && String(v).trim() !== '' ? String(v).trim() : '';
}

const host = (cli.host ?? pickEnv('OPENMRS_DEVELOP_HOST')) || '';
const port = (cli.port ?? pickEnv('OPENMRS_DEVELOP_PORT')) || '';
const backendRaw = cli.backend || pickEnv('OPENMRS_BACKEND_URL') || DEFAULT_BACKEND;
const backend = normalizeBackendUrl(backendRaw);

const childEnv = { ...process.env };
for (const [k, v] of Object.entries(fromFile)) {
  if (v == null || String(v).trim() === '') {
    continue;
  }
  if (/^(OPENMRS_|NODE_)/.test(k)) {
    childEnv[k] = String(v);
  }
}

const isWin = process.platform === 'win32';
const binName = isWin ? 'openmrs.cmd' : 'openmrs';
const binPath = path.join(root, 'node_modules', '.bin', binName);

if (!existsSync(binPath)) {
  console.error('[start-openmrs-develop] Missing openmrs CLI. Run yarn install from this package.');
  process.exit(1);
}

const args = ['develop'];
if (host) {
  args.push('--host', host);
}
if (port) {
  args.push('--port', String(port));
}
args.push('--backend', backend);
args.push(...cli.rest);

const child = spawn(binPath, args, {
  stdio: 'inherit',
  cwd: root,
  env: childEnv,
  shell: isWin,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }
  process.exit(code ?? 0);
});
