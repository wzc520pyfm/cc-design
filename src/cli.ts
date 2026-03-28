#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
  const { runInit } = await import('./init.js');
  await runInit(args.slice(1));
} else {
  await import('./index.js');
}
