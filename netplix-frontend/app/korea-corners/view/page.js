'use client';

/**
 * /korea-corners/view — 여행기사 외부 페이지 인앱 뷰어
 * 고정 상단 바로 목록 복귀 경로를 유지한다.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Newspaper } from 'lucide-react';

const RETURN_KEY = 'korea-corners-return';

function isSafeHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function KoreaCornersViewInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || '';
  const fromParam = searchParams.get('from') || '';

  const [returnPath, setReturnPath] = useState('/korea-corners');

  const detailUrl = useMemo(() => (isSafeHttpUrl(rawUrl) ? rawUrl.trim() : ''), [rawUrl]);

  useEffect(() => {
    const saved =
      fromParam && fromParam.startsWith('/korea-corners')
        ? fromParam
        : typeof window !== 'undefined'
          ? sessionStorage.getItem(RETURN_KEY)
          : null;
    if (saved && saved.startsWith('/')) {
      setReturnPath(saved);
    }
  }, [fromParam]);

  const goBack = useCallback(() => {
    router.push(returnPath);
  }, [router, returnPath]);

  if (!detailUrl) {
    return (
      <div className="kcv-root">
        <style>{cssBlock}</style>
        <header className="kcv-bar">
          <Link href="/korea-corners" className="kcv-back">
            <ArrowLeft size={18} aria-hidden />
            {t('koreaCornersPage.backList', '기사 목록')}
          </Link>
        </header>
        <p className="kcv-fallback-msg">{t('koreaCornersPage.invalidLink', '연결할 수 없는 주소예요.')}</p>
      </div>
    );
  }

  return (
    <div className="kcv-root">
      <style>{cssBlock}</style>
      <header className="kcv-bar">
        <button type="button" className="kcv-back" onClick={goBack}>
          <ArrowLeft size={18} aria-hidden />
          {t('koreaCornersPage.backList', '기사 목록')}
        </button>
        <div className="kcv-bar-title">
          <Newspaper size={14} aria-hidden />
          <span className="kcv-bar-name">{title || t('koreaCornersPage.readArticle', '기사 보기')}</span>
        </div>
        <a
          href={detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="kcv-external"
          title={t('koreaCornersPage.openExternal', '외부 브라우저에서 열기')}
        >
          <ExternalLink size={16} aria-hidden />
          <span className="kcv-external-label">{t('koreaCornersPage.openExternalShort', '새 창')}</span>
        </a>
      </header>

      <iframe
        className="kcv-frame"
        src={detailUrl}
        title={title || 'korea-corners-article'}
        referrerPolicy="no-referrer-when-downgrade"
      />

      <p className="kcv-hint">
        {t(
          'koreaCornersPage.viewerHint',
          '화면이 비어 있으면 「새 창」으로 열어 주세요. 목록으로는 상단 「기사 목록」을 누르면 됩니다.',
        )}
      </p>
    </div>
  );
}

export default function KoreaCornersViewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa' }}>Loading…</div>}>
      <KoreaCornersViewInner />
    </Suspense>
  );
}

const cssBlock = `
.kcv-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #0a0b12;
  color: #f5f5f5;
}
.kcv-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  padding-top: max(10px, env(safe-area-inset-top));
  background: rgba(10, 11, 18, 0.96);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.kcv-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  border: 1px solid rgba(251, 191, 36, 0.45);
  background: rgba(249, 115, 22, 0.18);
  color: #fde68a;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.kcv-bar-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d1d5db;
  font-size: 0.8rem;
  font-weight: 600;
}
.kcv-bar-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kcv-external {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 600;
}
@media (max-width: 380px) {
  .kcv-external-label { display: none; }
}
.kcv-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  height: calc(100dvh - 52px - 36px);
  border: none;
  background: #fff;
}
.kcv-hint {
  margin: 0;
  padding: 8px 12px 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  font-size: 0.72rem;
  color: #6b7280;
  text-align: center;
  line-height: 1.4;
  background: #0a0b12;
}
.kcv-fallback-msg {
  margin: 24px 20px;
  color: #9ca3af;
  font-size: 0.9rem;
  line-height: 1.55;
  text-align: center;
}
`;
