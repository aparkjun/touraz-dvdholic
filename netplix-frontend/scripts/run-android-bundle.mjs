import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const gradlew = path.join(root, 'android', isWin ? 'gradlew.bat' : 'gradlew');
const r = spawnSync(gradlew, ['-p', 'android', 'bundleRelease'], {
  cwd: root,
  stdio: 'inherit',
  shell: isWin,
});
process.exit(r.status ?? 1);
