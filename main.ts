import * as disk from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath as localPath } from 'node:url';
import { buildDossier as describeApp } from './vendor/makefun-app.ts';

const repository = localPath(new URL('./', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
disk.mkdirSync(destination, { recursive: true });
function stageFolder(folder: string, optional = false) {
  const source = resolve(repository, folder);
  const target = resolve(destination, folder);
  disk.mkdirSync(target, { recursive: true });
  if (!optional || disk.existsSync(source)) {
    disk.cpSync(source, target, { recursive: true });
  }
}
// A missing screenshot directory stays empty, just as in the kit's staging contract.
stageFolder('app');
stageFolder('screenshots', true);
const limits = {
  app_max_bytes: 48 * 1024 * 1024,
  app_max_files: 993,
  app_path_max_bytes: 1000,
  text_max_bytes: 160 * 1024,
  screenshots: { max_bytes: 256 * 1024, max: 4 },
};
disk.writeFileSync(resolve(destination, 'dossier.json'), describeApp(destination, limits));
