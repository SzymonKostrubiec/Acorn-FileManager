import path from 'node:path';

import { pathExists } from './fs-utils.js';
import { run } from './process-utils.js';

export class GitClient {
  async assertAvailable() {
    await run('git', ['--version']);
  }

  async isRepository(targetPath) {
    return pathExists(path.join(targetPath, '.git'));
  }

  async clone(url, targetPath, branch = null) {
    const args = ['clone'];

    if (branch) {
      args.push('--branch', branch);
    }

    args.push(url, targetPath);

    await run('git', args);
  }

  async fetch(targetPath) {
    await run('git', ['fetch', '--all', '--tags'], { cwd: targetPath });
  }

  async checkout(targetPath, reference) {
    await run('git', ['checkout', reference], { cwd: targetPath });
  }

  async pull(targetPath, branch) {
    await run('git', ['pull', '--ff-only', 'origin', branch], { cwd: targetPath });
  }

  async revParseHead(targetPath) {
    const result = await run('git', ['rev-parse', 'HEAD'], { cwd: targetPath });
    return result.stdout.trim();
  }

  async currentBranch(targetPath) {
    const result = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: targetPath,
    });

    return result.stdout.trim();
  }

  async remoteUrl(targetPath, remote = 'origin') {
    const result = await run('git', ['remote', 'get-url', remote], { cwd: targetPath });
    return result.stdout.trim();
  }
}
