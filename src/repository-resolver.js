import path from 'node:path';

import { normalizePath } from './fs-utils.js';
import { constraintBranch, packageInstallPath } from './manifest.js';
import { pickBestVersion } from './version.js';

function cloneSourceFromLock(lockEntry) {
  return {
    type: lockEntry.source?.type ?? 'git',
    url: lockEntry.source?.url ?? null,
    branch: lockEntry.source?.branch ?? null,
    reference: lockEntry.source?.reference ?? null,
    sourcePath: lockEntry.source?.sourcePath ?? null,
  };
}

export class RepositoryResolver {
  constructor(manifest) {
    this.manifest = manifest;
  }

  async resolve(packageName, constraint, lockEntry = null) {
    if (lockEntry) {
      return {
        name: packageName,
        constraint,
        version: lockEntry.version ?? constraint,
        installPath: lockEntry.installPath ?? packageInstallPath(this.manifest, packageName),
        autoloadFiles: lockEntry.autoloadFiles ?? [],
        source: cloneSourceFromLock(lockEntry),
      };
    }

    const directRepository = this.manifest.repositories.find(
      (repository) => repository.package === packageName && repository.type !== 'registry',
    );

    if (directRepository) {
      return this.resolveDirectRepository(packageName, constraint, directRepository);
    }

    return this.resolveRegistryPackage(packageName, constraint);
  }

  resolveDirectRepository(packageName, constraint, repository) {
    const installPath = packageInstallPath(this.manifest, packageName, repository);

    if (repository.type === 'path') {
      if (!repository.sourcePath) {
      throw new Error(`Path repository for ${packageName} is missing "source".`);
      }

      return {
        name: packageName,
        constraint,
        version: constraint,
        installPath,
        autoloadFiles: this.manifest.legacyPackages.get(packageName)?.autoloadFiles ?? [],
        source: {
          type: 'path',
          sourcePath: path.resolve(this.manifest.projectRoot, repository.sourcePath),
        },
      };
    }

    if (repository.type !== 'git') {
      throw new Error(`Unsupported repository type "${repository.type}" for ${packageName}.`);
    }

    const branch = repository.branch ?? constraintBranch(constraint) ?? 'main';
    const isReference =
      constraint &&
      constraint !== '*' &&
      constraint !== 'latest' &&
      !constraint.startsWith('dev-') &&
      !constraint.startsWith('^');

    return {
      name: packageName,
      constraint,
      version: constraint,
      installPath,
      autoloadFiles: this.manifest.legacyPackages.get(packageName)?.autoloadFiles ?? [],
      source: {
        type: 'git',
        url: repository.url,
        branch,
        reference: isReference ? constraint : null,
      },
    };
  }

  async resolveRegistryPackage(packageName, constraint) {
    const registries = this.manifest.repositories.filter(
      (repository) => repository.type === 'registry',
    );

    for (const registry of registries) {
      const packageUrl = new URL(
        `/packages/${encodeURIComponent(packageName)}.json`,
        registry.url.endsWith('/') ? registry.url : `${registry.url}/`,
      );

      const headers = {
        accept: 'application/json',
      };

      if (registry.tokenEnv && process.env[registry.tokenEnv]) {
        headers.authorization = `Bearer ${process.env[registry.tokenEnv]}`;
      }

      const response = await fetch(packageUrl, { headers });

      if (response.status === 404) {
        continue;
      }

      if (!response.ok) {
        throw new Error(`Registry ${registry.url} returned ${response.status} for ${packageName}.`);
      }

      const payload = await response.json();
      const versions = Object.keys(payload.package?.versions ?? {});
      const selectedVersion = pickBestVersion(versions, constraint);

      if (!selectedVersion) {
        throw new Error(
          `Registry ${registry.url} does not provide a version of ${packageName} matching ${constraint}.`,
        );
      }

      const packageDefinition = payload.package.versions[selectedVersion];
      const installPath =
        packageDefinition.install_path ??
        packageInstallPath(this.manifest, packageName);
      const source = packageDefinition.source;

      if (!source || source.type !== 'git' || !source.url) {
        throw new Error(
          `Registry package ${packageName}@${selectedVersion} must expose a git source.`,
        );
      }

      return {
        name: packageName,
        constraint,
        version: selectedVersion,
        installPath: normalizePath(installPath),
        autoloadFiles: Array.isArray(packageDefinition.autoload?.files)
          ? packageDefinition.autoload.files
          : [],
        source: {
          type: 'git',
          url: source.url,
          branch: source.branch ?? constraintBranch(selectedVersion) ?? null,
          reference: source.reference ?? (selectedVersion.startsWith('dev-') ? null : selectedVersion),
        },
      };
    }

    throw new Error(`Cannot resolve package ${packageName}. Configure a local workspace, project repository or global registry.`);
  }
}
