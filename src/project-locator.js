import path from 'node:path';

import { pathExists } from './fs-utils.js';

export async function findProjectRoot(startDir = process.cwd()) {
  let current = path.resolve(startDir);

  while (true) {
    if (await pathExists(path.join(current, 'acorn.json'))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }
}
