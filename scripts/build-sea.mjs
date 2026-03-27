import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const bundlePath = path.join(distDir, 'acorn.cjs');
const seaConfigPath = path.join(distDir, 'sea-config.json');
const seaBlobPath = path.join(distDir, 'acorn.blob');
const extension = process.platform === 'win32' ? '.exe' : '';
const artifactName = `acorn-${process.platform}-${process.arch}${extension}`;
const artifactPath = path.join(distDir, artifactName);

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
      shell: options.shell ?? false,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
    });
  });
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

await fs.mkdir(distDir, { recursive: true });

if (!(await exists(bundlePath))) {
  throw new Error('Missing dist/acorn.cjs. Run npm run build:bundle first.');
}

await fs.writeFile(
  seaConfigPath,
  JSON.stringify(
    {
      main: bundlePath,
      output: seaBlobPath,
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  ),
);

await run(process.execPath, ['--experimental-sea-config', seaConfigPath]);
await fs.copyFile(process.execPath, artifactPath);
await fs.chmod(artifactPath, 0o755).catch(() => {});

if (process.platform === 'darwin') {
  await run('codesign', ['--remove-signature', artifactPath]).catch(() => {});
}

const postjectBinary =
  process.platform === 'win32'
    ? path.join(root, 'node_modules', '.bin', 'postject.cmd')
    : path.join(root, 'node_modules', '.bin', 'postject');

const postjectArgs = [
  artifactPath,
  'NODE_SEA_BLOB',
  seaBlobPath,
  '--sentinel-fuse',
  'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
];

if (process.platform === 'darwin') {
  postjectArgs.push('--macho-segment-name', 'NODE_SEA');
}

await run(postjectBinary, postjectArgs, {
  shell: process.platform === 'win32',
});

if (process.platform === 'darwin') {
  await run('codesign', ['--sign', '-', artifactPath]);
}

const checksums = await Promise.all(
  [artifactPath, seaBlobPath].map(async (targetPath) => {
    const crypto = await import('node:crypto');
    const content = await fs.readFile(targetPath);
    const digest = crypto.createHash('sha256').update(content).digest('hex');
    return `${digest}  ${path.basename(targetPath)}`;
  }),
);

await fs.writeFile(path.join(distDir, `${artifactName}.sha256`), `${checksums.join(os.EOL)}${os.EOL}`);
