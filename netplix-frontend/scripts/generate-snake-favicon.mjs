/**
 * 네비 뱀 GIF → 파비콘 PNG.
 * - 검은 배경 제거(크로마) 후 합성 — screen 블렌드는 흰색 번짐 유발.
 * - 32px: 투명 배경(탭 바깥 회색이 비침) / 180px·fallback: 탭 톤 회색 불투명.
 * 실행: npm run generate:favicon
 */
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const SRC = path.join(root, "public", "snake-icon2.gif");

/** 브라우저 탭·툴바에 가까운 약한 회색 (순흑·순백 아님) */
export const TAB_CHROME_GRAY = "#32363a";

const BLACK_THRESH = 42;

async function snakeWithAlpha(inner) {
  const { data, info } = await sharp(SRC, { animated: true, pages: 1 })
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += info.channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (r <= BLACK_THRESH && g <= BLACK_THRESH && b <= BLACK_THRESH) {
      out[i + 3] = 0;
    }
  }

  return sharp(out, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

async function renderSnakeIcon(size, dest, { background = null }) {
  const pad = Math.max(2, Math.round(size * 0.08));
  const inner = size - pad * 2;
  const snakePng = await snakeWithAlpha(inner);

  const bg =
    background === null
      ? { r: 0, g: 0, b: 0, alpha: 0 }
      : background;

  const base = await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: snakePng, gravity: "center" }])
    .png()
    .toFile(dest);

  console.log(
    "wrote",
    path.relative(root, dest),
    `${size}x${size}`,
    background === null ? "transparent" : background
  );
}

await renderSnakeIcon(32, path.join(root, "app", "icon.png"), { background: null });
await renderSnakeIcon(32, path.join(root, "public", "favicon-snake.png"), {
  background: TAB_CHROME_GRAY,
});
await renderSnakeIcon(180, path.join(root, "app", "apple-icon.png"), {
  background: TAB_CHROME_GRAY,
});
await renderSnakeIcon(180, path.join(root, "public", "apple-icon.png"), {
  background: TAB_CHROME_GRAY,
});
