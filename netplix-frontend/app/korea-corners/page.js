'use client';

/**
 * /korea-corners — 한국관광공사 여행기사목록(공공데이터 15121757, api.odcloud.kr)
 * GET /api/v1/tour/travel-articles
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, MapPin, Newspaper, Search } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import AmbientBackdrop from '@/components/AmbientBackdrop';

const REGION_SHORTCUTS = [
  { keyword: '서울', code: '1' },
  { keyword: '부산', code: '6' },
  { keyword: '제주', code: '39' },
  { keyword: '강원', code: '32' },
  { keyword: '경북', code: '37' },
  { keyword: '전남', code: '36' },
];

function KoreaCornersInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialArea = searchParams.get('area') || '';

  const [input, setInput] = useState(initialQ);
  const [keyword, setKeyword] = useState(initialQ);
  const [areaCode, setAreaCode] = useState(initialArea);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const perPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const syncUrl = useCallback(
    (nextQ, nextArea, nextPage) => {
      const params = new URLSearchParams();
      if (nextQ) params.set('q', nextQ);
      if (nextArea) params.set('area', nextArea);
      if (nextPage > 1) params.set('page', String(nextPage));
      const qs = params.toString();
      router.replace(qs ? `/korea-corners?${qs}` : '/korea-corners');
    },
    [router]
  );

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const area = searchParams.get('area') || '';
    const p = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    setInput(q);
    setKeyword(q);
    setAreaCode(area);
    setPage(p);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const params = { page, perPage };
    if (areaCode) params.areaCode = areaCode;
    if (keyword) params.q = keyword;

    axios
      .get('/api/v1/tour/travel-articles', { params, timeout: 28000 })
      .then((res) => {
        if (!alive) return;
        const body = res?.data;
        const data = body?.data;
        if (body && body.success === false) {
          setError(t('koreaCornersPage.loadError', '기사 목록을 불러올 수 없어요.'));
          setItems([]);
          setTotalCount(0);
          return;
        }
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotalCount(Number(data?.totalCount) || 0);
      })
      .catch(() => {
        if (!alive) return;
        setError(t('koreaCornersPage.loadError', '기사 목록을 불러올 수 없어요.'));
        setItems([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page, keyword, areaCode, t]);

  const onSubmit = (e) => {
    e.preventDefault();
    const v = input.trim();
    setKeyword(v);
    setPage(1);
    syncUrl(v, areaCode, 1);
  };

  const onRegion = (code) => {
    const next = areaCode === code ? '' : code;
    setAreaCode(next);
    setPage(1);
    syncUrl(keyword, next, 1);
  };

  const regionLabel = useMemo(() => {
    if (!areaCode) return null;
    const hit = REGION_SHORTCUTS.find((r) => r.code === areaCode);
    return hit
      ? t(`regionShortcuts.${hit.code}`, hit.keyword)
      : areaCode;
  }, [areaCode, t]);

  return (
    <div className="kcc-root">
      <style>{cssBlock}</style>
      <AmbientBackdrop palette={['#f97316', '#22d3ee', '#a3e635', '#f472b6']} intensity={0.88} />

      <header className="kcc-hero">
        <div className="kcc-hero-inner">
          <Link href="/dashboard" className="kcc-back">
            <ArrowLeft size={14} />
            {t('koreaCornersPage.backDashboard', '대시보드')}
          </Link>
          <div className="kcc-tag">
            <Newspaper size={14} />
            <span>Visit Korea Articles</span>
          </div>
          <h1 className="kcc-title">{t('koreaCornersPage.title', '대한민국 구석구석!')}</h1>
          <p className="kcc-sub">
            {t(
              'koreaCornersPage.subtitle',
              '한국관광공사 여행기사로 전국 숨은 명소와 테마 여행을 만나보세요.'
            )}
          </p>

          <form className="kcc-search" onSubmit={onSubmit}>
            <Search size={18} className="kcc-search-icon" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('koreaCornersPage.searchPlaceholder', '지역·키워드로 기사 검색')}
              aria-label={t('koreaCornersPage.searchAria', '기사 검색')}
            />
            <button type="submit">{t('koreaCornersPage.search', '검색')}</button>
          </form>

          <div className="kcc-chips" role="group" aria-label={t('koreaCornersPage.regionAria', '지역 필터')}>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r.code}
                type="button"
                className={areaCode === r.code ? 'kcc-chip kcc-chip-on' : 'kcc-chip'}
                onClick={() => onRegion(r.code)}
              >
                {t(`regionShortcuts.${r.code}`, r.keyword)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="kcc-main">
        <div className="kcc-main-inner">
          {regionLabel && (
            <p className="kcc-filter-hint">
              <MapPin size={14} />
              {t('koreaCornersPage.filterRegion', '{{region}} 지역 기사', { region: regionLabel })}
            </p>
          )}

          {loading && (
            <p className="kcc-status">{t('koreaCornersPage.loading', '기사를 불러오는 중…')}</p>
          )}
          {!loading && error && <p className="kcc-status kcc-error">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="kcc-status">{t('koreaCornersPage.empty', '표시할 기사가 없어요.')}</p>
          )}

          <ul className="kcc-grid">
            {items.map((item) => (
              <li key={item.contentId || item.detailUrl || item.title} className="kcc-card">
                <a
                  href={item.detailUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kcc-card-link"
                >
                  <div className="kcc-thumb">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="kcc-thumb-fallback" aria-hidden>
                        <Newspaper size={32} />
                      </div>
                    )}
                  </div>
                  <div className="kcc-body">
                    {item.categoryName && (
                      <span className="kcc-cat">{item.categoryName}</span>
                    )}
                    <h2 className="kcc-card-title">{item.title}</h2>
                    {(item.areaName || item.signguName) && (
                      <p className="kcc-loc">
                        <MapPin size={12} />
                        {[item.areaName, item.signguName].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <span className="kcc-read">
                      {t('koreaCornersPage.readArticle', '기사 보기')}
                      <ExternalLink size={13} aria-hidden />
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>

          {!loading && totalPages > 1 && (
            <nav className="kcc-pager" aria-label={t('koreaCornersPage.pagerAria', '페이지')}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const np = page - 1;
                  setPage(np);
                  syncUrl(keyword, areaCode, np);
                }}
              >
                {t('koreaCornersPage.prev', '이전')}
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const np = page + 1;
                  setPage(np);
                  syncUrl(keyword, areaCode, np);
                }}
              >
                {t('koreaCornersPage.next', '다음')}
              </button>
            </nav>
          )}

          <p className="kcc-source">
            {t('koreaCornersPage.source', '출처: 한국관광공사 여행기사목록 · 공공데이터포털')}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function KoreaCornersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, color: '#aaa' }}>Loading…</div>
      }
    >
      <KoreaCornersInner />
    </Suspense>
  );
}

const cssBlock = `
.kcc-root {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  overflow-x: hidden;
  background: transparent;
  color: #f5f5f5;
}
.kcc-hero {
  position: relative;
  z-index: 1;
  padding: 40px 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.kcc-hero-inner { max-width: 1100px; margin: 0 auto; }
.kcc-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}
.kcc-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fdba74;
  background: rgba(249, 115, 22, 0.14);
  border: 1px solid rgba(249, 115, 22, 0.35);
  padding: 6px 10px;
  border-radius: 999px;
}
.kcc-title {
  margin: 14px 0 8px;
  font-size: clamp(26px, 4.5vw, 40px);
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(92deg, #fdba74 0%, #fde047 40%, #67e8f9 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.kcc-sub {
  margin: 0 0 18px;
  color: #bdbdbd;
  font-size: 0.95rem;
  max-width: 640px;
  line-height: 1.55;
}
.kcc-search {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 520px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 6px 8px 6px 14px;
}
.kcc-search-icon { color: #94a3b8; flex-shrink: 0; }
.kcc-search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 14px;
  outline: none;
}
.kcc-search button {
  border: none;
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  color: #0f172a;
  background: linear-gradient(135deg, #fde047, #fb923c);
}
.kcc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.kcc-chip {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #d4d4d4;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.kcc-chip-on {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.16);
  color: #fde68a;
}
.kcc-main { position: relative; z-index: 1; padding: 24px 20px 48px; }
.kcc-main-inner { max-width: 1100px; margin: 0 auto; }
.kcc-filter-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #a3e635;
  margin: 0 0 16px;
}
.kcc-status {
  text-align: center;
  color: #a3a3a3;
  padding: 32px 12px;
  font-size: 14px;
}
.kcc-error { color: #fca5a5; }
.kcc-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.kcc-card {
  border-radius: 16px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.kcc-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
}
.kcc-card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
  color: inherit;
}
.kcc-thumb {
  aspect-ratio: 16 / 10;
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
}
.kcc-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.kcc-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.35);
}
.kcc-body { padding: 14px 14px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.kcc-cat {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fdba74;
}
.kcc-card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
  color: #fafafa;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.kcc-loc {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a3a3a3;
}
.kcc-read {
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: #67e8f9;
}
.kcc-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 28px;
}
.kcc-pager button {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  color: #e5e5e5;
  border-radius: 999px;
  padding: 8px 18px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
}
.kcc-pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.kcc-pager span { font-size: 13px; color: #a3a3a3; }
.kcc-source {
  margin: 28px 0 0;
  text-align: center;
  font-size: 11px;
  color: #737373;
}
`;
