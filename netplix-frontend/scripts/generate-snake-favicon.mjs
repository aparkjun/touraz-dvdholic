/**
 * 네비 뱀 GIF(screen 블렌드)와 동일하게 보이도록 theme-color(#141414) 배경 PNG 생성.
 * 실행: node scripts/generate-snake-favicon.mjs  (sharp 필요)
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SRC = path.join(root, "public", "snake-icon2.gif");
/** layout.js theme-color, 브라우저 탭 바깥 영역 */
const TAB_BG = "#141414";

async function renderSnakeIcon(size, dest) {
  const pad = Math.max(2, Math.round(size * 0.08));
  const inner = size - pad * 2;

  const base = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: TAB_BG,
    },
  })
    .png()
    .toBuffer();

  const snake = await sharp(SRC, { animated: true, pages: 1 })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: snake, blend: "screen", gravity: "center" }])
    .png()
    .toFile(dest);

  console.log("wrote", path.relative(root, dest), `${size}x${size}`);
}

await renderSnakeIcon(32, path.join(root, "app", "icon.png"));
await renderSnakeIcon(180, path.join(root, "app", "apple-icon.png"));
await renderSnakeIcon(32, path.join(root, "public", "favicon-snake.png"));
