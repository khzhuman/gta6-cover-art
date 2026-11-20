import { cpSync as copyTree, existsSync, mkdirSync as makeDirectory, writeFileSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const entryDirectory = fileURLToPath(new URL('.', import.meta.url));
const outputDirectory = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const includeSubdirectories = { recursive: true };

// Stage the offline VICE FRAME app and any screenshots for the make.fun grader.
makeDirectory(outputDirectory, includeSubdirectories);
copyTree(
  joinPath(entryDirectory, 'app'),
  joinPath(outputDirectory, 'app'),
  includeSubdirectories,
);

const sourceScreenshots = joinPath(entryDirectory, 'screenshots');
const outputScreenshots = joinPath(outputDirectory, 'screenshots');
makeDirectory(outputScreenshots, includeSubdirectories);
if (existsSync(sourceScreenshots)) {
  copyTree(sourceScreenshots, outputScreenshots, includeSubdirectories);
}

// Build the dossier from the staged files using the grader's limits.
const dossier = buildDossier(outputDirectory, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(joinPath(outputDirectory, 'dossier.json'), dossier);
