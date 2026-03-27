import { promises as fs } from 'node:fs';
import path from 'node:path';

export function normalizePath(value) {
  return value.split(path.sep).join('/');
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath) {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function writeText(filePath, contents) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, contents, 'utf8');
}

export async function removeContents(dirPath) {
  if (!(await pathExists(dirPath))) {
    return;
  }

  const entries = await fs.readdir(dirPath);

  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(dirPath, entry), { recursive: true, force: true }),
    ),
  );
}

export async function walkFiles(rootDir) {
  const files = [];

  if (!(await pathExists(rootDir))) {
    return files;
  }

  async function visit(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '.git') {
          continue;
        }

        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  await visit(rootDir);

  return files;
}

export async function copyDirectory(sourceDir, destinationDir) {
  await ensureDir(path.dirname(destinationDir));
  await fs.rm(destinationDir, { recursive: true, force: true });
  await fs.cp(sourceDir, destinationDir, {
    recursive: true,
    force: true,
    filter(sourcePath) {
      return path.basename(sourcePath) !== '.git';
    },
  });
}

export function defaultInstallPath(packageName, vendorDir = 'vendor') {
  const parts = packageName.split('/');

  if (parts.length === 1) {
    return normalizePath(path.join(vendorDir, parts[0]));
  }

  return normalizePath(path.join(vendorDir, ...parts));
}

export function relativize(fromPath, toPath) {
  return normalizePath(path.relative(fromPath, toPath));
}
