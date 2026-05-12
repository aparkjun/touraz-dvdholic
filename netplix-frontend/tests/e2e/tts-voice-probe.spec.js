/**
 * Chromium 에서 speechSynthesis 일본어·중국어 음성 목록만 로그한다.
 * (에이전트는 소리를 들을 수 없고, CI/로컬에서 어떤 음성이 노출되는지 확인용.)
 *
 * 실행: cd netplix-frontend && set PW_SKIP_WEBSERVER=1&& npx playwright test tests/e2e/tts-voice-probe.spec.js --project=chromium
 */
const { test } = require('@playwright/test');

test('log ja/zh speech voices (no server)', async ({ page }) => {
  await page.goto('data:text/html,<meta charset="utf-8"><p>tts</p>');
  const data = await page.evaluate(() => {
    return new Promise((resolve) => {
      const collect = () => {
        const vs = window.speechSynthesis.getVoices();
        const norm = (s) => (s || '').toLowerCase().replace(/_/g, '-');
        const ja = vs
          .filter((v) => norm(v.lang).startsWith('ja'))
          .map((v) => ({ name: v.name, lang: v.lang, uri: v.voiceURI }));
        const zh = vs
          .filter((v) => {
            const l = norm(v.lang);
            return l.startsWith('zh') || l.startsWith('cmn') || l.startsWith('yue') || l.startsWith('zho');
          })
          .map((v) => ({ name: v.name, lang: v.lang, uri: v.voiceURI }));
        return { total: vs.length, jaCount: ja.length, zhCount: zh.length, ja, zh };
      };
      const tryResolve = () => {
        const d = collect();
        if (d.total > 0) {
          resolve(d);
          return true;
        }
        return false;
      };
      if (tryResolve()) return;
      window.speechSynthesis.onvoiceschanged = () => {
        tryResolve();
      };
      setTimeout(() => resolve(collect()), 5000);
    });
  });
  // eslint-disable-next-line no-console
  console.log('\n[TTS probe]', JSON.stringify(data, null, 2));
});
