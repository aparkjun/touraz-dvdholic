/**
 * 포트폴리오 PDF — 기존 PDF(먹깨비 등) 텍스트 추출 + Touraz Holic 보충을 한 파일로 생성
 * 실행: node scripts/write-portfolio-pdf.mjs
 *
 * 환경변수(선택):
 *   PORTFOLIO_LEGACY_PDF — 원본 PDF 경로 (기본: Downloads 박준호_portpollo (1) (2).pdf)
 *   PORTFOLIO_PDF_OUT     — 출력 경로 (기본: Downloads 박준호_portpollo (1) (1).pdf)
 *   PORTFOLIO_WRITE_RETRIES — 출력 파일이 잠겨 있을 때 재시도 횟수 (기본 30, 간격 2초)
 */
import fs from 'node:fs';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');
const { PDFParse } = require('pdf-parse');

const LEGACY_PDF =
  process.env.PORTFOLIO_LEGACY_PDF ||
  'C:/Users/USER/Downloads/박준호_portpollo (1) (2).pdf';

const OUT =
  process.env.PORTFOLIO_PDF_OUT ||
  'C:/Users/USER/Downloads/박준호_portpollo (1) (1).pdf';

const FONT_KO = 'C:/Windows/Fonts/malgun.ttf';
const FONT_KO_BOLD = 'C:/Windows/Fonts/malgunbd.ttf';

function pickFont() {
  if (fs.existsSync(FONT_KO)) {
    return {
      regular: FONT_KO,
      bold: fs.existsSync(FONT_KO_BOLD) ? FONT_KO_BOLD : FONT_KO,
    };
  }
  return null;
}

function paragraph(doc, text, opts = {}) {
  const { size = 10.5, gap = 6, bold = false } = opts;
  const fonts = pickFont();
  if (fonts) {
    doc.font(bold ? fonts.bold : fonts.regular);
  } else {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
  }
  doc.fontSize(size).text(text, { align: 'left', lineGap: gap });
  doc.moveDown(0.35);
}

async function extractLegacyText(legacyPath) {
  if (!fs.existsSync(legacyPath)) {
    console.warn('[portfolio-pdf] LEGACY PDF 없음:', legacyPath);
    return '';
  }
  const buf = fs.readFileSync(legacyPath);
  const parser = new PDFParse({ data: buf });
  let raw = '';
  try {
    const data = await parser.getText();
    raw = (data.text || '').trim();
  } finally {
    await parser.destroy();
  }
  if (!raw) return '';
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
}

function writeTourazSection(doc, fonts) {
  paragraph(doc, '배포 URL: https://touraz-dvdholic-2507bcb348dd.herokuapp.com/', { size: 10, bold: false });
  paragraph(
    doc,
    '이 섹션은 같은 PDF 문서에서, 앞쪽에 배치한 원본 PDF 텍스트 추출분 뒤에 이어 붙인 Touraz Holic 프로젝트 보충입니다.',
    { size: 10 }
  );

  doc.moveDown(0.5);
  if (fonts) doc.font(fonts.bold).fontSize(13).text('1. 프로젝트 개요');
  else doc.font('Helvetica-Bold').fontSize(13).text('1. Overview');
  doc.moveDown(0.25);
  paragraph(
    doc,
    'Next.js 기반 웹앱과 Spring Boot API, Capacitor 안드로이드/iOS를 포함한 Touraz Holic(영화·DVD 큐레이션 및 여행) 서비스. ' +
      '한국관광공사 오픈API를 통해 관광공모전(포토코리아 PhokoAwrd) 수상 사진, 촬영지·동선·웰니스·오디오 가이드 등을 한 흐름으로 연결한다.',
    { size: 10.5 }
  );

  doc.moveDown(0.35);
  if (fonts) doc.font(fonts.bold).fontSize(13).text('2. KTO API 접목');
  else doc.font('Helvetica-Bold').fontSize(13).text('2. KTO API');
  doc.moveDown(0.25);
  paragraph(
    doc,
    '· 관광공모전 수상작: GET /api/v1/cine-trip/photos (지역·키워드 필터)\n' +
      '· 관광사진 갤러리, 두루누비, 반려동반, 무장애, 영문 관광, 의료관광, Odii 오디오 가이드 등 KorWith / DataLab / 기타 KTO 패밀리 API를 백엔드에서 통합.',
    { size: 10.5 }
  );

  doc.moveDown(0.35);
  if (fonts) doc.font(fonts.bold).fontSize(13).text('3. 「제2의 앱」— 풍경 릴 (/film-scenic)');
  else doc.font('Helvetica-Bold').fontSize(13).text('3. Second app: /film-scenic');
  doc.moveDown(0.25);
  paragraph(
    doc,
    '영화 느낌의 여행 인포를 한 화면에 모은 전용 라우트. 포토코리아 수상 사진(PhotoGalleryStrip) + 지역 필터, ' +
      'CineTrip·동선 추천(related-spots)·DVD매장·관광사진 갤러리·오디오 가이드로의 동선을 카드로 제공. ' +
      'i18n(ko/en), 대시보드 여행 바로가기·햄버거 메뉴에서 진입 가능.',
    { size: 10.5 }
  );

  doc.moveDown(0.35);
  if (fonts) doc.font(fonts.bold).fontSize(13).text('4. 기술 스택(요약)');
  else doc.font('Helvetica-Bold').fontSize(13).text('4. Stack');
  doc.moveDown(0.25);
  paragraph(
    doc,
    '프론트: Next.js 16, React 18, i18next, Framer Motion, Capacitor 8\n' +
      '백엔드: Java 17, Spring Boot, Gradle, Flyway(MySQL)\n' +
      '배포: Heroku (프론트 빌드 산출물을 Spring 정적 리소스로 포함)',
    { size: 10.5 }
  );

  doc.moveDown(0.6);
  paragraph(doc, `생성 시각(빌드 머신): ${new Date().toISOString()}`, { size: 9 });
  paragraph(
    doc,
    '저작권·데이터 출처: 관광공모전 이미지는 한국관광공사 포토코리아(PhokoAwrd) 및 앱 내 표기 정책을 따름.',
    { size: 9 }
  );
}

