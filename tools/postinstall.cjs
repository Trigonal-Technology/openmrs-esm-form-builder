'use strict';
/**
 * postinstall for @openmrs/esm-form-builder-app
 * - Git checkout / local dev: run openmrs importmap patch + husky when present.
 * - Packed install (e.g. Docker `yarn add *.tgz`): usually only this file ships — exit 0.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pkgRoot = path.join(__dirname, '..');
const patchScript = path.join(__dirname, 'patch-openmrs-localhost-mf.js');

if (fs.existsSync(patchScript)) {
  const r = spawnSync(process.execPath, [patchScript], { cwd: pkgRoot, stdio: 'inherit' });
  if (r.status !== 0 && r.status != null) {
    process.exit(r.status);
  }
}

const gitDir = path.join(pkgRoot, '.git');
if (fs.existsSync(gitDir)) {
  spawnSync('husky', ['install'], { cwd: pkgRoot, stdio: 'inherit', shell: true });
}
