#!/usr/bin/env node

import pc from 'picocolors';
import { downloadAndExtract } from '../src/install.js';
import path from 'node:path';
import fs from 'node:fs';

const VERSION = '2.1.1';
const EXTENSION_NAME = 'React Debugger';
const DEFAULT_DEST = './react-debugger';

const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

// Lazy-load @clack/prompts only when interactive mode is needed.
// This avoids ERR_TTY_INIT_FAILED in non-TTY environments (CI, pipes, subprocesses).
async function loadClack() {
  return import('@clack/prompts');
}

function printHelp() {
  console.log(`
${pc.cyan(EXTENSION_NAME)} - Chrome Extension Installer

${pc.yellow('Usage:')}
  npx @nhonh/react-debugger [destination]

${pc.yellow('Options:')}
  -v, --version    Show version number
  -h, --help       Show help
  -y, --yes        Skip prompts and use defaults (non-interactive)

${pc.yellow('Examples:')}
  npx @nhonh/react-debugger                    # Interactive mode
  npx @nhonh/react-debugger ./my-extension     # Direct install to folder
  npx @nhonh/react-debugger -y                  # Non-interactive with defaults
`);
}

function printSuccess(fullPath) {
  console.log();
  console.log(pc.dim('─'.repeat(50)));
  console.log();
  console.log(pc.bold('Next steps to load the extension in Chrome:'));
  console.log();
  console.log(`  ${pc.cyan('1.')} Open ${pc.yellow('chrome://extensions/')} in Chrome`);
  console.log(`  ${pc.cyan('2.')} Enable ${pc.yellow('Developer mode')} (toggle in top right)`);
  console.log(`  ${pc.cyan('3.')} Click ${pc.yellow('Load unpacked')}`);
  console.log(`  ${pc.cyan('4.')} Select the folder:`);
  console.log(`     ${pc.green(fullPath)}`);
  console.log();
  console.log(pc.dim('─'.repeat(50)));
  console.log();
}

async function runInteractive(args) {
  const { intro, outro, text, spinner, confirm, isCancel } = await loadClack();

  console.log();
  intro(pc.bgCyan(pc.black(` ${EXTENSION_NAME} Extension Installer `)));

  let destination = args[0];

  if (!destination) {
    const destInput = await text({
      message: 'Where should we install the extension?',
      placeholder: DEFAULT_DEST,
      initialValue: DEFAULT_DEST,
      validate: (value) => {
        if (!value || value.trim() === '') {
          return 'Please enter a destination path';
        }
      },
    });

    if (isCancel(destInput)) {
      outro(pc.yellow('Installation cancelled.'));
      process.exit(0);
    }

    destination = destInput;
  }

  const fullPath = path.resolve(destination);

  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    if (files.length > 0) {
      const shouldOverwrite = await confirm({
        message: `Directory ${pc.yellow(fullPath)} is not empty. Overwrite?`,
        initialValue: false,
      });

      if (isCancel(shouldOverwrite) || !shouldOverwrite) {
        outro(pc.yellow('Installation cancelled.'));
        process.exit(0);
      }
    }
  }

  const s = spinner();
  s.start('Downloading React Debugger extension...');

  try {
    await downloadAndExtract(fullPath);
    s.stop(pc.green('Download complete!'));
    printSuccess(fullPath);
    outro(pc.green('✓ Installation successful!'));
  } catch (err) {
    s.stop(pc.red('Download failed!'));
    console.error();
    console.error(pc.red('Error:'), err.message);
    console.error();
    console.error(pc.dim('If this persists, please report at:'));
    console.error(pc.dim('https://github.com/hoainho/react-debugger-extension/issues'));
    process.exit(1);
  }
}

async function runNonInteractive(args) {
  const destination = args[0] || DEFAULT_DEST;
  const fullPath = path.resolve(destination);

  console.log();
  console.log(pc.bgCyan(pc.black(` ${EXTENSION_NAME} Extension Installer `)));
  console.log();
  console.log(pc.dim('Running in non-interactive mode'));
  console.log(`Installing to: ${pc.cyan(fullPath)}`);
  console.log();

  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    if (files.length > 0) {
      console.log(pc.yellow(`Directory ${fullPath} is not empty. Overwriting...`));
    }
  }

  console.log('Downloading React Debugger extension...');

  try {
    await downloadAndExtract(fullPath);
    console.log(pc.green('Download complete!'));
    printSuccess(fullPath);
    console.log(pc.green('✓ Installation successful!'));
  } catch (err) {
    console.error();
    console.error(pc.red('Error:'), err.message);
    console.error();
    console.error(pc.dim('If this persists, please report at:'));
    console.error(pc.dim('https://github.com/hoainho/react-debugger-extension/issues'));
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('-'));
  const positional = args.filter(a => !a.startsWith('-'));

  if (flags.includes('--version') || flags.includes('-v')) {
    console.log(`${EXTENSION_NAME} v${VERSION}`);
    process.exit(0);
  }

  if (flags.includes('--help') || flags.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const forceNonInteractive = flags.includes('--yes') || flags.includes('-y');

  if (forceNonInteractive || !isInteractive) {
    await runNonInteractive(positional);
  } else {
    await runInteractive(positional);
  }
}

main().catch((err) => {
  console.error(pc.red('Unexpected error:'), err.message || err);
  process.exit(1);
});
