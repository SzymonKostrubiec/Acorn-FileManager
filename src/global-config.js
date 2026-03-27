import os from 'node:os';
import path from 'node:path';

import { ensureDir, pathExists, readJson, writeJson } from './fs-utils.js';

const DEFAULT_CONFIG = {
  repositories: [],
  workspaces: [],
  publish: {
    registry: null,
    tokenEnv: null,
    endpoint: '/publish',
  },
};

function normalizeRepository(entry) {
  const type = entry.type ?? 'registry';

  return {
    type,
    package: entry.package ?? null,
    url: entry.url ?? null,
    branch: entry.branch ?? null,
    installPath: entry.installPath ?? entry.install ?? null,
    sourcePath: entry.sourcePath ?? entry.source ?? null,
    tokenEnv: entry.tokenEnv ?? null,
  };
}

function normalizeWorkspace(entry) {
  if (typeof entry === 'string') {
    return {
      path: entry,
      depth: 3,
    };
  }

  return {
    path: entry.path ?? '.',
    depth: Number.isInteger(entry.depth) ? entry.depth : 3,
  };
}

export function getAcornHome() {
  return process.env.ACORN_HOME
    ? path.resolve(process.env.ACORN_HOME)
    : path.join(os.homedir(), '.acorn');
}

export function getGlobalConfigPath() {
  return path.join(getAcornHome(), 'config.json');
}

export async function loadGlobalConfig() {
  const configPath = getGlobalConfigPath();

  if (!(await pathExists(configPath))) {
    return {
      path: configPath,
      data: { ...DEFAULT_CONFIG },
    };
  }

  const raw = await readJson(configPath);

  return {
    path: configPath,
    data: {
      repositories: Array.isArray(raw.repositories)
        ? raw.repositories.map(normalizeRepository)
        : [],
      workspaces: Array.isArray(raw.workspaces)
        ? raw.workspaces.map(normalizeWorkspace)
        : [],
      publish: {
        registry: raw.publish?.registry ?? null,
        tokenEnv: raw.publish?.tokenEnv ?? null,
        endpoint: raw.publish?.endpoint ?? '/publish',
      },
    },
  };
}

export async function initGlobalConfig() {
  const configPath = getGlobalConfigPath();
  await ensureDir(path.dirname(configPath));

  if (await pathExists(configPath)) {
    return configPath;
  }

  await writeJson(configPath, {
    repositories: [
      {
        type: 'registry',
        url: 'https://packages.example.com',
        tokenEnv: 'ACORN_REGISTRY_TOKEN',
      },
    ],
    workspaces: [
      {
        path: '~/Projects',
        depth: 3,
      },
    ],
    publish: {
      registry: 'https://packages.example.com',
      tokenEnv: 'ACORN_REGISTRY_TOKEN',
      endpoint: '/publish',
    },
  });

  return configPath;
}
