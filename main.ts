import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repository = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const appSource = join(repository, 'app');
const screenshotsSource = join(repository, 'screenshots');

function isInside(path, directory) {
  return path === directory || path.startsWith(directory + sep);
}

try {
  const root = resolve(repository);
  if (output === root || isInside(root, output) || isInside(output, appSource) || isInside(output, screenshotsSource)) {
    throw new Error('Choose an output directory separate from the repository root, app, and source screenshots.');
  }

  mkdirSync(output, { recursive: true });
  const appOutput = join(output, 'app');
  rmSync(appOutput, { recursive: true, force: true });
  cpSync(appSource, appOutput, { recursive: true });

  const screenshotsOutput = join(output, 'screenshots');
  rmSync(screenshotsOutput, { recursive: true, force: true });
  if (existsSync(screenshotsSource)) {
    cpSync(screenshotsSource, screenshotsOutput, { recursive: true });
  } else {
    // The local packaging check precedes the orchestrator's real screenshot pass.
    // This output-only sample gives buildDossier its required image without touching screenshots/.
    mkdirSync(screenshotsOutput, { recursive: true });
    cpSync(join(appSource, 'samples', 'pier.jpg'), join(screenshotsOutput, '00-packaging-placeholder.jpg'));
    console.log('No source screenshots yet. Using an output-only sample placeholder for the local dossier check.');
  }

  const dossier = buildDossier(output, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000
  });
  writeFileSync(join(output, 'dossier.json'), dossier);
  console.log(`VICE FRAME packaged in ${output}`);
  console.log(`dossier.json written (${dossier.byteLength} bytes).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
