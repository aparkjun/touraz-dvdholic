'use client';

/**
 * /korea-corners/view — 여행기사 외부 페이지 인앱 뷰어
 * 고정 상단 바로 목록 복귀 경로를 유지한다.
 * iOS: iframe 이 WebView/뒤로가기를 가로채지 않도록 네이티브 브라우저로 연다.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Newspaper } from 'lucide-react';
import useViewerBack from '@/lib/useViewerBack';
import {
  isHttpUrl,
  isNativeCapacitor,
  openExternalUrl,
} from '@/lib/openExternalUrl';

const RETURN_KEY = 'korea-corners-return';

function KoreaCornersViewInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const rawUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || '';
  const fromParam = searchParams.get('from') || '';

  const [returnPath, setReturnPath] = useState('/korea-corners');
  const [nativeShell, setNativeShell] = useState(false);

  const detailUrl = useMemo(() => (isHttpUrl(rawUrl) ? rawUrl.trim() : ''), [rawUrl]);
  const goBack = useViewerBack(returnPath, '/korea-corners');

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const native = await isNativeCapacitor();
      if (cancelled) return;
      setNativeShell(native);
      if (native && detailUrl) {
        await openExternalUrl(detailUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailUrl]);

  const openOutside = useCallback(() => {
    if (detailUrl) openExternalUrl(detailUrl);
  }, [detailUrl]);

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
        <button
          type="button"
          className="kcv-external"
          onClick={openOutside}
          title={t('koreaCornersPage.openExternal', '외부 브라우저에서 열기')}
        >
          <ExternalLink size={16} aria-hidden />
          <span className="kcv-external-label">{t('koreaCornersPage.openExternalShort', '새 창')}</span>
        </button>
      </header>

      {nativeShell ? (
        <div className="kcv-native">
          <p className="kcv-native-msg">
            {t(
              'koreaCornersPage.nativeOpened',
              '대한민국 구석구석 기사를 외부 창에서 열었습니다. 창을 닫으면 이 화면으로 돌아옵니다.',
            )}
          </p>
          <button type="button" className="kcv-native-reopen" onClick={openOutside}>
            {t('koreaCornersPage.openExternal', '외부 브라우저에서 열기')}
          </button>
        </div>
      ) : (
        <iframe
          className="kcv-frame"
          src={detailUrl}
          title={title || 'korea-corners-article'}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      )}

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
  height: calc(100dvh - 64px - env(safe-area-inset-top, 0px));
  max-height: calc(100dvh - 64px - env(safe-area-inset-top, 0px));
  overflow: hidden;
  background: #0a0b12;
  color: #f5f5f5;
}
.kcv-bar {
  position: relative;
  z-index: 30;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
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
  cursor: pointer;
}
@media (max-width: 380px) {
  .kcv-external-label { display: none; }
}
.kcv-frame {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  border: none;
  background: #fff;
  position: relative;
  z-index: 0;
}
.kcv-native {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 20px;
  text-align: center;
}
.kcv-native-msg {
  margin: 0;
  max-width: 360px;
  color: #d1d5db;
  font-size: 0.95rem;
  line-height: 1.55;
}
.kcv-native-reopen {
  border: 1px solid rgba(251, 191, 36, 0.45);
  background: rgba(249, 115, 22, 0.2);
  color: #fde68a;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 10px 16px;
  border-radius: 999px;
  cursor: pointer;
}
.kcv-hint {
  flex-shrink: 0;
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
