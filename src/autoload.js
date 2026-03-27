import { promises as fs } from 'node:fs';
import path from 'node:path';

import { normalizePath, relativize, walkFiles } from './fs-utils.js';
import { loadPackageManifest } from './manifest.js';

function globToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let result = '^';

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    const afterNext = normalized[index + 2];

    if (char === '*' && next === '*') {
      if (afterNext === '/') {
        result += '(?:.*\\/)?';
        index += 2;
        continue;
      }

      result += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      result += '[^/]*';
      continue;
    }

    if (char === '?') {
      result += '[^/]';
      continue;
    }

    if ('\\.[]{}()+-^$|'.includes(char)) {
      result += `\\${char}`;
      continue;
    }

    result += char;
  }

  result += '$';
  return new RegExp(result);
}

async function collectFilesForPatterns(baseDir, patterns) {
  if (!patterns.length) {
    return [];
  }

  const matchers = patterns.map(globToRegExp);
  const files = await walkFiles(baseDir);

  return files
    .map((absolutePath) => ({
      absolutePath,
      relativePath: normalizePath(path.relative(baseDir, absolutePath)),
    }))
    .filter((entry) => matchers.some((matcher) => matcher.test(entry.relativePath)))
    .map((entry) => entry.absolutePath);
}

export async function generateAutoload(projectRoot, manifest, installedPackages) {
  const files = new Set();

  const projectFiles = await collectFilesForPatterns(projectRoot, manifest.autoloadFiles);

  for (const absolutePath of projectFiles) {
    files.add(relativize(projectRoot, absolutePath));
  }

  const packages = [...installedPackages.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const pkg of packages) {
    const packageRoot = path.join(projectRoot, pkg.installPath);
    const packageManifest = await loadPackageManifest(packageRoot);
    const patterns =
      packageManifest?.autoloadFiles?.length
        ? packageManifest.autoloadFiles
        : pkg.autoloadFiles ?? [];

    const packageFiles = await collectFilesForPatterns(packageRoot, patterns);

    for (const absolutePath of packageFiles) {
      files.add(relativize(projectRoot, absolutePath));
    }
  }

  return [...files].sort();
}

export async function writeAutoloadFile(projectRoot, outputFile, files) {
  const outputPath = path.join(projectRoot, outputFile);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const lines = [
    'return [',
    ...files.map((filePath) => `  "${filePath}",`),
    ']',
  ];

  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}
