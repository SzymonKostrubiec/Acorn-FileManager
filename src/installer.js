import path from 'node:path';

import {
  copyDirectory,
  defaultInstallPath,
  ensureDir,
  normalizePath,
  pathExists,
} from './fs-utils.js';
import { GitClient } from './git-client.js';
import { loadLock, writeLock } from './lockfile.js';
import { loadPackageManifest } from './manifest.js';
import { generateAutoload, writeAutoloadFile } from './autoload.js';
import { satisfies } from './version.js';

function packageMatchesConstraint(pkg, constraint) {
  if (!constraint || constraint === '*' || constraint === 'latest') {
    return true;
  }

  if (pkg.version && satisfies(pkg.version, constraint)) {
    return true;
  }

  if (pkg.source?.branch && constraint === `dev-${pkg.source.branch}`) {
    return true;
  }

  if (pkg.source?.reference && constraint === pkg.source.reference) {
    return true;
  }

  return false;
}

function sortPackageMap(packages) {
  return [...packages.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export class Installer {
  constructor(projectRoot, manifest, resolver) {
    this.projectRoot = projectRoot;
    this.manifest = manifest;
    this.resolver = resolver;
    this.git = new GitClient();
  }

  async install({ update = false } = {}) {
    await this.ensureProjectDirectories();

    const existingLock = update
      ? null
      : await loadLock(this.projectRoot, this.manifest.config.lock_file);
    const installedPackages = new Map();
    const queued = [...Object.entries(this.manifest.require)];

    while (queued.length) {
      const [packageName, constraint] = queued.shift();
      const current = installedPackages.get(packageName);

      if (current) {
        if (!packageMatchesConstraint(current, constraint)) {
          throw new Error(
            `Version conflict for ${packageName}. Installed ${current.version ?? current.source?.reference ?? 'unknown'} does not satisfy ${constraint}.`,
          );
        }

        continue;
      }

      const lockEntry = existingLock?.packages?.[packageName] ?? null;
      const resolved = await this.resolver.resolve(packageName, constraint, lockEntry);
      await this.syncPackage(resolved, update, lockEntry);

      const packageRoot = path.join(this.projectRoot, resolved.installPath);
      const packageManifest = await loadPackageManifest(packageRoot);
      const source = await this.captureSourceState(packageRoot, resolved);
      const record = {
        name: packageName,
        version: packageManifest?.version ?? resolved.version ?? constraint,
        constraint,
        installPath: resolved.installPath,
        autoloadFiles: packageManifest?.autoloadFiles ?? resolved.autoloadFiles ?? [],
        require: packageManifest?.require ?? {},
        source,
      };

      installedPackages.set(packageName, record);

      for (const [dependencyName, dependencyConstraint] of Object.entries(record.require)) {
        const existing = installedPackages.get(dependencyName);

        if (existing) {
          if (!packageMatchesConstraint(existing, dependencyConstraint)) {
            throw new Error(
              `Dependency conflict: ${packageName} requires ${dependencyName} ${dependencyConstraint}, but ${existing.version ?? existing.source?.reference ?? 'unknown'} is already selected.`,
            );
          }

          continue;
        }

        queued.push([dependencyName, dependencyConstraint]);
      }
    }

    const autoloadFiles = await generateAutoload(
      this.projectRoot,
      this.manifest,
      installedPackages,
    );

    await writeAutoloadFile(
      this.projectRoot,
      this.manifest.config.autoload_output_file,
      autoloadFiles,
    );

    await writeLock(
      this.projectRoot,
      this.manifest.config.lock_file,
      createLockPayload(this.manifest, installedPackages, autoloadFiles),
    );

    return {
      packages: installedPackages,
      autoloadFiles,
    };
  }

  async dumpAutoload() {
    const installedPackages = await this.snapshotInstalledPackages();
    const autoloadFiles = await generateAutoload(
      this.projectRoot,
      this.manifest,
      installedPackages,
    );

    await writeAutoloadFile(
      this.projectRoot,
      this.manifest.config.autoload_output_file,
      autoloadFiles,
    );

    await writeLock(
      this.projectRoot,
      this.manifest.config.lock_file,
      createLockPayload(this.manifest, installedPackages, autoloadFiles),
    );

    return {
      packages: installedPackages,
      autoloadFiles,
    };
  }

  async snapshotInstalledPackages() {
    const packages = new Map();
    const lock = await loadLock(this.projectRoot, this.manifest.config.lock_file);
    const names = new Set([
      ...Object.keys(this.manifest.require),
      ...Object.keys(lock?.packages ?? {}),
    ]);

    for (const packageName of [...names].sort()) {
      const lockEntry = lock?.packages?.[packageName] ?? null;
      const repository = this.manifest.repositories.find(
        (entry) => entry.package === packageName && entry.type !== 'registry',
      );
      const installPath =
        lockEntry?.installPath ??
        repository?.installPath ??
        defaultInstallPath(packageName, this.manifest.config.vendor_dir);
      const packageRoot = path.join(this.projectRoot, installPath);

      if (!(await pathExists(packageRoot))) {
        continue;
      }

      const packageManifest = await loadPackageManifest(packageRoot);
      const source = await this.captureSourceState(packageRoot, {
        installPath,
        source: lockEntry?.source ?? {
          type: repository?.type ?? 'git',
          url: repository?.url ?? null,
          sourcePath: repository?.sourcePath ?? null,
          branch: repository?.branch ?? null,
        },
      });

      packages.set(packageName, {
        name: packageName,
        version: packageManifest?.version ?? lockEntry?.version ?? null,
        constraint: lockEntry?.constraint ?? this.manifest.require[packageName] ?? null,
        installPath,
        autoloadFiles: packageManifest?.autoloadFiles ?? lockEntry?.autoloadFiles ?? [],
        require: packageManifest?.require ?? lockEntry?.require ?? {},
        source,
      });
    }

    return packages;
  }

  async ensureProjectDirectories() {
    const directories = [
      this.manifest.config.vendor_dir,
      this.manifest.config.cache_dir,
      this.manifest.config.storage_dir,
      this.manifest.config.logs_dir,
    ];

    for (const relativePath of directories) {
      await ensureDir(path.join(this.projectRoot, relativePath));
    }
  }

  async syncPackage(resolved, update, lockEntry) {
    const targetPath = path.join(this.projectRoot, resolved.installPath);
    await ensureDir(path.dirname(targetPath));

    if (resolved.source.type === 'path') {
      await copyDirectory(resolved.source.sourcePath, targetPath);
      return;
    }

    if (resolved.source.type !== 'git') {
      throw new Error(`Unsupported source type "${resolved.source.type}" for ${resolved.name}.`);
    }

    await this.git.assertAvailable();

    const exists = await pathExists(targetPath);

    if (!exists) {
      await this.git.clone(resolved.source.url, targetPath, resolved.source.branch);
    } else if (!(await this.git.isRepository(targetPath))) {
      throw new Error(`Target path ${targetPath} exists but is not a git repository.`);
    }

    await this.git.fetch(targetPath);

    const lockedReference = lockEntry?.source?.reference ?? null;
    const desiredReference = update ? resolved.source.reference : lockedReference ?? resolved.source.reference;
    const desiredBranch = resolved.source.branch ?? lockEntry?.source?.branch ?? null;

    if (desiredBranch) {
      await this.git.checkout(targetPath, desiredBranch);
    }

    if (desiredReference) {
      await this.git.checkout(targetPath, desiredReference);
    } else if (update && desiredBranch) {
      await this.git.pull(targetPath, desiredBranch);
    }
  }

  async captureSourceState(packageRoot, resolved) {
    if (resolved.source.type === 'path') {
      return {
        type: 'path',
        sourcePath: this.makePortablePath(resolved.source.sourcePath),
      };
    }

    return {
      type: 'git',
      url: resolved.source.url,
      branch: await this.git.currentBranch(packageRoot).catch(() => resolved.source.branch ?? null),
      reference: await this.git.revParseHead(packageRoot),
    };
  }

  makePortablePath(sourcePath) {
    const relativePath = path.relative(this.projectRoot, sourcePath);

    if (!relativePath.startsWith('..')) {
      return normalizePath(relativePath);
    }

    return normalizePath(sourcePath);
  }
}

function createLockPayload(manifest, packages, autoloadFiles) {
  const entries = Object.fromEntries(
    sortPackageMap(packages).map(([packageName, pkg]) => [
      packageName,
      {
        version: pkg.version,
        constraint: pkg.constraint,
        installPath: pkg.installPath,
        autoloadFiles: pkg.autoloadFiles,
        require: pkg.require,
        source: pkg.source,
      },
    ]),
  );

  return {
    name: manifest.name,
    generated_at: new Date().toISOString(),
    autoload: autoloadFiles,
    packages: entries,
  };
}
