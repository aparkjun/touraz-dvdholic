'use client';

import React, { useMemo } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  deriveTravelWeatherPresentation,
  useTravelWeatherShortReg,
  buildTravelWeatherTimeline,
  formatTimelineAria,
} from '@/lib/travelWeatherShared';

/** 대시보드 네비(라이트 글래스)용 — 예보 요약은 aria-label 만 */
export default function DashboardWeatherNavGlyph() {
  const { t } = useTranslation();
  const state = useTravelWeatherShortReg();

  const presentation = useMemo(() => {
    if (state.phase !== 'ready' || !state.data) return null;
    const d = state.data;
    if (d.configured === false) {
      return {
        kind: 'idle',
        Icon: Cloud,
        iconProps: { strokeWidth: 1.5, color: '#94a3b8' },
        ariaLabel: t('travelWeather.ariaPreparing', '날씨 안내를 준비 중입니다.'),
      };
    }
    if (d.upstreamError && !(Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0)) {
      return {
        kind: 'idle',
        Icon: Cloud,
        iconProps: { strokeWidth: 1.5, color: '#94a3b8' },
        ariaLabel: t('travelWeather.ariaPreparing', '날씨 안내를 준비 중입니다.'),
      };
    }
    const seriesForDerive = d.series?.length ? d.series : d.vsrtHourly || [];
    return deriveTravelWeatherPresentation(seriesForDerive, d.payload, t);
  }, [state.phase, state.data, t]);

  const timelineAria = useMemo(() => {
    if (state.phase !== 'ready' || !state.data) return '';
    const d = state.data;
    if (d.configured === false) return '';
    const hasVsrt = Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0;
    const hasSeries = Array.isArray(d.series) && d.series.length > 0;
    if (d.upstreamError && !hasVsrt) return '';
    if (!hasSeries && !hasVsrt) return '';
    const { slots } = buildTravelWeatherTimeline(d.series || [], { maxSlots: 5, vsrtHourly: d.vsrtHourly });
    return formatTimelineAria(slots);
  }, [state.phase, state.data]);

  const wrapStyle = {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'linear-gradient(145deg, rgba(255,255,255,0.82), rgba(248,250,252,0.55))',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
  };

  if (state.phase === 'loading') {
    return (
      <div
        className="app-nav-dashboard-weather"
        style={wrapStyle}
        aria-busy="true"
        aria-label={t('travelWeather.ariaLoading', '날씨 확인 중')}
      >
        <Loader2 size={20} strokeWidth={1.75} className="animate-spin" style={{ color: '#94a3b8' }} aria-hidden />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div
        className="app-nav-dashboard-weather"
        style={wrapStyle}
        aria-label={t('travelWeather.ariaError', '날씨를 불러오지 못했습니다.')}
      >
        <CloudOff size={20} strokeWidth={1.45} style={{ color: '#94a3b8' }} aria-hidden />
      </div>
    );
  }

  if (!presentation) return null;

  const { Icon, iconProps, ariaLabel, kind } = presentation;
  const size = kind === 'rain' || kind === 'vague' || kind === 'maybe' ? 22 : 20;
  const glyphAria = [ariaLabel, timelineAria].filter(Boolean).join('. ');

  return (
    <div className="app-nav-dashboard-weather" style={wrapStyle} role="img" aria-label={glyphAria}>
      <Icon size={size} aria-hidden {...iconProps} />
    </div>
  );
}
