/**
 * Capacitor webDir 은 `build/` 가 있어야 합니다.
 * Next.js 는 기본적으로 `build/` 를 채우지 않으므로(원격 server.url 사용),
 * cap sync 전에 최소 index.html 만 보장합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const indexPath = path.join(buildDir, 'index.html');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Touraz Holic</title>
</head>
<body>
  <!-- Capacitor placeholder; 앱은 capacitor.config.ts 의 server.url 로 로드됩니다. -->
</body>
</html>
`;

fs.mkdirSync(buildDir, { recursive: true });
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[cap-webdir] wrote', indexPath);
} else {
  console.log('[cap-webdir] exists', indexPath);
}
