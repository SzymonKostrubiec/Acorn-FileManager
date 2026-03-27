import path from 'node:path';

import { GitClient } from './git-client.js';
import { pathExists, readJson } from './fs-utils.js';

export async function publishPackage(projectRoot, manifest, globalConfig) {
  if (!globalConfig.publish.registry) {
    throw new Error('Global publish registry is not configured. Run "acorn config init" and edit ~/.acorn/config.json.');
  }

  const packageManifestPath = path.join(projectRoot, 'acorn.json');

  if (!(await pathExists(packageManifestPath))) {
    throw new Error('Cannot publish without acorn.json.');
  }

  const packageManifest = await readJson(packageManifestPath);

  if (!packageManifest.name) {
    throw new Error('Published package must define "name" in acorn.json.');
  }

  if (!packageManifest.version) {
    throw new Error('Published package must define "version" in acorn.json.');
  }

  const git = new GitClient();
  await git.assertAvailable();

  const remote = await git.remoteUrl(projectRoot);
  const branch = await git.currentBranch(projectRoot).catch(() => 'main');
  const reference = await git.revParseHead(projectRoot);
  const endpoint = new URL(
    globalConfig.publish.endpoint ?? '/publish',
    globalConfig.publish.registry.endsWith('/')
      ? globalConfig.publish.registry
      : `${globalConfig.publish.registry}/`,
  );

  const headers = {
    'content-type': 'application/json',
  };

  if (globalConfig.publish.tokenEnv && process.env[globalConfig.publish.tokenEnv]) {
    headers.authorization = `Bearer ${process.env[globalConfig.publish.tokenEnv]}`;
  }

  const payload = {
    package: {
      name: packageManifest.name,
      version: packageManifest.version,
      require: packageManifest.require ?? {},
      autoload: packageManifest.autoload ?? { files: [] },
      source: {
        type: 'git',
        url: remote,
        branch,
        reference,
      },
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Publish failed with ${response.status}${body ? `: ${body}` : ''}`);
  }

  return {
    endpoint: endpoint.toString(),
    payload,
  };
}
