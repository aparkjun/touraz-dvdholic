'use client';

/**
 * /safe-tourism/view — 외부 홈페이지(Visit Seoul 등) 인앱 뷰어
 * 고정 상단 바로 목록 복귀 경로를 유지한다.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';

const RETURN_KEY = 'safe-tourism-return';

function isSafeHttpUrl(raw) {
  if (!raw || typeof raw !== 'string') return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function SafeTourismViewInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || '';
  const fromParam = searchParams.get('from') || '';

  const [returnPath, setReturnPath] = useState('/safe-tourism');

  const detailUrl = useMemo(() => (isSafeHttpUrl(rawUrl) ? rawUrl.trim() : ''), [rawUrl]);

  useEffect(() => {
    const saved =
      fromParam && fromParam.startsWith('/safe-tourism')
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
      <div className="stv-root">
        <style>{cssBlock}</style>
        <header className="stv-bar">
          <Link href="/safe-tourism" className="stv-back">
            <ArrowLeft size={18} aria-hidden />
            {t('safeTourismPage.backList', '안심관광지 목록')}
          </Link>
        </header>
        <p className="stv-fallback-msg">{t('safeTourismPage.invalidLink', '연결할 수 없는 주소예요.')}</p>
      </div>
    );
  }

  return (
    <div className="stv-root">
      <style>{cssBlock}</style>
      <header className="stv-bar">
        <button type="button" className="stv-back" onClick={goBack}>
          <ArrowLeft size={18} aria-hidden />
          {t('safeTourismPage.backList', '안심관광지 목록')}
        </button>
        <div className="stv-bar-title">
          <ShieldCheck size={14} aria-hidden />
          <span className="stv-bar-name">{title || t('safeTourismPage.viewDetail', '상세 보기')}</span>
        </div>
        <a
          href={detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="stv-external"
          title={t('safeTourismPage.openExternal', '외부 브라우저에서 열기')}
        >
          <ExternalLink size={16} aria-hidden />
          <span className="stv-external-label">{t('safeTourismPage.openExternalShort', '새 창')}</span>
        </a>
      </header>

      <iframe
        className="stv-frame"
        src={detailUrl}
        title={title || 'safe-tourism-detail'}
        referrerPolicy="no-referrer-when-downgrade"
      />

      <p className="stv-hint">
        {t(
          'safeTourismPage.viewerHint',
          '화면이 비어 있으면 「새 창」으로 열어 주세요. 목록으로는 상단 「안심관광지 목록」을 누르면 됩니다.',
        )}
      </p>
    </div>
  );
}

export default function SafeTourismViewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa' }}>Loading…</div>}>
      <SafeTourismViewInner />
    </Suspense>
  );
}

const cssBlock = `
.stv-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #0a0b12;
  color: #f5f5f5;
}
.stv-bar {
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
.stv-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  border: 1px solid rgba(45, 212, 191, 0.45);
  background: rgba(20, 184, 166, 0.18);
  color: #99f6e4;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.stv-bar-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d1d5db;
  font-size: 0.8rem;
  font-weight: 600;
}
.stv-bar-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stv-external {
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
  .stv-external-label { display: none; }
}
.stv-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  height: calc(100dvh - 52px - 36px);
  border: none;
  background: #fff;
}
.stv-hint {
  margin: 0;
  padding: 8px 12px 12px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  font-size: 0.72rem;
  color: #6b7280;
  text-align: center;
  line-height: 1.4;
  background: #0a0b12;
}
.stv-fallback-msg {
  margin: 24px 20px;
  color: #9ca3af;
  font-size: 0.9rem;
  line-height: 1.55;
  text-align: center;
}
`;
