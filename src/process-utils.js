import { spawn } from 'node:child_process';

export async function run(command, args = [], options = {}) {
  const { cwd, env } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const failure = new Error(
        `Command failed: ${command} ${args.join(' ')}`.trim(),
      );
      failure.code = code;
      failure.stdout = stdout;
      failure.stderr = stderr;
      reject(failure);
    });
  });
}
