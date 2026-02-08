#!/usr/bin/env node

import { intro, outro, text, spinner, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';
import { downloadAndExtract } from '../src/install.js';
import path from 'node:path';
import fs from 'node:fs';

const VERSION = '1.0.0';
const EXTENSION_NAME = 'React Debugger';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`${EXTENSION_NAME} v${VERSION}`);
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${pc.cyan(EXTENSION_NAME)} - Chrome Extension Installer

${pc.yellow('Usage:')}
  npx react-debugger [destination]

${pc.yellow('Options:')}
  -v, --version    Show version number
  -h, --help       Show help

${pc.yellow('Examples:')}
  npx react-debugger                    # Interactive mode
  npx react-debugger ./my-extension     # Direct install to folder
`);
    process.exit(0);
  }

  console.log();
  intro(pc.bgCyan(pc.black(` ${EXTENSION_NAME} Extension Installer `)));

  let destination = args[0];

  if (!destination) {
    const destInput = await text({
      message: 'Where should we install the extension?',
      placeholder: './react-debugger',
      initialValue: './react-debugger',
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

main().catch((err) => {
  console.error(pc.red('Unexpected error:'), err);
  process.exit(1);
});
