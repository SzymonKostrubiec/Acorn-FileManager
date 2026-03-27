#!/usr/bin/env node

import { runCli } from '../src/application.js';

runCli(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);

    if (error && typeof error === 'object' && 'stderr' in error && error.stderr) {
      console.error(String(error.stderr).trim());
    }

    process.exitCode = 1;
  });
