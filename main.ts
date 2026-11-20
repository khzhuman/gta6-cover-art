// VICE FRAME hand-in entrypoint. It stages the offline studio (app/) and the
// maker's screenshots into the output directory, then asks the kit library in
// vendor/makefun-app.ts to describe that staging as dossier.json. The dossier
// is deterministic: the same tree always produces the same bytes.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outRoot = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Stage one top-level folder of the entry into the output directory. The
// folder's slot is always created; the copy itself is skipped only when an
// optional folder is absent (screenshots may not exist on a fresh checkout).
function stage(folder: string, optional: boolean): void {
  const target = resolve(outRoot, folder);
  mkdirSync(target, { recursive: true });
  const source = resolve(repoRoot, folder);
  if (!optional || existsSync(source)) {
    cpSync(source, target, { recursive: true });
  }
}

mkdirSync(outRoot, { recursive: true });
stage('app', false);
stage('screenshots', true);

const caps = {
  app_max_bytes: 48 * 1024 * 1024,
  app_max_files: 993,
  app_path_max_bytes: 1000,
  text_max_bytes: 160 * 1024,
  screenshots: { max_bytes: 256 * 1024, max: 4 },
};
writeFileSync(resolve(outRoot, 'dossier.json'), buildDossier(outRoot, caps));
