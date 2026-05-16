'use client';

/**
 * /trekking/walk — 두루누비 GPX + 기기 GPS 로 인앱 걷기 기록 (웹·Capacitor iOS/Android)
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { ArrowLeft, MapPin, Pause, Play, LocateFixed } from 'lucide-react';
import { fetchDurunubiGpxXml } from '@/lib/fetchDurunubiGpx';
import { parseGpxTrackPoints } from '@/lib/gpxParser';
import { formatDistanceMeters, formatDurationMs, haversineMeters, pathLengthMeters } from '@/lib/trekkingGeo';

const TrekkingWalkMap = dynamic(() => import('@/components/TrekkingWalkMap'), { ssr: false });

const RETURN_KEY = 'trekking-return';

function TrekkingWalkInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const gpxUrl = searchParams.get('url') || '';
  const title = searchParams.get('title') || '';
  const fromParam = searchParams.get('from') || '';

  const [returnPath, setReturnPath] = useState('/trekking');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [courseTrack, setCourseTrack] = useState([]);

  const [tracking, setTracking] = useState(false);
  const [userTrack, setUserTrack] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const watchIdRef = useRef(null);

  useEffect(() => {
    const saved =
      fromParam && fromParam.startsWith('/trekking')
        ? fromParam
        : typeof window !== 'undefined'
          ? sessionStorage.getItem(RETURN_KEY)
          : null;
    if (saved?.startsWith('/')) setReturnPath(saved);
  }, [fromParam]);

  useEffect(() => {
    if (!gpxUrl) {
      setLoadError(t('trekking.walk.noGpx', 'GPX 경로가 없어요.'));
      setLoading(false);
      return undefined;
    }
    let alive = true;
    const ac = new AbortController();
    fetchDurunubiGpxXml(gpxUrl, { name: title || 'durunubi-course', signal: ac.signal })
      .then((xml) => {
        if (!alive) return;
        const pts = parseGpxTrackPoints(xml);
        if (!pts.length) {
          setLoadError(t('trekking.walk.gpxEmpty', '코스 좌표가 비어 있어요.'));
          return;
        }
        setCourseTrack(pts);
      })
      .catch(() => {
        if (!alive) return;
        setLoadError(t('trekking.walk.gpxInvalid', 'GPX를 불러오지 못했어요.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      ac.abort();
    };
  }, [gpxUrl, title, t]);

  useEffect(() => {
    if (!tracking || !startedAt) return undefined;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(id);
  }, [tracking, startedAt]);

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError(t('trekking.walk.geoUnsupported', '이 기기에서는 위치(GPS)를 사용할 수 없어요.'));
      return;
    }
    setGeoError('');
    setUserTrack([]);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setTracking(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const point = { lat, lng, at: Date.now() };
        setUserPosition(point);
        setUserTrack((prev) => {
          if (prev.length === 0) return [point];
          const last = prev[prev.length - 1];
          if (haversineMeters(last, point) < 3) return prev;
          return [...prev, point];
        });
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? t('trekking.walk.geoDenied', '위치 권한을 허용해 주세요. (iOS·Android 설정)')
            : t('trekking.walk.geoFailed', 'GPS 신호를 받지 못했어요.'),
        );
        setTracking(false);
        stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, [stopWatch, t]);

  const pauseTracking = useCallback(() => {
    setTracking(false);
    stopWatch();
  }, [stopWatch]);

  const goBack = useCallback(() => {
    pauseTracking();
    router.push(returnPath);
  }, [pauseTracking, router, returnPath]);

  const courseKm = useMemo(() => pathLengthMeters(courseTrack), [courseTrack]);
  const walkedM = useMemo(() => pathLengthMeters(userTrack), [userTrack]);

  return (
    <div className="twk-root">
      <style>{cssBlock}</style>
      <header className="twk-bar">
        <button type="button" className="twk-back" onClick={goBack}>
          <ArrowLeft size={18} aria-hidden />
          {t('trekking.walk.backList', '걷기 코스 목록')}
        </button>
        <span className="twk-title">{title || t('trekking.walk.title', '걷기 기록')}</span>
      </header>

      <div className="twk-map-wrap">
        {loading ? (
          <p className="twk-status">{t('trekking.walk.loading', '코스 GPX 불러오는 중…')}</p>
        ) : loadError ? (
          <p className="twk-status twk-error">{loadError}</p>
        ) : (
          <TrekkingWalkMap
            courseTrack={courseTrack}
            userTrack={userTrack}
            userPosition={userPosition}
          />
        )}
      </div>

      <section className="twk-panel">
        <div className="twk-stats">
          <div className="twk-stat">
            <span className="twk-stat-label">{t('trekking.walk.courseDist', '코스 길이')}</span>
            <strong>{formatDistanceMeters(courseKm)}</strong>
          </div>
          <div className="twk-stat">
            <span className="twk-stat-label">{t('trekking.walk.walkedDist', '내가 걸은 거리')}</span>
            <strong>{formatDistanceMeters(walkedM)}</strong>
          </div>
          <div className="twk-stat">
            <span className="twk-stat-label">{t('trekking.walk.elapsed', '시간')}</span>
            <strong>{formatDurationMs(elapsedMs)}</strong>
          </div>
        </div>

        {geoError && <p className="twk-error">{geoError}</p>}

        <div className="twk-actions">
          {!tracking ? (
            <button
              type="button"
              className="twk-btn twk-btn-primary"
              onClick={startTracking}
              disabled={!!loadError || loading}
            >
              <Play size={16} aria-hidden />
              {t('trekking.walk.start', '걷기 시작')}
            </button>
          ) : (
            <button type="button" className="twk-btn twk-btn-secondary" onClick={pauseTracking}>
              <Pause size={16} aria-hidden />
              {t('trekking.walk.pause', '일시 정지')}
            </button>
          )}
        </div>

        <p className="twk-hint">
          <LocateFixed size={13} aria-hidden />
          {t(
            'trekking.walk.hint',
            '파란 선은 두루누비 공식 코스(GPX), 초록 선은 내 GPS 기록입니다. iOS·Android 앱(Capacitor)에서도 동일하게 동작합니다.',
          )}
        </p>
        <p className="twk-hint twk-hint-sub">
          <MapPin size={12} aria-hidden />
          {t(
            'trekking.walk.apiNote',
            '데이터: 한국관광공사 두루누비 정보 서비스_GW (courseList · GPX). 스마트워치·외부 앱에도 GPX를 내려받아 사용할 수 있어요.',
          )}
        </p>
      </section>
    </div>
  );
}

export default function TrekkingWalkPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#aaa' }}>Loading…</div>}>
      <TrekkingWalkInner />
    </Suspense>
  );
}

const cssBlock = `
.twk-root {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #0a0f14;
  color: #ecfdf5;
}
.twk-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  padding-top: max(10px, env(safe-area-inset-top));
  background: rgba(10, 15, 20, 0.95);
  border-bottom: 1px solid rgba(110, 231, 183, 0.2);
  position: sticky;
  top: 0;
  z-index: 20;
}
.twk-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(110, 231, 183, 0.4);
  background: rgba(6, 78, 59, 0.35);
  color: #a7f3d0;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 8px 12px;
  border-radius: 999px;
  cursor: pointer;
}
.twk-title {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.twk-map-wrap {
  flex: 1;
  min-height: 42vh;
  position: relative;
  background: #111827;
}
.twk-status {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
}
.twk-panel {
  padding: 14px 16px 20px;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
  background: #0a0f14;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.twk-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.twk-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(110, 231, 183, 0.15);
}
.twk-stat-label {
  font-size: 0.68rem;
  color: #9ca3af;
  font-weight: 600;
}
.twk-stat strong {
  font-size: 1rem;
  color: #6ee7b7;
}
.twk-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.twk-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 0.92rem;
  font-weight: 800;
  border: none;
  cursor: pointer;
}
.twk-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.twk-btn-primary {
  color: #042f2e;
  background: linear-gradient(135deg, #6ee7b7, #38bdf8);
}
.twk-btn-secondary {
  color: #ecfdf5;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.twk-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: #6b7280;
}
.twk-hint-sub {
  margin-top: 6px;
}
.twk-error {
  color: #fca5a5;
  font-size: 0.82rem;
  margin: 0 0 10px;
}
`;
