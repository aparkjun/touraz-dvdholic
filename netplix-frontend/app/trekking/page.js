'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Footprints,
  Mountain,
  Leaf,
  Sun,
  Route,
  ArrowLeft,
  Waves,
  MapPin,
  Clock,
  Gauge,
  Download,
  Compass,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';

/**
 * 코스로 떠나는 걷기여행 (코리아둘레길 · 두루누비) 페이지.
 *
 * 데이터 소스: 한국관광공사 두루누비 정보 서비스 GW (B551011/Durunubi)
 *  - GET /api/v1/tour/trekking/routes  → routeList
 *  - GET /api/v1/tour/trekking/courses → courseList (brdDiv/routeIdx/keyword 필터)
 *
 * UI: 대시보드 "코스로 떠나는 걷기여행" CTA 와 동일한 mint·butter·sky·moss 팔레트.
 */

// 대표 brdDiv 코드 → 한글 라벨(필터 칩). API 원문 brdNm 이 오면 덮어쓴다.
const FALLBACK_BRD_LABEL = {
  DNWW: '해파랑길',
  DNBW: '남파랑길',
  DNHW: '서해랑길',
  DNJJ: 'DMZ 평화의 길',
  DNKW: '강화 나들길',
};

const BRD_ACCENT = {
  DNWW: { bg: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)', chipBg: 'rgba(14,165,233,0.18)', chip: '#7dd3fc' },
  DNBW: { bg: 'linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)', chipBg: 'rgba(20,184,166,0.18)', chip: '#6ee7b7' },
  DNHW: { bg: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)', chipBg: 'rgba(245,158,11,0.18)', chip: '#fde68a' },
  DNJJ: { bg: 'linear-gradient(135deg, #a78bfa 0%, #38bdf8 100%)', chipBg: 'rgba(167,139,250,0.18)', chip: '#c4b5fd' },
  _default: { bg: 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)', chipBg: 'rgba(110,231,183,0.18)', chip: '#a7f3d0' },
};

const accentFor = (code) => BRD_ACCENT[code] || BRD_ACCENT._default;

