'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Loader2, ArrowRight, ArrowLeft, Hash, X, ExternalLink, Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';
import AmbientBackdrop from '@/components/AmbientBackdrop';
import RegionWeatherGlyph from '@/components/RegionWeatherGlyph';
import { MapServiceLinkButton } from '@/components/MapServiceLinkButton';

// "조용한 명소 + 함께 가는 명소" — 잔잔한 데이터 산책 화면.
// 키워드(/grouped/keyword) + 광역 코드(/grouped/area) + 인기 지역(trending-regions) 칩.
//
// KTO TarRlteTarService1 는 (baseYm, areaCd, signguCd, keyword) 를 모두 필수로 요구하므로,
// 백엔드 KoreanPlaceCodes 가 지명 키워드를 BJD (광역2자리, 시군구5자리) 쌍으로 해석한다.
// 사전에 등록된 키워드만 동작 — 자유 입력은 사전 미등록 시 빈 결과를 받는다(안내 문구로 보완).

// 백엔드 KoreanPlaceCodes 와 동일하게 묶음. UI 칩 노출용.
const POPULAR_PLACE_GROUPS = [
  { regionId: 'jeju',      region: '제주',     keywords: ['한라산', '제주시', '서귀포'] },
  { regionId: 'gangwon',   region: '강원',     keywords: ['강릉', '속초', '양양', '춘천'] },
  { regionId: 'gyeongsang',region: '경상',     keywords: ['경주', '안동', '통영', '거제', '남해'] },
  { regionId: 'jeolla',    region: '전라',     keywords: ['여수', '담양', '순천', '목포', '전주'] },
  { regionId: 'city',      region: '도시',     keywords: ['서울', '부산', '인천', '대구', '광주', '대전', '울산'] },
];

const REGISTERED_KEYWORDS = POPULAR_PLACE_GROUPS.flatMap((g) => g.keywords);

/** 외부 지도(동일 탭 이탈 등) 후 복귀 시 모달 상태 복원용 — 경로·시간 일치할 때만 */
const RS_MODAL_RESUME_KEY = 'relatedSpots_resumeModal';

function RelatedSpotsInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialKeyword = searchParams.get('q') || '';
  const initialAreaFromUrl = (searchParams.get('area') || searchParams.get('areaCode') || '').trim();
  const initialSignguFromUrl = (searchParams.get('signgu') || searchParams.get('signguCode') || '').trim();

  const [keyword, setKeyword] = useState(initialKeyword);
  const [trendingRegions, setTrendingRegions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(Boolean(initialKeyword) || Boolean(initialAreaFromUrl));
  const [error, setError] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  // 클릭한 연관 명소 + 기준 명소 정보를 함께 담아 상세 모달에 전달.
  const [selectedSpot, setSelectedSpot] = useState(null);
  const lastReqRef = useRef(0);
  const selectedSpotRef = useRef(null);
  useEffect(() => {
    selectedSpotRef.current = selectedSpot;
  }, [selectedSpot]);

  /** 모달 열 때 히스토리 한 단 쌓아, 안드로이드/브라우저 뒤로가기로 닫히게 함(외부 지도로 이탈 후에도 이 탭이 목록을 유지). */
  const openSpotDetail = useCallback((picked) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(RS_MODAL_RESUME_KEY);
    } catch (_) {}
    const prev = window.history.state || {};
    window.history.pushState(
      { ...prev, rsSpotModal: true },
      '',
      `${window.location.pathname}${window.location.search}`
    );
    setSelectedSpot(picked);
  }, []);

  const closeSpotDetail = useCallback(() => {
    try {
      sessionStorage.removeItem(RS_MODAL_RESUME_KEY);
    } catch (_) {}
    if (typeof window === 'undefined') {
      setSelectedSpot(null);
      return;
    }
    if (!selectedSpotRef.current) return;
    try {
      if (window.history.state?.rsSpotModal === true) {
        window.history.back();
      } else {
        setSelectedSpot(null);
      }
    } catch {
      setSelectedSpot(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onPopState = () => {
      setSelectedSpot((prev) => (prev ? null : prev));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const resumeModalIfNeeded = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (selectedSpotRef.current) return;
    let raw;
    try {
      raw = sessionStorage.getItem(RS_MODAL_RESUME_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem(RS_MODAL_RESUME_KEY);
      } catch (_) {}
      return;
    }
    const { spot, ts, path } = parsed;
    const here = `${window.location.pathname}${window.location.search}`;
    if (!spot?.relatedSpot || typeof ts !== 'number' || Date.now() - ts > 30 * 60 * 1000 || path !== here) {
      try {
        sessionStorage.removeItem(RS_MODAL_RESUME_KEY);
      } catch (_) {}
      return;
    }
    try {
      sessionStorage.removeItem(RS_MODAL_RESUME_KEY);
    } catch (_) {}
    try {
      const prev = window.history.state || {};
      window.history.pushState({ ...prev, rsSpotModal: true }, '', here);
    } catch (_) {}
    setSelectedSpot(spot);
  }, []);

  useEffect(() => {
    resumeModalIfNeeded();
    const onFocus = () => resumeModalIfNeeded();
    const onPageShow = (e) => {
      if (e.persisted) resumeModalIfNeeded();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [resumeModalIfNeeded]);

  const runKeywordSearch = async (q) => {
    const trimmed = (q || '').trim();
    if (!trimmed) return;
    const reqId = ++lastReqRef.current;
    setLoading(true);
    setError(null);
    setTouched(true);
    setUnsupported(false);
    try {
      const res = await axios.get(`/api/v1/tour/related/grouped/keyword`, {
        params: { q: trimmed, limit: 60 },
      });
      if (reqId !== lastReqRef.current) return;
      const data = res?.data?.data ?? [];
      const arr = Array.isArray(data) ? data : [];
      setGroups(arr);
      try {
        const qs = new URLSearchParams();
        qs.set('q', trimmed);
        router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
      } catch (_) {
        /* ignore */
      }
      // 빈 결과인데 사전 미등록 키워드면 안내 토글
      if (arr.length === 0) {
        const norm = trimmed.replace(/\s+/g, '').toLowerCase();
        const hit = REGISTERED_KEYWORDS.some(
          (k) => k.replace(/\s+/g, '').toLowerCase() === norm
        );
        setUnsupported(!hit);
      }
    } catch (e) {
      if (reqId !== lastReqRef.current) return;
      console.error('[related-spots] keyword failed', e?.message || e);
      setError(t('relatedSpots.errorGeneric', '데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setGroups([]);
    } finally {
      if (reqId === lastReqRef.current) setLoading(false);
    }
  };

  const runAreaSearch = useCallback(
    async (areaCode, signguCode, regionLabel) => {
      const ac = String(areaCode || '').trim();
      if (!ac) return;
      const reqId = ++lastReqRef.current;
      setLoading(true);
      setError(null);
      setTouched(true);
      setUnsupported(false);
      if (regionLabel && String(regionLabel).trim()) {
        setKeyword(String(regionLabel).trim());
      }
      try {
        const params = { areaCode: ac, limit: 60 };
        const sg = signguCode != null ? String(signguCode).trim() : '';
        if (sg) params.signguCode = sg;
        const res = await axios.get(`/api/v1/tour/related/grouped/area`, { params });
        if (reqId !== lastReqRef.current) return;
        const data = res?.data?.data ?? [];
        const arr = Array.isArray(data) ? data : [];
        setGroups(arr);
        try {
          const qs = new URLSearchParams();
          qs.set('area', ac);
          if (sg) qs.set('signgu', sg);
          router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
        } catch (_) {
          /* ignore */
        }
      } catch (e) {
        if (reqId !== lastReqRef.current) return;
        console.error('[related-spots] area grouped failed', e?.message || e);
        setError(t('relatedSpots.errorGeneric', '데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
        setGroups([]);
      } finally {
        if (reqId === lastReqRef.current) setLoading(false);
      }
    },
    [pathname, router, t]
  );

  useEffect(() => {
    let alive = true;
    axios
      .get('/api/v1/tour/trending-regions', { params: { limit: 12, period: 'today' } })
      .then((res) => {
        const data = res?.data?.data ?? [];
        if (alive && Array.isArray(data)) setTrendingRegions(data);
      })
      .catch(() => {
        if (alive) setTrendingRegions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (initialKeyword) return;
    if (!initialAreaFromUrl) return;
    runAreaSearch(initialAreaFromUrl, initialSignguFromUrl || undefined, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const discoverTrendingRan = useRef(false);
  useEffect(() => {
    if (discoverTrendingRan.current) return;
    if (searchParams.get('discover') !== 'trending') return;
    if (initialAreaFromUrl || initialKeyword) return;
    if (!trendingRegions.length) return;
    discoverTrendingRan.current = true;
    const r = trendingRegions[0];
    runAreaSearch(r.areaCode, null, r.regionName || r.areaCode);
  }, [trendingRegions, searchParams, initialAreaFromUrl, initialKeyword, runAreaSearch]);

  useEffect(() => {
    if (initialKeyword) runKeywordSearch(initialKeyword);
    // 초기 1회만 실행. 이후엔 사용자 액션으로 호출.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRelated = useMemo(
    () => groups.reduce((acc, g) => acc + (g.related?.length || 0), 0),
    [groups]
  );

  return (
    <div
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        background: 'transparent',
        color: '#f5f5f5',
        padding: '36px 16px 80px',
      }}
    >
      <AmbientBackdrop palette={["#6366f1", "#ec4899", "#34d399", "#fbbf24"]} intensity={0.85} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 980, margin: '0 auto' }}>
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 28 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12,
              color: '#a5b4fc',
              marginBottom: 14,
            }}
          >
            <Sparkles size={14} />
            {t('relatedSpots.heroBadge', '한국관광공사 빅데이터 · 함께 다녀간 곳')}
          </div>
          <h1
            style={{
              fontSize: 'clamp(24px, 5vw, 34px)',
              fontWeight: 800,
              lineHeight: 1.25,
              margin: 0,
              background: 'linear-gradient(120deg, #fef3c7 0%, #fda4af 50%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            dangerouslySetInnerHTML={{ __html: t('relatedSpots.heroTitle', '조용한 명소 옆,<br/>사람들은 어디로 갔을까') }}
          />
          <p
            style={{ marginTop: 10, color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: t('relatedSpots.heroSubtitle', '한 곳을 떠올려 보세요. 그 곁을 거닐던 사람들이<br/>다음으로 향한 자리들을 데이터가 잔잔히 보여드릴게요.') }}
          />
        </motion.div>

        {/* 검색 입력 */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runKeywordSearch(keyword); }}
              placeholder={t('relatedSpots.searchPlaceholder', '여수 · 한라산 · 경주처럼 시·군·구 또는 명소를 적어주세요')}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.25)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => runKeywordSearch(keyword)}
              disabled={loading || !keyword.trim()}
              style={{
                padding: '0 18px',
                borderRadius: 12,
                border: 'none',
                cursor: loading || !keyword.trim() ? 'not-allowed' : 'pointer',
                background: keyword.trim()
                  ? 'linear-gradient(135deg, #6366f1, #ec4899)'
                  : 'rgba(255,255,255,0.06)',
                color: keyword.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? <Loader2 size={14} className="anim-spin" /> : t('relatedSpots.searchSubmit', '잔잔히 찾기')}
            </button>
          </div>

          {/* 검색량 기반 인기 광역 — GET /trending-regions + GET /related/grouped/area */}
          {trendingRegions.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                {t('relatedSpots.trendingSectionTitle', '검색량 기반 인기 지역으로 동선 보기')}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                {t(
                  'relatedSpots.trendingSectionHint',
                  '광역(area) 코드로 한국관광공사 연관 관광지 API를 호출합니다. 아래 칩을 누르면 기준 명소별 ‘함께 다닌 자리’가 바로 펼쳐져요.'
                )}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {trendingRegions.map((r, idx) => (
                  <button
                    key={`${r.areaCode}-${idx}`}
                    type="button"
                    onClick={() => runAreaSearch(r.areaCode, null, r.regionName || r.areaCode)}
                    disabled={loading}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid rgba(45,212,191,0.35)',
                      background: 'rgba(13,148,136,0.2)',
                      color: '#ccfbf1',
                      cursor: loading ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      opacity: loading ? 0.75 : 1,
                    }}
                  >
                    <Compass size={11} />
                    {r.regionName || r.areaCode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 사전 키워드 칩 — 그룹 단위 표시 (KoreanPlaceCodes) */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {POPULAR_PLACE_GROUPS.map((g) => (
              <div key={g.regionId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    minWidth: 36,
                    paddingTop: 6,
                  }}
                >
                  {t(`relatedSpots.regions.${g.regionId}`, g.region)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
                  {g.keywords.map((k) => {
                    const isActive = keyword.trim() === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { setKeyword(k); runKeywordSearch(k); }}
                        style={{
                          fontSize: 12,
                          padding: '6px 12px',
                          borderRadius: 999,
                          border: isActive
                            ? '1px solid rgba(165,180,252,0.7)'
                            : '1px solid rgba(255,255,255,0.1)',
                          background: isActive
                            ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(236,72,153,0.25))'
                            : 'rgba(255,255,255,0.04)',
                          color: isActive ? '#fff' : '#cbd5e1',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <MapPin size={11} />
                        {k}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Empty / loading / error */}
        {loading && (
          <div style={{ textAlign: 'center', color: '#a5b4fc', padding: '24px 0' }}>
            <Loader2 size={20} className="anim-spin" /> {t('relatedSpots.loading', '데이터로 길을 잇는 중…')}
          </div>
        )}
        {!loading && error && (
          <div style={{ textAlign: 'center', color: '#fca5a5', padding: '16px 0' }}>{error}</div>
        )}
        {!loading && !error && !touched && (
          <EmptyHint />
        )}
        {!loading && !error && touched && groups.length === 0 && (
          <NoResult
            unsupported={unsupported}
            onPickPlace={(k) => { setKeyword(k); runKeywordSearch(k); }}
            onFallback={() => router.push('/cine-trip')}
          />
        )}

        {/* Keyword groups */}
        <AnimatePresence>
          {!loading && !error && groups.length > 0 && (
            <motion.div
              key="kw-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
                {t('relatedSpots.summary', '기준 명소 {{groupCount}}곳 · 함께 다녀간 자리 {{relatedCount}}곳을 찾았어요', { groupCount: groups.length, relatedCount: totalRelated })}
              </div>
              {groups.map((g, idx) => (
                <GroupCard
                  key={`${g.baseSpot}-${idx}`}
                  group={g}
                  onPickRelated={openSpotDetail}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ marginTop: 36, textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => router.push('/cine-trip')}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: '#cbd5e1',
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t('relatedSpots.goCineTrip', '영화로 떠나는 여행으로 가기')} <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 상세 모달 */}
      <AnimatePresence>
        {selectedSpot && (
          <SpotDetailModal
            spot={selectedSpot}
            onClose={closeSpotDetail}
            onSearchAgain={(kw) => { setKeyword(kw); runKeywordSearch(kw); }}
          />
        )}
      </AnimatePresence>

      <style jsx>{`
        .anim-spin {
          display: inline-block;
          animation: spin 1s linear infinite;
          vertical-align: -3px;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function GroupCard({ group, onPickRelated }) {
  const { t } = useTranslation();
  const region = [group.areaName, group.signguName].filter(Boolean).join(' · ');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: 'linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.4 }}>{t('relatedSpots.groupStartLabel', '여기서 출발')}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fef3c7' }}>{group.baseSpot}</span>
        <RegionWeatherGlyph areaName={group.areaName} signguName={group.signguName} size={18} />
        {region && <span style={{ fontSize: 11, color: '#a5b4fc' }}>· {region}</span>}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
        {t('relatedSpots.groupCopy', '이 곳을 다녀간 사람들이 함께 / 이어서 향한 자리들이에요. 한 곳을 눌러보면 잔잔하게 길잡이가 펼쳐집니다.')}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {(group.related || []).map((r, i) => (
          <button
            type="button"
            key={`${r.relatedSpot}-${i}`}
            onClick={() => onPickRelated && onPickRelated({ ...r, baseSpot: group.baseSpot, baseAreaName: group.areaName, baseSignguName: group.signguName })}
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              textAlign: 'left',
              color: 'inherit',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.18)';
              e.currentTarget.style.borderColor = 'rgba(165,180,252,0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.25)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <RankBadge rank={r.rank} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5' }}>{r.relatedSpot}</span>
              <RegionWeatherGlyph areaName={r.relatedAreaName} signguName={r.relatedSignguName} size={16} variant="default" />
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {[r.relatedAreaName, r.relatedSignguName].filter(Boolean).join(' · ') || '—'}
            </div>
            {r.category && (
              <div style={{ fontSize: 11, color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Hash size={10} /> {r.category}
              </div>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * 연관 관광지 상세 모달 (바텀시트 풍).
 *
 * 현재 KTO TarRlteTarService1 응답에 좌표/이미지가 포함되지 않아 외부 지도 검색 링크로 깊이를 잇는다.
 * KorService2 활용신청이 승인되면 백엔드 /api/v1/tour/spot/brief 를 추가해 이미지/주소/개요를 페치하도록
 * 확장 예정 (KEY_FORBIDDEN 으로 현재는 폴백 UI 만 제공).
 */
function SpotDetailModal({ spot, onClose, onSearchAgain }) {
  const { t } = useTranslation();
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const persistSpotBeforeExternalMap = useCallback(() => {
    if (typeof window === 'undefined' || !spot) return;
    try {
      const path = `${window.location.pathname}${window.location.search}`;
      sessionStorage.setItem(RS_MODAL_RESUME_KEY, JSON.stringify({ spot, ts: Date.now(), path }));
    } catch (_) {}
  }, [spot]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    if (!spot || !spot.relatedSpot) { setBrief(null); return; }
    setBrief(null);
    setBriefLoading(true);
    const params = { q: spot.relatedSpot };
    if (spot.relatedAreaCd) params.areaCode = spot.relatedAreaCd;
    axios
      .get('/api/v1/tour/spot/brief', { params })
      .then((res) => { if (alive) setBrief(res?.data?.data ?? null); })
      .catch(() => { if (alive) setBrief(null); })
      .finally(() => { if (alive) setBriefLoading(false); });
    return () => { alive = false; };
  }, [spot]);

  if (!spot) return null;

  const title = spot.relatedSpot || t('relatedSpots.modal.untitled', '이름 미상');
  const baseSpot = spot.baseSpot;
  const baseRegion = [spot.baseAreaName, spot.baseSignguName].filter(Boolean).join(' · ');
  const targetRegion = [spot.relatedAreaName, spot.relatedSignguName].filter(Boolean).join(' · ');

  // 지도 검색은 시·군·구 + 명소 이름을 합쳐 정확도를 높임.
  const mapQuery = encodeURIComponent(
    [spot.relatedSignguName, title].filter(Boolean).join(' ')
  );
  const naverMapUrl = `https://map.naver.com/v5/search/${mapQuery}`;
  const kakaoMapUrl = `https://map.kakao.com/?q=${mapQuery}`;
  const googleSearchUrl = `https://www.google.com/search?q=${mapQuery}`;

  // 이 곳을 새 출발점으로 다시 검색해 보기 (시·군·구 이름이 사전에 있을 때만 자연스럽게 동작).
  const followUpKeyword = spot.relatedSignguName || spot.relatedAreaName || '';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(4, 6, 12, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 0 0',
      }}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(8,12,28,0.98))',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          border: '1px solid rgba(165,180,252,0.18)',
          borderBottom: 'none',
          boxShadow: '0 -24px 60px rgba(0,0,0,0.55)',
          padding: 0,
          color: '#f5f5f5',
          position: 'relative',
        }}
      >
        {/* 상단 영역: motion transform 이 있어도 스크롤과 분리되어 뒤로가기·닫기가 항상 보임 (sticky 는 transform 조상에서 깨짐) */}
        <div style={{ flexShrink: 0, padding: '18px 22px 0' }}>
          <div
            aria-hidden
            style={{
              width: 44,
              height: 5,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              margin: '0 auto 14px',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '4px 0 12px',
              borderBottom: '1px solid rgba(148,163,184,0.12)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t('relatedSpots.modal.backToList', '목록으로 돌아가기')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeft size={18} strokeWidth={2.25} aria-hidden />
              {t('relatedSpots.modal.backToList', '목록으로 돌아가기')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('relatedSpots.modal.closeAria', '닫기')}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: '#cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            padding: '12px 22px 28px',
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <RankBadge rank={spot.rank} />
          <h2
            style={{
              margin: 0,
              fontSize: 'clamp(20px, 4.6vw, 26px)',
              fontWeight: 900,
              lineHeight: 1.25,
              background: 'linear-gradient(120deg, #fef3c7 0%, #fda4af 50%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {title}
          </h2>
        </div>
        {targetRegion && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a5b4fc', marginBottom: 14 }}>
            <MapPin size={12} />
            {targetRegion}
          </div>
        )}

        {/* brief: 이미지 + 주소 + 전화 — KorWith/Pet/Eng 폴백으로 가져옴 */}
        <SpotBriefSection brief={brief} loading={briefLoading} title={title} />

        {/* 카테고리 */}
        {spot.category && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(252,165,165,0.08)',
              border: '1px solid rgba(252,165,165,0.22)',
              color: '#fca5a5',
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            <Hash size={12} />
            {spot.category}
          </div>
        )}

        {/* 잔잔 카피: 이 자리가 기준 명소와 어떤 관계인지 */}
        {(() => {
          const baseRegionPart = baseRegion ? ` · ${baseRegion}` : '';
          let html;
          if (baseSpot) {
            if (spot.rank) {
              html = t(
                'relatedSpots.modal.rankRelation',
                '<strong>{{baseSpot}}</strong>{{baseRegionPart}}<br/>를 다녀간 사람들이 <strong>{{rank}}순위</strong>로 발걸음을 옮긴 자리예요.',
                { baseSpot, baseRegionPart, rank: spot.rank }
              );
            } else {
              html = t(
                'relatedSpots.modal.togetherRelation',
                '<strong>{{baseSpot}}</strong>{{baseRegionPart}}<br/>를 다녀간 사람들이 함께로 발걸음을 옮긴 자리예요.',
                { baseSpot, baseRegionPart }
              );
            }
          } else {
            html = t('relatedSpots.modal.noBaseRelation', '이 곳에서 사람들이 다음으로 향했던 자리예요.');
          }
          return (
            <div
              style={{
                margin: '6px 0 18px',
                padding: '14px 16px',
                borderRadius: 14,
                background: 'rgba(99,102,241,0.10)',
                border: '1px solid rgba(165,180,252,0.18)',
                fontSize: 13,
                lineHeight: 1.8,
                color: '#cbd5e1',
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })()}

        {/* 외부 지도 / 검색 — 깊이를 잇는 길잡이 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 8 }}>
          <MapServiceLinkButton href={naverMapUrl} brand="naver" label={t('relatedSpots.modal.naverMap', '네이버 지도')} onBeforeOpen={persistSpotBeforeExternalMap} />
          <MapServiceLinkButton href={kakaoMapUrl} brand="kakao" label={t('relatedSpots.modal.kakaoMap', '카카오맵')} onBeforeOpen={persistSpotBeforeExternalMap} />
          <MapServiceLinkButton href={googleSearchUrl} brand="google" label={t('relatedSpots.modal.googleSearch', '더 찾아보기')} onBeforeOpen={persistSpotBeforeExternalMap} />
        </div>
        <div
          style={{
            marginBottom: 16,
            fontSize: 11,
            color: 'rgba(203,213,225,0.65)',
            textAlign: 'center',
            lineHeight: 1.55,
          }}
        >
          {t(
            'relatedSpots.modal.externalMapsHint',
            '지도·검색은 보통 새 창으로 열려요. 같은 탭으로 열렸다면 브라우저 뒤로가기로 이 페이지로 돌아오면, 방금 보던 길잡이 모달을 다시 띄워 드려요. 시트 맨 위 「목록으로 돌아가기」는 스크롤해도 항상 보여요.'
          )}
        </div>

        {/* "이 곳에서 출발해 보기" — 사전 등록된 시·군·구일 때만 의미가 있어 안내 톤으로 보여줌 */}
        {followUpKeyword && (
          <button
            type="button"
            onClick={() => {
              onSearchAgain && onSearchAgain(followUpKeyword);
              onClose && onClose();
            }}
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 800,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
              boxShadow: '0 12px 30px rgba(139,92,246,0.4)',
            }}
          >
            <Compass size={16} />
            {t('relatedSpots.modal.restartHere', '{{keyword}} 에서 다시 출발해 보기', { keyword: followUpKeyword })}
          </button>
        )}

        <div
          style={{ marginTop: 14, fontSize: 11, color: 'rgba(203,213,225,0.55)', textAlign: 'center', lineHeight: 1.7 }}
          dangerouslySetInnerHTML={{
            __html: brief
              ? t('relatedSpots.modal.deeperHintWithBrief', '운영시간·예약 같은 더 깊은 정보는<br/>외부 지도/검색에서 잔잔히 이어 보세요.')
              : t('relatedSpots.modal.deeperHint', '좌표·사진·운영시간 같은 깊은 정보는<br/>외부 지도/검색에서 잔잔히 이어 보세요.'),
          }}
        />
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * "간단 상세" 섹션 — 이미지 + 주소 + 전화. KorWith / KorPet / Eng 의 searchKeyword2 폴백으로
 * 채워진 brief 가 있을 때만 표시한다. 로딩 중에는 스켈레톤 한 줄, 데이터 부재 시 침묵(외부 링크로 폴백).
 *
 * <p>모든 결과가 KTO 측의 일반 관광 정보라 외부 출처(naver/kakao)와 다르게 사진의 권리/저작권 주체는
 * KTO 라 별도 표기가 안전. 카드 하단에 "출처: 한국관광공사 OOServiceN" 워터마크를 잔잔히 노출.
 */
function SpotBriefSection({ brief, loading, title }) {
  const { t } = useTranslation();
  if (!brief && !loading) return null;
  if (!brief && loading) {
    return (
      <div
        style={{
          margin: '0 0 14px',
          padding: '14px 16px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12,
          color: '#94a3b8',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Loader2 size={14} className="anim-spin" /> {t('relatedSpots.brief.loading', '한국관광공사 풍경을 가만히 가져오는 중…')}
      </div>
    );
  }

  const sourceLabel =
    brief.source === 'with'
      ? t('relatedSpots.brief.sourceWith', '한국관광공사 무장애여행정보')
      : brief.source === 'pet'
      ? t('relatedSpots.brief.sourcePet', '한국관광공사 반려동물 동반정보')
      : brief.source === 'eng'
      ? t('relatedSpots.brief.sourceEng', '한국관광공사 영문 관광정보')
      : t('relatedSpots.brief.sourceDefault', '한국관광공사');

  const fullAddress = [brief.address, brief.addressSub].filter(Boolean).join(' ');
  const showImage = !!brief.firstImage;
  const showAlt = !showImage && !!brief.firstImage2;
  const heroSrc = showImage ? brief.firstImage : brief.firstImage2;

  return (
    <div
      style={{
        margin: '0 0 14px',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {(showImage || showAlt) && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            background: 'rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {/* 외부 호스트 이미지라 next/image 대신 plain img 사용 (cms.visitkorea.or.kr) */}
          <img
            src={heroSrc}
            alt={title}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              padding: '40px 14px 10px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.85)',
              background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
              textAlign: 'right',
            }}
          >
            {t('relatedSpots.brief.sourcePrefix', '출처:')} {sourceLabel}
          </div>
        </div>
      )}

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {brief.title && brief.title !== title && (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            <span style={{ color: '#cbd5e1' }}>{t('relatedSpots.brief.ktoLabel', '한국관광공사 표기')}</span> · {brief.title}
          </div>
        )}
        {fullAddress && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>
            <MapPin size={14} style={{ color: '#a5b4fc', marginTop: 2, flexShrink: 0 }} />
            <span>{fullAddress}</span>
          </div>
        )}
        {brief.tel && (
          <a
            href={`tel:${brief.tel.replace(/[^0-9+]/g, '')}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#fde68a',
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={13} />
            {brief.tel}
          </a>
        )}
        {!showImage && !showAlt && (
          <div style={{ fontSize: 11, color: 'rgba(203,213,225,0.55)' }}>
            {t('relatedSpots.brief.sourcePrefix', '출처:')} {sourceLabel}
          </div>
        )}
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  const { t } = useTranslation();
  if (rank == null) return null;
  const palette =
    rank === 1 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' :
    rank === 2 ? 'linear-gradient(135deg, #cbd5e1, #94a3b8)' :
    rank === 3 ? 'linear-gradient(135deg, #fb923c, #f97316)' :
                 'rgba(255,255,255,0.1)';
  const fg = rank <= 3 ? '#0b1020' : '#cbd5e1';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        padding: '0 6px',
        borderRadius: 999,
        background: palette,
        color: fg,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.3,
      }}
      aria-label={t('relatedSpots.rankAria', '연관 순위 {{rank}}', { rank })}
    >
      #{rank}
    </span>
  );
}

function EmptyHint() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        textAlign: 'center',
        color: '#94a3b8',
        padding: '24px 12px',
        fontSize: 13,
        lineHeight: 1.7,
      }}
      dangerouslySetInnerHTML={{ __html: t('relatedSpots.emptyHint', '먼저 떠올린 한 곳을 입력하거나,<br/>아래 인기 지역 중에서 살짝 골라 보세요.') }}
    />
  );
}

function NoResult({ unsupported, onPickPlace, onFallback }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
      <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 10 }}>
        {t('relatedSpots.noResult.noData', '그 자리에 대한 데이터는 아직 잠잠해요.')}
      </p>
      {unsupported && (
        <div
          style={{
            margin: '0 auto 14px',
            maxWidth: 520,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(165,180,252,0.08)',
            border: '1px solid rgba(165,180,252,0.18)',
            color: '#cbd5e1',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: t('relatedSpots.noResult.unsupportedNote', '한국관광공사 빅데이터는 시·군·구 단위로 모아져 있어요.<br/>아래 인기 지역 중에서 가까운 한 곳을 골라 보면, 그 동네에서 사람들이 함께 다닌 자리들이 살며시 이어서 보여집니다.') }} />
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {['여수', '담양', '경주', '강릉', '한라산', '안동'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => onPickPlace(k)}
                style={{
                  fontSize: 12,
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: '1px solid rgba(165,180,252,0.4)',
                  background: 'rgba(99,102,241,0.18)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                # {k}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onFallback}
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.04)',
          color: '#cbd5e1',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {t('relatedSpots.noResult.fallback', '영화로 떠나는 여행에서 다른 길 보기')}
      </button>
    </div>
  );
}

export default function RelatedSpotsPage() {
  return (
    <Suspense>
      <RelatedSpotsInner />
    </Suspense>
  );
}
