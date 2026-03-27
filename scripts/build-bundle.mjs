import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(root, 'bin', 'acorn.js')],
  outfile: path.join(root, 'dist', 'acorn.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: false,
  legalComments: 'none',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
