import path from 'node:path';

import { defaultInstallPath, pathExists, readJson } from './fs-utils.js';

const DEFAULT_CONFIG = {
  vendor_dir: 'vendor',
  cache_dir: 'var/cache',
  storage_dir: 'var/storage',
  logs_dir: 'var/logs',
  lock_file: 'acorn.lock',
  autoload_output_file: 'var/cache/autoload.nut',
};

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function normalizeRepository(entry) {
  const type = entry.type ?? 'git';
  const installPath = entry.install ?? entry.target ?? (type === 'git' ? entry.path : null);
  const sourcePath = entry.source ?? (type === 'path' ? entry.path ?? entry.url : null);

  return {
    type,
    package: entry.package ?? entry.name ?? null,
    url: entry.url ?? null,
    branch: entry.branch ?? null,
    installPath,
    sourcePath,
    tokenEnv: entry.tokenEnv ?? null,
  };
}

function branchFromLegacyVersion(version) {
  if (typeof version === 'string' && version.startsWith('dev-')) {
    return version.slice(4);
  }

  return null;
}

export async function loadProjectManifest(projectRoot) {
  const manifestPath = path.join(projectRoot, 'acorn.json');
  const raw = await readJson(manifestPath);

  const repositories = Array.isArray(raw.repositories)
    ? raw.repositories.map(normalizeRepository)
    : [];
  const requirements = { ...(raw.require ?? {}) };
  const legacyPackages = new Map();

  if (Array.isArray(raw.packages)) {
    for (const pkg of raw.packages) {
      if (!pkg?.name) {
        continue;
      }

      requirements[pkg.name] ??= pkg.version ?? 'dev-main';

      const legacyRepos = Array.isArray(pkg.repos)
        ? pkg.repos
        : Array.isArray(pkg.autoload?.repos)
          ? pkg.autoload.repos
          : [];

      for (const repo of legacyRepos) {
        repositories.push(
          normalizeRepository({
            type: repo.type ?? 'git',
            package: pkg.name,
            url: repo.url,
            branch: repo.branch ?? branchFromLegacyVersion(pkg.version),
            path: repo.path,
          }),
        );
      }

      legacyPackages.set(pkg.name, {
        autoloadFiles: asStringArray(pkg.autoload?.files),
      });
    }
  }

  return {
    name: raw.name ?? 'acorn-project',
    type: raw.type ?? 'project',
    projectRoot,
    version: raw.version ?? null,
    config: {
      ...DEFAULT_CONFIG,
      ...(raw.config ?? {}),
    },
    autoloadFiles: asStringArray(raw.autoload?.files),
    repositories,
    require: requirements,
    legacyPackages,
  };
}

export async function loadPackageManifest(packageRoot) {
  const manifestPath = path.join(packageRoot, 'acorn.json');

  if (!(await pathExists(manifestPath))) {
    return null;
  }

  const raw = await readJson(manifestPath);

  return {
    name: raw.name ?? null,
    version: raw.version ?? null,
    require: { ...(raw.require ?? {}) },
    autoloadFiles: asStringArray(raw.autoload?.files),
  };
}

export function packageInstallPath(manifest, packageName, repository = null) {
  return repository?.installPath ?? defaultInstallPath(packageName, manifest.config.vendor_dir);
}

export function constraintBranch(constraint) {
  if (typeof constraint === 'string' && constraint.startsWith('dev-')) {
    return constraint.slice(4);
  }

  return null;
}
