import path from 'node:path';
import { promises as fs } from 'node:fs';

import { normalizePath, pathExists, readJson } from './fs-utils.js';

function expandHome(input) {
  if (!input.startsWith('~/')) {
    return input;
  }

  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path.join(home, input.slice(2));
}

async function discoverInDirectory(rootDir, depth, projectRoot, found) {
  if (depth < 0 || !(await pathExists(rootDir))) {
    return;
  }

  const manifestPath = path.join(rootDir, 'acorn.json');

  if (await pathExists(manifestPath)) {
    const manifest = await readJson(manifestPath);

    if (manifest.name && path.resolve(rootDir) !== path.resolve(projectRoot)) {
      found.set(manifest.name, {
        type: 'path',
        package: manifest.name,
        sourcePath: normalizePath(rootDir),
        installPath: null,
      });
    }
  }

  if (depth === 0) {
    return;
  }

  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'vendor') {
      continue;
    }

    await discoverInDirectory(path.join(rootDir, entry.name), depth - 1, projectRoot, found);
  }
}

export async function discoverWorkspaceRepositories(globalConfig, projectRoot) {
  const found = new Map();

  for (const workspace of globalConfig.workspaces) {
    const rootDir = path.resolve(expandHome(workspace.path));
    await discoverInDirectory(rootDir, workspace.depth, projectRoot, found);
  }

  return [...found.values()];
}
