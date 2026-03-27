import path from 'node:path';

import { pathExists, readJson, writeJson } from './fs-utils.js';

export async function loadLock(projectRoot, lockFileName) {
  const lockPath = path.join(projectRoot, lockFileName);

  if (!(await pathExists(lockPath))) {
    return null;
  }

  return readJson(lockPath);
}

export async function writeLock(projectRoot, lockFileName, payload) {
  const lockPath = path.join(projectRoot, lockFileName);
  await writeJson(lockPath, payload);
}
