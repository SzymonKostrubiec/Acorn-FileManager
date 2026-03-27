import process from 'node:process';
import path from 'node:path';

import { promises as fs } from 'node:fs';

import { removeContents } from './fs-utils.js';
import { discoverWorkspaceRepositories } from './discovery.js';
import { initGlobalConfig, loadGlobalConfig } from './global-config.js';
import { GitClient } from './git-client.js';
import { Installer } from './installer.js';
import { loadLock } from './lockfile.js';
import { loadProjectManifest } from './manifest.js';
import { publishPackage } from './publisher.js';
import { findProjectRoot } from './project-locator.js';
import { RepositoryResolver } from './repository-resolver.js';
import { banner, block, headline, kv, list, success } from './ui.js';

function renderHelp() {
  return `
${banner()}

${headline('Acorn CLI', 'Composer-like package manager for Squirrel and .nut projects')}

Usage:
  acorn <command> [options]

Commands:
  install         Install dependencies from acorn.json / acorn.lock
  update          Refresh dependencies to newest allowed refs and rewrite lockfile
  dump-autoload   Rebuild var/cache/autoload.nut and refresh acorn.lock
  clear           Remove cache files
  doctor          Show runtime/project diagnostics
  publish         Publish the current package to the configured registry
  config init     Create ~/.acorn/config.json
  config show     Print the resolved global config
  help            Show this message

Options:
  -d, --working-dir <dir>   Start project discovery from a specific directory
`.trim();
}

function parseArguments(argv) {
  const positionals = [];
  let workingDir = null;

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];

    if ((argument === '--working-dir' || argument === '-d') && argv[index + 1]) {
      workingDir = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument.startsWith('--working-dir=')) {
      workingDir = path.resolve(argument.slice('--working-dir='.length));
      continue;
    }

    positionals.push(argument);
  }

  return {
    command: positionals[0] ?? 'help',
    workingDir: workingDir ?? process.cwd(),
  };
}

async function loadProjectContext(startDir) {
  const projectRoot = await findProjectRoot(startDir);

  if (!projectRoot) {
    throw new Error('Cannot find acorn.json in the current directory tree.');
  }

  const manifest = await loadProjectManifest(projectRoot);
  const globalConfig = await loadGlobalConfig();
  const workspaceRepositories = await discoverWorkspaceRepositories(globalConfig.data, projectRoot);
  const explicitPackages = new Set(
    manifest.repositories
      .filter((repository) => repository.package)
      .map((repository) => repository.package),
  );
  const mergedRepositories = [
    ...manifest.repositories,
    ...workspaceRepositories.filter((repository) => !explicitPackages.has(repository.package)),
    ...globalConfig.data.repositories.filter(
      (repository) =>
        repository.type === 'registry' ||
        (repository.package && !explicitPackages.has(repository.package)),
    ),
  ];
  manifest.repositories = mergedRepositories;
  const resolver = new RepositoryResolver(manifest);
  const installer = new Installer(projectRoot, manifest, resolver);

  return {
    projectRoot,
    manifest,
    globalConfig,
    workspaceRepositories,
    installer,
  };
}

async function commandInstall(context) {
  const result = await context.installer.install({ update: false });
  success(`Installed ${result.packages.size} package(s)`);
  kv('Autoload', context.manifest.config.autoload_output_file);
  kv('Lock', context.manifest.config.lock_file);
  return 0;
}

async function commandUpdate(context) {
  const result = await context.installer.install({ update: true });
  success(`Updated ${result.packages.size} package(s)`);
  kv('Autoload', context.manifest.config.autoload_output_file);
  kv('Lock', context.manifest.config.lock_file);
  return 0;
}

async function commandDumpAutoload(context) {
  const result = await context.installer.dumpAutoload();
  success(`Generated ${result.autoloadFiles.length} autoload entr${result.autoloadFiles.length === 1 ? 'y' : 'ies'}`);
  kv('Autoload', context.manifest.config.autoload_output_file);
  return 0;
}

async function commandClear(context) {
  const cachePath = path.join(context.projectRoot, context.manifest.config.cache_dir);
  await fs.mkdir(cachePath, { recursive: true });
  await removeContents(cachePath);
  success(`Cleared cache ${context.manifest.config.cache_dir}`);
  return 0;
}

async function commandDoctor(context) {
  const git = new GitClient();
  const lock = await loadLock(context.projectRoot, context.manifest.config.lock_file);
  const gitAvailable = await git.assertAvailable().then(() => true).catch(() => false);
  block([headline('Doctor', context.manifest.name)]);
  kv('Node', process.version);
  kv('Platform', process.platform);
  kv('Git', gitAvailable ? 'available' : 'missing');
  kv('Project root', context.projectRoot);
  kv('Manifest', path.join(context.projectRoot, 'acorn.json'));
  kv('Vendor dir', context.manifest.config.vendor_dir);
  kv('Autoload', context.manifest.config.autoload_output_file);
  kv('Lock', `${context.manifest.config.lock_file} ${lock ? '(present)' : '(missing)'}`);
  kv('Global config', context.globalConfig.path);
  kv('Workspace packages', context.workspaceRepositories.length);
  kv('Configured repositories', context.manifest.repositories.length);
  kv('Required packages', Object.keys(context.manifest.require).length);
  const registries = context.manifest.repositories
    .filter((repository) => repository.type === 'registry')
    .map((repository) => `registry ${repository.url}`);
  if (registries.length) {
    list(registries);
  }
  return 0;
}

async function commandPublish(context) {
  const result = await publishPackage(
    context.projectRoot,
    context.manifest,
    context.globalConfig.data,
  );
  success(`Published ${result.payload.package.name}@${result.payload.package.version}`);
  kv('Endpoint', result.endpoint);
  kv('Git source', result.payload.package.source.url);
  return 0;
}

async function commandConfig(subcommand) {
  if (subcommand === 'init') {
    const configPath = await initGlobalConfig();
    success(`Created global config at ${configPath}`);
    return 0;
  }

  if (subcommand === 'show') {
    const globalConfig = await loadGlobalConfig();
    block([headline('Global Config', globalConfig.path)]);
    console.log(JSON.stringify(globalConfig.data, null, 2));
    return 0;
  }

  throw new Error('Unknown config command. Use "acorn config init" or "acorn config show".');
}

export async function runCli(argv) {
  const { command, workingDir } = parseArguments(argv);
  const subcommand = argv.slice(3).find((entry) => !entry.startsWith('-')) ?? null;

  if (command === 'help') {
    console.log(renderHelp());
    return 0;
  }

  if (command === 'config') {
    return commandConfig(subcommand);
  }

  const context = await loadProjectContext(workingDir);

  switch (command) {
    case 'install':
      return commandInstall(context);
    case 'update':
      return commandUpdate(context);
    case 'dump-autoload':
      return commandDumpAutoload(context);
    case 'clear':
      return commandClear(context);
    case 'doctor':
      return commandDoctor(context);
    case 'publish':
      return commandPublish(context);
    default:
      throw new Error(`Unknown command "${command}". Use "acorn help".`);
  }
}
