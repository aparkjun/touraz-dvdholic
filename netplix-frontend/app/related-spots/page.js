'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Loader2, ArrowRight, Hash } from 'lucide-react';
import axios from '@/lib/axiosConfig';

// "조용한 명소 + 함께 가는 명소" — 잔잔한 데이터 산책 화면.
// 단일 키워드 모드 + 인기 지역 칩.
//
// KTO TarRlteTarService1 는 (baseYm, areaCd, signguCd, keyword) 를 모두 필수로 요구하므로,
// 백엔드 KoreanPlaceCodes 가 지명 키워드를 BJD (광역2자리, 시군구5자리) 쌍으로 해석한다.
// 사전에 등록된 키워드만 동작 — 자유 입력은 사전 미등록 시 빈 결과를 받는다(안내 문구로 보완).

// 백엔드 KoreanPlaceCodes 와 동일하게 묶음. UI 칩 노출용.
const POPULAR_PLACE_GROUPS = [
  { region: '제주',     keywords: ['한라산', '제주시', '서귀포'] },
  { region: '강원',     keywords: ['강릉', '속초', '양양', '춘천'] },
  { region: '경상',     keywords: ['경주', '안동', '통영', '거제', '남해'] },
  { region: '전라',     keywords: ['여수', '담양', '순천', '목포', '전주'] },
  { region: '도시',     keywords: ['서울', '부산', '인천', '대구', '광주', '대전', '울산'] },
];

const REGISTERED_KEYWORDS = POPULAR_PLACE_GROUPS.flatMap((g) => g.keywords);

function RelatedSpotsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialKeyword = searchParams.get('q') || '';

  const [keyword, setKeyword] = useState(initialKeyword);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(Boolean(initialKeyword));
  const [error, setError] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  const lastReqRef = useRef(0);

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
      setError('데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      setGroups([]);
    } finally {
      if (reqId === lastReqRef.current) setLoading(false);
    }
  };

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
        minHeight: '100vh',
        width: '100%',
        background:
          'radial-gradient(900px 540px at 15% -10%, rgba(99,102,241,0.18), transparent), radial-gradient(900px 540px at 100% 10%, rgba(236,72,153,0.12), transparent), radial-gradient(140% 140% at 50% 110%, #04060c 40%, #0c1330 100%)',
        color: '#f5f5f5',
        padding: '36px 16px 80px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
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
            한국관광공사 빅데이터 · 함께 다녀간 곳
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
          >
            조용한 명소 옆,<br />사람들은 어디로 갔을까
          </h1>
          <p style={{ marginTop: 10, color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>
            한 곳을 떠올려 보세요. 그 곁을 거닐던 사람들이<br />다음으로 향한 자리들을 데이터가 잔잔히 보여드릴게요.
          </p>
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
              placeholder="여수 · 한라산 · 경주처럼 시·군·구 또는 명소를 적어주세요"
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
              {loading ? <Loader2 size={14} className="anim-spin" /> : '잔잔히 찾기'}
            </button>
          </div>

          {/* 인기 지역 칩 — 그룹 단위 표시 */}
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {POPULAR_PLACE_GROUPS.map((g) => (
              <div key={g.region} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
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
                  {g.region}
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
            <Loader2 size={20} className="anim-spin" /> 데이터로 길을 잇는 중…
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
                기준 명소 {groups.length}곳 · 함께 다녀간 자리 {totalRelated}곳을 찾았어요
              </div>
              {groups.map((g, idx) => (
                <GroupCard key={`${g.baseSpot}-${idx}`} group={g} />
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
            영화로 떠나는 여행으로 가기 <ArrowRight size={14} />
          </button>
        </div>
      </div>

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

function GroupCard({ group }) {
  const router = useRouter();
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
        <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.4 }}>여기서 출발</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fef3c7' }}>{group.baseSpot}</span>
        {region && <span style={{ fontSize: 11, color: '#a5b4fc' }}>· {region}</span>}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
        이 곳을 다녀간 사람들이 함께 / 이어서 향한 자리들이에요.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {(group.related || []).map((r, i) => (
          <div
            key={`${r.relatedSpot}-${i}`}
            onClick={() => router.push(`/related-spots?q=${encodeURIComponent(r.relatedSpot || '')}`)}
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RankBadge rank={r.rank} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f5' }}>{r.relatedSpot}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {[r.relatedAreaName, r.relatedSignguName].filter(Boolean).join(' · ') || '—'}
            </div>
            {r.category && (
              <div style={{ fontSize: 11, color: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Hash size={10} /> {r.category}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function RankBadge({ rank }) {
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
      aria-label={`연관 순위 ${rank}`}
    >
      #{rank}
    </span>
  );
}

function EmptyHint() {
  return (
    <div
      style={{
        textAlign: 'center',
        color: '#94a3b8',
        padding: '24px 12px',
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      먼저 떠올린 한 곳을 입력하거나,<br />아래 인기 지역 중에서 살짝 골라 보세요.
    </div>
  );
}

function NoResult({ unsupported, onPickPlace, onFallback }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
      <p style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 10 }}>
        그 자리에 대한 데이터는 아직 잠잠해요.
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
          한국관광공사 빅데이터는 시·군·구 단위로 모아져 있어요.<br />
          아래 인기 지역 중에서 가까운 한 곳을 골라 보면, 그 동네에서 사람들이 함께 다닌 자리들이 살며시 이어서 보여집니다.
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
        영화로 떠나는 여행에서 다른 길 보기
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
