'use client';

/**
 * /safe-tourism — 한국관광공사 비대면 안심관광지 목록(api.odcloud.kr)
 * GET /api/v1/tour/safe-tourism-spots
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Leaf,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import AmbientBackdrop from '@/components/AmbientBackdrop';

const REGION_SHORTCUTS = [
  { keyword: '서울' },
  { keyword: '부산' },
  { keyword: '제주' },
  { keyword: '강원' },
  { keyword: '경북' },
  { keyword: '전남' },
];

function SafeTourismInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialArea = searchParams.get('area') || '';

  const [input, setInput] = useState(initialQ);
  const [keyword, setKeyword] = useState(initialQ);
  const [areaKeyword, setAreaKeyword] = useState(initialArea);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [configured, setConfigured] = useState(true);
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
      router.replace(qs ? `/safe-tourism?${qs}` : '/safe-tourism');
    },
    [router],
  );

  useEffect(() => {
    const q = searchParams.get('q') || '';
    const area = searchParams.get('area') || '';
    const p = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    setInput(q);
    setKeyword(q);
    setAreaKeyword(area);
    setPage(p);
  }, [searchParams]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const params = { page, perPage };
    if (areaKeyword) params.area = areaKeyword;
    if (keyword) params.q = keyword;

    axios
      .get('/api/v1/tour/safe-tourism-spots', { params, timeout: 28000 })
      .then((res) => {
        if (!alive) return;
        const body = res?.data;
        const data = body?.data;
        setConfigured(data?.configured !== false);
        if (body && body.success === false) {
          setError(t('safeTourismPage.loadError', '목록을 불러올 수 없어요.'));
          setItems([]);
          setTotalCount(0);
          return;
        }
        if (data?.configured === false) {
          setError(t('safeTourismPage.notConfigured', '서버에 안심관광지 API URL이 설정되지 않았습니다.'));
          setItems([]);
          setTotalCount(0);
          return;
        }
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotalCount(Number(data?.totalCount) || 0);
      })
      .catch(() => {
        if (!alive) return;
        setError(t('safeTourismPage.loadError', '목록을 불러올 수 없어요.'));
        setItems([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page, keyword, areaKeyword, t]);

  const onSubmit = (e) => {
    e.preventDefault();
    const v = input.trim();
    setKeyword(v);
    setPage(1);
    syncUrl(v, areaKeyword, 1);
  };

  const onRegion = (kw) => {
    const next = areaKeyword === kw ? '' : kw;
    setAreaKeyword(next);
    setPage(1);
    syncUrl(keyword, next, 1);
  };

  const areaLabel = useMemo(() => areaKeyword || null, [areaKeyword]);

  return (
    <div className="stc-root">
      <style>{cssBlock}</style>
      <AmbientBackdrop palette={['#14b8a6', '#22d3ee', '#a7f3d0', '#0ea5e9']} intensity={0.88} />

      <header className="stc-hero">
        <div className="stc-hero-inner">
          <Link href="/dashboard" className="stc-back">
            <ArrowLeft size={14} />
            {t('safeTourismPage.backDashboard', '대시보드')}
          </Link>
          <div className="stc-tag">
            <ShieldCheck size={14} />
            <span>KTO Safe Tourism</span>
          </div>
          <h1 className="stc-title">
            {t('safeTourismPage.title', '비대면 안심관광지')}
          </h1>
          <p className="stc-sub">
            {t(
              'safeTourismPage.subtitle',
              '한적하고 안전한 비대면·언택트 관광지를 한국관광공사 공공데이터로 만나보세요.',
            )}
          </p>

          <form className="stc-search" onSubmit={onSubmit}>
            <Search size={18} className="stc-search-icon" aria-hidden />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('safeTourismPage.searchPlaceholder', '관광지명·지역·시즌 검색')}
              aria-label={t('safeTourismPage.searchAria', '관광지 검색')}
            />
            <button type="submit">{t('safeTourismPage.search', '검색')}</button>
          </form>

          <div className="stc-chips" role="group" aria-label={t('safeTourismPage.regionAria', '지역 필터')}>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r.keyword}
                type="button"
                className={areaKeyword === r.keyword ? 'stc-chip stc-chip-on' : 'stc-chip'}
                onClick={() => onRegion(r.keyword)}
              >
                {r.keyword}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="stc-main">
        <div className="stc-main-inner">
          {areaLabel && (
            <p className="stc-filter-hint">
              <MapPin size={14} />
              {t('safeTourismPage.filterRegion', '{{region}} 지역', { region: areaLabel })}
            </p>
          )}

          {loading && (
            <p className="stc-status">{t('safeTourismPage.loading', '목록을 불러오는 중…')}</p>
          )}
          {!loading && error && <p className="stc-status stc-error">{error}</p>}
          {!loading && !error && configured && items.length === 0 && (
            <p className="stc-status">{t('safeTourismPage.empty', '표시할 안심관광지가 없어요.')}</p>
          )}

          <ul className="stc-grid">
            {items.map((item) => (
              <li key={item.id || item.name} className="stc-card">
                <a
                  href={item.detailUrl || '#'}
                  target={item.detailUrl ? '_blank' : undefined}
                  rel={item.detailUrl ? 'noopener noreferrer' : undefined}
                  className="stc-card-link"
                  onClick={!item.detailUrl ? (e) => e.preventDefault() : undefined}
                >
                  <div className="stc-thumb">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="stc-thumb-fallback" aria-hidden>
                        <Leaf size={32} />
                      </div>
                    )}
                  </div>
                  <div className="stc-body">
                    <div className="stc-badge-row">
                      {item.season && <span className="stc-badge">{item.season}</span>}
                      {item.theme && <span className="stc-badge stc-badge-theme">{item.theme}</span>}
                    </div>
                    <h2 className="stc-card-title">{item.name}</h2>
                    {(item.address || item.areaName || item.signguName) && (
                      <p className="stc-loc">
                        <MapPin size={12} />
                        {[item.areaName, item.signguName, item.address].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {item.intro && <p className="stc-intro">{item.intro}</p>}
                    {item.detailUrl && (
                      <span className="stc-read">
                        {t('safeTourismPage.viewDetail', '상세 보기')}
                        <ExternalLink size={13} aria-hidden />
                      </span>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>

          {!loading && totalPages > 1 && (
            <nav className="stc-pager" aria-label={t('safeTourismPage.pagerAria', '페이지')}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const np = page - 1;
                  setPage(np);
                  syncUrl(keyword, areaKeyword, np);
                }}
              >
                {t('safeTourismPage.prev', '이전')}
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
                  syncUrl(keyword, areaKeyword, np);
                }}
              >
                {t('safeTourismPage.next', '다음')}
              </button>
            </nav>
          )}

          <p className="stc-source">
            {t('safeTourismPage.source', '출처: 한국관광공사 비대면 안심관광지 목록 · 공공데이터포털')}
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SafeTourismPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa' }}>Loading…</div>}>
      <SafeTourismInner />
    </Suspense>
  );
}

const cssBlock = `
.stc-root {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  overflow-x: hidden;
  background: transparent;
  color: #f5f5f5;
}
.stc-hero {
  position: relative;
  z-index: 1;
  padding: 40px 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.stc-hero-inner { max-width: 1100px; margin: 0 auto; }
.stc-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.72);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}
.stc-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #99f6e4;
  background: rgba(20, 184, 166, 0.14);
  border: 1px solid rgba(45, 212, 191, 0.35);
  padding: 6px 10px;
  border-radius: 999px;
}
.stc-title {
  margin: 14px 0 8px;
  font-size: clamp(26px, 4.5vw, 40px);
  font-weight: 900;
  letter-spacing: -0.02em;
  background: linear-gradient(92deg, #5eead4 0%, #7dd3fc 50%, #a7f3d0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.stc-sub {
  margin: 0 0 18px;
  color: #bdbdbd;
  font-size: 0.95rem;
  max-width: 640px;
  line-height: 1.55;
}
.stc-search {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 520px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 6px 8px 6px 14px;
}
.stc-search-icon { color: #5eead4; flex-shrink: 0; }
.stc-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.92rem;
  outline: none;
}
.stc-search button {
  border: none;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #042f2e;
  background: linear-gradient(135deg, #5eead4, #22d3ee);
  cursor: pointer;
}
.stc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.stc-chip {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.05);
  color: #d1d5db;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
}
.stc-chip-on {
  color: #ccfbf1;
  border-color: rgba(45, 212, 191, 0.5);
  background: rgba(20, 184, 166, 0.2);
}
.stc-main {
  position: relative;
  z-index: 1;
  padding: 24px 20px 48px;
}
.stc-main-inner { max-width: 1100px; margin: 0 auto; }
.stc-filter-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  color: #a7f3d0;
  margin: 0 0 14px;
}
.stc-status { color: #aaa; font-size: 0.9rem; margin: 0 0 16px; }
.stc-error { color: #fca5a5; }
.stc-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
@media (min-width: 640px) { .stc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 960px) { .stc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.stc-card {
  background: rgba(20, 24, 22, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease;
}
.stc-card:hover {
  transform: translateY(-2px);
  border-color: rgba(45, 212, 191, 0.35);
}
.stc-card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  text-decoration: none;
  color: inherit;
}
.stc-thumb {
  position: relative;
  padding-top: 56%;
  background: #0e1410;
}
.stc-thumb img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.stc-thumb-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2dd4bf;
  opacity: 0.5;
}
.stc-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
.stc-badge-row { display: flex; flex-wrap: wrap; gap: 6px; }
.stc-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #99f6e4;
  background: rgba(20, 184, 166, 0.16);
  border: 1px solid rgba(45, 212, 191, 0.28);
  padding: 3px 8px;
  border-radius: 999px;
}
.stc-badge-theme { color: #bae6fd; background: rgba(14, 165, 233, 0.14); border-color: rgba(56, 189, 248, 0.28); }
.stc-card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.35;
  color: #f5f5f5;
}
.stc-loc {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  color: #9ca3af;
}
.stc-intro {
  margin: 0;
  font-size: 0.82rem;
  color: #c4c8cc;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.stc-read {
  margin-top: auto;
  padding-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #5eead4;
}
.stc-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}
.stc-pager button {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 600;
}
.stc-pager button:disabled { opacity: 0.4; cursor: not-allowed; }
.stc-source {
  margin-top: 28px;
  font-size: 0.78rem;
  color: #6b7280;
  text-align: center;
}
`;