export default function TrekkingPage() {
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState(null);

  const [activeBrd, setActiveBrd] = useState(null);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState(null);

  // routeList 에서 추출한 brdDiv → brdNm 매핑
  const brdLabel = useMemo(() => {
    const map = { ...FALLBACK_BRD_LABEL };
    routes.forEach((r) => {
      if (r?.brdDiv) {
        const label = r.brdNm || r.lnm || r.displayName;
        if (label) map[r.brdDiv] = label;
      }
    });
    return map;
  }, [routes]);

  // 필터 칩: API routes 에 포함된 brdDiv + fallback 상위 4종의 합집합
  const brdFilters = useMemo(() => {
    const set = new Set(routes.map((r) => r?.brdDiv).filter(Boolean));
    ['DNWW', 'DNBW', 'DNHW', 'DNJJ'].forEach((b) => set.add(b));
    return Array.from(set);
  }, [routes]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setRoutesLoading(true);
      setRoutesError(null);
      try {
        const res = await axios.get('/api/v1/tour/trekking/routes?limit=30');
        const data = res?.data?.data ?? [];
        if (!alive) return;
        setRoutes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[trekking-routes] fetch failed:', e?.message || e);
        if (alive) setRoutesError('길 목록을 불러올 수 없어요');
      } finally {
        if (alive) setRoutesLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setCoursesLoading(true);
      setCoursesError(null);
      try {
        const params = new URLSearchParams({ limit: '24' });
        if (activeBrd) params.set('brdDiv', activeBrd);
        const res = await axios.get(`/api/v1/tour/trekking/courses?${params.toString()}`);
        const data = res?.data?.data ?? [];
        if (!alive) return;
        setCourses(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[trekking-courses] fetch failed:', e?.message || e);
        if (alive) setCoursesError('코스 목록을 불러올 수 없어요');
      } finally {
        if (alive) setCoursesLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [activeBrd]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(1000px 600px at 85% -10%, rgba(14,165,233,0.18) 0%, transparent 60%),' +
          'radial-gradient(900px 520px at 10% 110%, rgba(251,191,36,0.16) 0%, transparent 60%),' +
          'linear-gradient(180deg, #04131a 0%, #07212a 55%, #04141a 100%)',
        color: '#ecfeff',
        paddingBottom: 80,
      }}
    >
      <style>{`
        @keyframes trek-sun-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes trek-leaf-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(-8px) rotate(10deg); }
        }
        @keyframes trek-draw {
          from { stroke-dashoffset: 900; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes trek-pulse {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
      `}</style>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '32px 20px 0' }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'rgba(236,254,255,0.75)', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, padding: '6px 12px',
            border: '1px solid rgba(110,231,183,0.22)', borderRadius: 999,
            background: 'rgba(6,95,70,0.18)',
          }}
        >
          <ArrowLeft size={14} />
          대시보드로 돌아가기
        </Link>
      </div>

      {/* Hero */}
      <section
        style={{
          position: 'relative', maxWidth: 1160, margin: '24px auto 0',
          padding: '40px 24px 56px', borderRadius: 28, overflow: 'hidden',
          background:
            'radial-gradient(120% 150% at 50% 120%, rgba(253,224,71,0.12) 0%, transparent 55%),' +
            'linear-gradient(160deg, rgba(14,165,233,0.18) 0%, rgba(20,184,166,0.12) 60%, rgba(16,185,129,0.06) 100%)',
          border: '1px solid rgba(110,231,183,0.16)',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 20, right: 28, width: 84, height: 84,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 35%, rgba(253,224,71,0.55), rgba(251,191,36,0.12) 55%, transparent 75%)',
            filter: 'blur(3px)', animation: 'trek-sun-spin 28s linear infinite',
          }}
        >
          <Sun size={64} color="#fde68a" style={{ position: 'absolute', inset: 10 }} />
        </div>

        <svg
          aria-hidden viewBox="0 0 1200 240" preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 200, opacity: 0.45 }}
        >
          <defs>
            <linearGradient id="trek-hero-mt" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <path d="M0,240 L0,170 L120,100 L230,150 L360,60 L480,130 L620,50 L780,140 L920,90 L1080,150 L1200,110 L1200,240 Z" fill="url(#trek-hero-mt)" />
          <path d="M0,240 L0,200 L180,170 L320,195 L470,160 L640,190 L820,165 L1010,185 L1200,170 L1200,240 Z" fill="url(#trek-hero-mt)" opacity="0.6" />
        </svg>

        <svg
          aria-hidden viewBox="0 0 1200 200" preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: 62, width: '100%', height: 120, pointerEvents: 'none' }}
        >
          <path
            d="M20,120 C200,40 380,170 560,90 S860,30 1000,110 S1180,80 1195,70"
            fill="none" stroke="#fde68a" strokeWidth="3" strokeDasharray="4 10" strokeLinecap="round"
            opacity="0.8"
            style={{ strokeDashoffset: 900, animation: 'trek-draw 3.2s ease-in-out 0.2s forwards' }}
          />
        </svg>

        <Leaf aria-hidden size={22} color="#6ee7b7"
          style={{ position: 'absolute', top: 28, left: '18%', opacity: 0.7, animation: 'trek-leaf-float 4.8s ease-in-out infinite' }} />
        <Leaf aria-hidden size={18} color="#14b8a6"
          style={{ position: 'absolute', top: 80, left: '60%', opacity: 0.55, animation: 'trek-leaf-float 5.6s ease-in-out 0.4s infinite' }} />

        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}
        >
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(110,231,183,0.14)', border: '1px solid rgba(110,231,183,0.32)',
              color: '#a7f3d0', fontSize: 11, fontWeight: 800,
              letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14,
            }}
          >
            <Footprints size={13} />
            Durunubi · Korea Trails
          </div>

          <h1
            style={{
              fontSize: 42, fontWeight: 900, lineHeight: 1.12, margin: '0 0 14px',
              background: 'linear-gradient(90deg, #6ee7b7 0%, #fde68a 45%, #7dd3fc 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', color: 'transparent', letterSpacing: '-0.01em',
            }}
          >
            코스로 떠나는 걷기여행
          </h1>

          <p style={{ fontSize: 16, lineHeight: 1.65, color: 'rgba(220,252,231,0.82)', margin: 0, maxWidth: 620 }}>
            한국관광공사 <strong style={{ color: '#fde68a' }}>두루누비</strong> 에서 제공하는
            <strong style={{ color: '#a7f3d0' }}> 코리아둘레길 284개 코스 </strong>
            의 GPX·지역·주변 관광정보를 따라, 영화 속 장소와 반려동물 동반 여행에
            <strong style={{ color: '#7dd3fc' }}> 산뜻한 걷기 코스 </strong>까지 한 번에 이어집니다.
          </p>
        </motion.div>
      </section>

      {/* Routes (길) */}
      <section style={{ maxWidth: 1160, margin: '32px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Mountain size={18} color="#6ee7b7" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>코리아둘레길 · 주요 노선</h2>
          <span style={{ fontSize: 12, color: 'rgba(220,252,231,0.55)', marginLeft: 6 }}>
            두루누비 routeList
          </span>
        </div>
        {routesLoading ? (
          <GridSkeleton count={4} height={128} />
        ) : routesError ? (
          <EmptyCard msg={routesError} />
        ) : routes.length === 0 ? (
          <EmptyCard msg="등록된 길 정보가 없어요" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {routes.slice(0, 8).map((r) => {
              const acc = accentFor(r.brdDiv);
              return (
                <div
                  key={r.routeIdx || r.displayName}
                  style={{
                    position: 'relative', borderRadius: 18, padding: 18,
                    background: 'linear-gradient(160deg, #0b1e20 0%, #0f2a2f 55%, #0a1b1f 100%)',
                    border: '1px solid rgba(110,231,183,0.14)', overflow: 'hidden',
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute', top: -40, right: -40,
                      width: 140, height: 140, borderRadius: '50%',
                      background: acc.bg, opacity: 0.18, filter: 'blur(6px)',
                    }}
                  />
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 999,
                      background: acc.chipBg, color: acc.chip,
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                    }}
                  >
                    <Waves size={12} />
                    {r.themeNm || r.brdDiv || 'ROUTE'}
                  </span>
                  <h3 style={{ margin: '10px 0 6px', fontSize: 19, fontWeight: 900, color: '#ecfeff' }}>
                    {r.displayName || r.lnm || r.brdNm}
                  </h3>
                  {(r.cpnBgng || r.cpnEnd) && (
                    <div style={{ fontSize: 12.5, color: 'rgba(220,252,231,0.62)', marginBottom: 6 }}>
                      {r.cpnBgng}{r.cpnEnd ? ` → ${r.cpnEnd}` : ''}
                    </div>
                  )}
                  {r.lnkgCourse && (
                    <p style={{
                      margin: 0, fontSize: 13, color: 'rgba(220,252,231,0.78)', lineHeight: 1.55,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {r.lnkgCourse}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Filter chips */}
      <section style={{ maxWidth: 1160, margin: '36px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Route size={18} color="#7dd3fc" />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>두루누비 코스 둘러보기</h2>
          <span style={{ fontSize: 12, color: 'rgba(220,252,231,0.55)', marginLeft: 6 }}>
            두루누비 courseList
          </span>
        </div>

        <div
          role="tablist"
          aria-label="둘레길 구분 선택"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
        >
          <ChipButton
            active={activeBrd === null}
            onClick={() => setActiveBrd(null)}
            label="전체"
            color="#a7f3d0"
          />
          {brdFilters.map((code) => {
            const acc = accentFor(code);
            return (
              <ChipButton
                key={code}
                active={activeBrd === code}
                onClick={() => setActiveBrd(code)}
                label={brdLabel[code] || code}
                color={acc.chip}
              />
            );
          })}
        </div>

        {coursesLoading ? (
          <GridSkeleton count={6} height={200} />
        ) : coursesError ? (
          <EmptyCard msg={coursesError} />
        ) : courses.length === 0 ? (
          <EmptyCard msg="선택하신 조건의 코스가 아직 없어요" />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: 14,
            }}
          >
            {courses.map((c) => (
              <CourseCard key={c.crsIdx || `${c.crsKorNm}-${c.routeIdx}`} course={c} />
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 22, padding: '14px 16px', borderRadius: 14,
            background: 'rgba(253,224,71,0.06)', border: '1px dashed rgba(253,224,71,0.4)',
            color: 'rgba(253,224,71,0.9)', fontSize: 13, lineHeight: 1.6,
          }}
        >
          데이터 소스: 공공데이터포털 &gt; 한국관광공사_두루누비 정보 서비스_GW
          (TourAPI Guide v4.1, base: <code style={{ color: '#fde68a' }}>apis.data.go.kr/B551011/Durunubi</code>) ·
          단일 VISITKOREA_SERVICE_KEY 를 다른 KTO 서비스와 공유하여 서버 측 6시간 TTL 캐시 적용.
        </div>
      </section>
    </div>
  );
}

function ChipButton({ active, onClick, label, color }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.2s ease',
        background: active ? `${color}22` : 'rgba(255,255,255,0.03)',
        border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
        color: active ? color : 'rgba(220,252,231,0.7)',
        boxShadow: active ? `0 2px 10px ${color}33` : 'none',
      }}
    >
      {label}
    </button>
  );
}

function CourseCard({ course }) {
  const acc = accentFor(course.brdDiv);
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{
        position: 'relative', borderRadius: 20, padding: 18, overflow: 'hidden',
        background: 'linear-gradient(160deg, #0b1e20 0%, #0f2a2f 55%, #0a1b1f 100%)',
        border: '1px solid rgba(110,231,183,0.14)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', top: -50, right: -50, width: 160, height: 160,
          borderRadius: '50%', background: acc.bg, opacity: 0.18, filter: 'blur(8px)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        {course.brdDiv && (
          <span
            style={{
              padding: '3px 9px', borderRadius: 999, background: acc.chipBg, color: acc.chip,
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            }}
          >
            {course.brdNm || course.brdDiv}
          </span>
        )}
        {course.sigun && (
          <span style={{ fontSize: 11.5, color: 'rgba(220,252,231,0.55)' }}>
            <MapPin size={11} style={{ verticalAlign: -1, marginRight: 3 }} />
            {course.sigun}
          </span>
        )}
      </div>

      <h3 style={{ margin: '0 0 10px', fontSize: 17.5, fontWeight: 900, color: '#ecfeff', lineHeight: 1.3 }}>
        {course.crsKorNm || '코스 정보'}
      </h3>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {course.distanceKm != null && (
          <StatPill Icon={Route} text={`${course.distanceKm} km`} color="#7dd3fc" />
        )}
        {course.estimatedTimeLabel && (
          <StatPill Icon={Clock} text={course.estimatedTimeLabel} color="#fde68a" />
        )}
        {course.levelLabel && course.crsLevel && (
          <StatPill Icon={Gauge} text={course.levelLabel} color="#6ee7b7" />
        )}
      </div>

      {(course.cpnBgng || course.cpnEnd) && (
        <div style={{ fontSize: 12.5, color: 'rgba(220,252,231,0.62)', marginBottom: 8 }}>
          {course.cpnBgng} {course.cpnEnd ? `→ ${course.cpnEnd}` : ''}
        </div>
      )}

      {course.crsContents && (
        <>
          <p
            style={{
              margin: 0, fontSize: 13, color: 'rgba(220,252,231,0.78)', lineHeight: 1.55,
              display: open ? 'block' : '-webkit-box',
              WebkitLineClamp: open ? 'none' : 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {stripHtml(course.crsContents)}
          </p>
          {stripHtml(course.crsContents).length > 120 && (
            <button
              onClick={() => setOpen((v) => !v)}
              style={{
                marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                color: acc.chip, fontSize: 12, fontWeight: 700,
              }}
            >
              {open ? '접기' : '더보기'}
            </button>
          )}
        </>
      )}

      {course.gpxpath && (
        <a
          href={`/api/v1/tour/trekking/gpx?url=${encodeURIComponent(course.gpxpath)}&name=${encodeURIComponent(course.crsKorNm || course.crsIdx || 'durunubi-course')}`}
          rel="noopener noreferrer"
          download
          style={{
            marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: acc.chipBg, color: acc.chip, textDecoration: 'none',
            border: `1px solid ${acc.chip}55`,
          }}
        >
          <Download size={12} />
          GPX 다운로드
        </a>
      )}
    </motion.div>
  );
}

function StatPill({ Icon, text, color }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 999,
        background: `${color}14`, color, fontSize: 12, fontWeight: 700,
        border: `1px solid ${color}33`,
      }}
    >
      <Icon size={12} />
      {text}
    </span>
  );
}

function GridSkeleton({ count = 4, height = 128 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            height, borderRadius: 18,
            background: 'rgba(110,231,183,0.05)',
            border: '1px solid rgba(110,231,183,0.08)',
            animation: 'trek-pulse 1.6s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

function EmptyCard({ msg }) {
  return (
    <div
      style={{
        padding: '28px 20px', borderRadius: 16, textAlign: 'center',
        background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(110,231,183,0.2)',
        color: 'rgba(220,252,231,0.6)', fontSize: 13, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      <Compass size={14} />
      {msg}
    </div>
  );
}

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
