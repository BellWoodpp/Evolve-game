import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'Evolve-master', 'evolve');
const sourceIndex = path.join(root, 'Evolve-master', 'index.html');
const publicDir = path.join(root, 'public', 'evolve');
const targetDir = path.join(publicDir, 'evolve');
const targetIndex = path.join(publicDir, 'index.html');

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const replaceDir = async (src, dest) => {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.mkdir(dest, { recursive: true });
  await fs.cp(src, dest, { recursive: true });
};

const copyFile = async (src, dest) => {
  await fs.copyFile(src, dest);
};

const main = async () => {
  await ensureDir(publicDir);
  await replaceDir(sourceDir, targetDir);
  await copyFile(sourceIndex, targetIndex);
};

main().catch((err) => {
  console.error('[sync-evolve] failed:', err);
  process.exit(1);
});
