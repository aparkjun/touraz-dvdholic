/**
 * 포트폴리오 PDF 덮어쓰기 — Touraz Holic · 풍경 릴(KTO 공모전 연동) 요약
 * 실행: node scripts/write-portfolio-pdf.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const OUT = process.env.PORTFOLIO_PDF_OUT
  || 'C:/Users/USER/Downloads/박준호_portpollo (1) (1).pdf';

const FONT_KO = 'C:/Windows/Fonts/malgun.ttf';
const FONT_KO_BOLD = 'C:/Windows/Fonts/malgunbd.ttf';

function pickFont() {
  if (fs.existsSync(FONT_KO)) return { regular: FONT_KO, bold: fs.existsSync(FONT_KO_BOLD) ? FONT_KO_BOLD : FONT_KO };
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

const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Touraz Holic · 풍경 릴', Author: '박준호' } });
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const fonts = pickFont();
if (fonts) {
  doc.font(fonts.bold).fontSize(18).text('Touraz Holic — 영화·DVD × 한국관광공사(KTO) 여행 정보', { align: 'center' });
} else {
  doc.font('Helvetica-Bold').fontSize(16).text('Touraz Holic — Movie/DVD x KTO Travel (summary)', { align: 'center' });
}
doc.moveDown(0.8);

paragraph(doc, '배포 URL: https://touraz-dvdholic-2507bcb348dd.herokuapp.com/', { size: 10, bold: false });
paragraph(doc, '본 문서는 기존 포트폴리오 PDF를 프로젝트 최신 내용으로 갱신·덮어쓴 버전입니다.', { size: 10 });

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
paragraph(doc, '저작권·데이터 출처: 관광공모전 이미지는 한국관광공사 포토코리아(PhokoAwrd) 및 앱 내 표기 정책을 따름.', { size: 9 });

doc.end();

stream.on('finish', () => {
  console.log('[portfolio-pdf] wrote', OUT);
});

stream.on('error', (err) => {
  console.error('[portfolio-pdf] failed', err);
  process.exit(1);
});
