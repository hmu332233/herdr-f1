#!/usr/bin/env node
import('../dist/server/index.js')
  .then(module => module.run(process.argv.slice(2)))
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