function renderPdfToBuffer(legacyText, fonts) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const collector = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });
    collector.on('finish', () => resolve(Buffer.concat(chunks)));
    collector.on('error', reject);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: '박준호 포트폴리오 — 먹깨비 + Touraz Holic', Author: '박준호' },
    });
    doc.pipe(collector);
    doc.on('error', reject);

    if (fonts) {
      doc.font(fonts.bold).fontSize(16).text('박준호 포트폴리오 (기존 PDF 요약 + Touraz Holic)', { align: 'center' });
    } else {
      doc.font('Helvetica-Bold').fontSize(14).text('Portfolio — Legacy extract + Touraz Holic', { align: 'center' });
    }
    doc.moveDown(0.6);

    if (fonts) doc.font(fonts.bold).fontSize(12).text('기존 포트폴리오 (원본 PDF에서 추출한 텍스트)');
    else doc.font('Helvetica-Bold').fontSize(12).text('Legacy portfolio (text extracted from PDF)');
    doc.moveDown(0.2);
    if (legacyText) {
      paragraph(doc, legacyText, { size: 9.5, gap: 4 });
    } else {
      paragraph(
        doc,
        '원본 PDF에서 텍스트를 추출하지 못했습니다. 이미지 위주 PDF이거나 경로를 확인하세요.\n' +
          `LEGACY: ${LEGACY_PDF}`,
        { size: 10 }
      );
    }

    doc.moveDown(0.5);
    if (fonts) doc.font(fonts.regular).fontSize(10).fillColor('#333333').text('— — — — — — — — — — — — — — — — — —', { align: 'center' });
    else doc.font('Helvetica').fontSize(10).text('----------', { align: 'center' });
    doc.fillColor('#000000');
    doc.moveDown(0.6);

    if (fonts) {
      doc.font(fonts.bold).fontSize(14).text('Touraz Holic — 영화·DVD × 한국관광공사(KTO) 여행 정보', { align: 'center' });
    } else {
      doc.font('Helvetica-Bold').fontSize(13).text('Touraz Holic — Movie/DVD x KTO Travel', { align: 'center' });
    }
    doc.moveDown(0.6);

    writeTourazSection(doc, fonts);
    doc.end();
  });
}

async function writeBufferWithRetry(buffer, dest) {
  const maxAttempts = Math.max(1, parseInt(process.env.PORTFOLIO_WRITE_RETRIES || '30', 10));
  const intervalMs = Math.max(500, parseInt(process.env.PORTFOLIO_WRITE_RETRY_MS || '2000', 10));
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.writeFileSync(dest, buffer);
      return dest;
    } catch (e) {
      lastErr = e;
      const retryable = e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES';
      if (!retryable) throw e;
      console.warn(
        `[portfolio-pdf] 출력 파일 사용 중 (${e.code}), ${intervalMs / 1000}초 후 재시도 (${attempt}/${maxAttempts}). PDF 뷰어에서 이 파일을 닫아 주세요.`
      );
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  const fallback = dest.replace(/\.pdf$/i, '') + '.ready.pdf';
  fs.writeFileSync(fallback, buffer);
  console.warn('[portfolio-pdf] 대상에 쓸 수 없어 대체 파일로 저장했습니다:', fallback, lastErr?.message || '');
  return fallback;
}

async function main() {
  let legacyText = '';
  try {
    legacyText = await extractLegacyText(LEGACY_PDF);
  } catch (e) {
    console.warn('[portfolio-pdf] LEGACY 텍스트 추출 실패:', e.message);
  }

  const fonts = pickFont();
  const pdfBuffer = await renderPdfToBuffer(legacyText, fonts);
  const writtenPath = await writeBufferWithRetry(pdfBuffer, OUT);
  console.log('[portfolio-pdf] LEGACY:', LEGACY_PDF);
  console.log('[portfolio-pdf] wrote', writtenPath);
}

main().catch((err) => {
  console.error('[portfolio-pdf] failed', err);
  process.exit(1);
});
