'use client';

import React, { useMemo } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { deriveTravelWeatherPresentation, useTravelWeatherShortReg, buildTravelWeatherTimeline, formatTimelineAria } from '@/lib/travelWeatherShared';

const SHELL = {
  padding: '10px 18px 12px',
  borderBottom: '1px solid rgba(15, 23, 42, 0.055)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.82) 0%, rgba(248, 250, 252, 0.92) 55%, rgba(241, 245, 249, 0.55) 100%)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  fontFamily: 'var(--font-app)',
};

const PILL_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 11,
  fontWeight: 650,
  letterSpacing: '0.02em',
  lineHeight: 1.35,
  border: '1px solid rgba(15, 23, 42, 0.06)',
  background: 'rgba(255, 255, 255, 0.55)',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

export default function TravelWeatherStrip() {
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

  const timeline = useMemo(() => {
    if (state.phase !== 'ready' || !state.data) return { slots: [], source: null };
    const d = state.data;
    if (d.configured === false) return { slots: [], source: null };
    const hasVsrt = Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0;
    const hasSeries = Array.isArray(d.series) && d.series.length > 0;
    if (d.upstreamError && !hasVsrt) return { slots: [], source: null };
    if (!hasSeries && !hasVsrt) return { slots: [], source: null };
    return buildTravelWeatherTimeline(d.series || [], { maxSlots: 8, vsrtHourly: d.vsrtHourly });
  }, [state.phase, state.data]);

  if (state.phase === 'loading') {
    return (
      <section className="travel-weather-strip" style={SHELL} aria-busy="true" aria-label={t('travelWeather.ariaLoading', '날씨 확인 중')}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3px 0' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(150deg, rgba(248, 250, 252, 0.92) 0%, rgba(226, 232, 240, 0.35) 100%)',
              boxShadow: '0 0 0 1px rgba(100, 116, 139, 0.1), inset 0 1px 0 rgba(255,255,255,0.55)',
            }}
          >
            <Loader2 size={24} strokeWidth={1.65} className="animate-spin" style={{ color: '#64748b', opacity: 0.9 }} aria-hidden />
          </div>
        </div>
      </section>
    );
  }

  if (state.phase === 'error') {
    return (
      <section
        className="travel-weather-strip"
        style={SHELL}
        aria-label={t('travelWeather.ariaError', '날씨를 불러오지 못했습니다.')}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3px 0' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(150deg, rgba(248, 250, 252, 0.92) 0%, rgba(241, 245, 249, 0.5) 100%)',
              boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.18), inset 0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            <CloudOff size={26} strokeWidth={1.45} style={{ color: '#94a3b8' }} aria-hidden />
          </div>
        </div>
      </section>
    );
  }

  const d = state.data;
  if (!d || !presentation) return null;

  const { Icon, iconProps, chipDay, chipHours, ariaLabel, kind } = presentation;
  const timelineAria = formatTimelineAria(timeline.slots, t);
  const sectionAria = [ariaLabel, timelineAria].filter(Boolean).join('. ');
  const iconSize = kind === 'rain' || kind === 'vague' || kind === 'maybe' ? 28 : 26;
  const halo =
    kind === 'rain' || kind === 'vague' || kind === 'maybe'
      ? '0 0 0 1px rgba(7, 89, 133, 0.12), 0 8px 28px rgba(3, 105, 161, 0.12), inset 0 1px 0 rgba(255,255,255,0.65)'
      : kind === 'dry'
        ? '0 0 0 1px rgba(180, 83, 9, 0.1), 0 8px 24px rgba(202, 138, 4, 0.11), inset 0 1px 0 rgba(255,255,255,0.7)'
        : '0 0 0 1px rgba(100, 116, 139, 0.12), 0 6px 18px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.55)';
  const cellBg =
    kind === 'rain' || kind === 'vague' || kind === 'maybe'
      ? 'linear-gradient(150deg, rgba(224, 242, 254, 0.92) 0%, rgba(186, 230, 253, 0.45) 55%, rgba(255,255,255,0.35) 100%)'
      : kind === 'dry'
        ? 'linear-gradient(150deg, rgba(254, 252, 232, 0.95) 0%, rgba(254, 240, 138, 0.35) 50%, rgba(255,255,255,0.4) 100%)'
        : 'linear-gradient(150deg, rgba(248, 250, 252, 0.95) 0%, rgba(226, 232, 240, 0.4) 100%)';

  return (
    <section className="travel-weather-strip" style={SHELL} aria-label={sectionAria}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: chipDay || chipHours ? 12 : 0,
          maxWidth: 520,
          margin: '0 auto',
          padding: '1px 0',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: cellBg,
            boxShadow: halo,
            flexShrink: 0,
          }}
        >
          <Icon size={iconSize} aria-hidden {...iconProps} />
        </div>
        {(chipDay || chipHours) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minWidth: 0, justifyContent: 'center' }}>
            {chipDay ? (
              <span style={{ ...PILL_BASE, color: '#475569' }}>{chipDay}</span>
            ) : null}
            {chipHours ? (
              <span
                style={{
                  ...PILL_BASE,
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  color: '#0f172a',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  background: 'rgba(255, 255, 255, 0.72)',
                }}
              >
                {chipHours}
              </span>
            ) : null}
          </div>
        )}
      </div>
      {timeline.slots.length > 0 ? (
        <div style={{ maxWidth: 520, margin: '10px auto 0', padding: '0 4px' }}>
          <div
            className="travel-weather-timeline-scroll"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
            }}
          >
            {timeline.slots.map((s) => {
              const SlotIcon = s.Icon;
              return (
              <div
                key={`${s.date}-${s.time}`}
                style={{
                  flex: '0 0 auto',
                  width: 56,
                  borderRadius: 12,
                  padding: '6px 4px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(15, 23, 42, 0.06)',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: '#475569',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.hour}
                  {t('travelWeather.hourSuffix', '시')}
                </span>
                <SlotIcon size={20} aria-hidden {...s.iconProps} />
                {s.tmp != null ? (
                  <span style={{ fontSize: 11, fontWeight: 650, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                    {s.tmp}
                    {t('travelWeather.degreeSymbol', '°')}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>
                )}
              </div>
            );
            })}
          </div>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: 10,
              lineHeight: 1.35,
              color: '#64748b',
              textAlign: 'center',
              letterSpacing: '0.01em',
            }}
          >
            {t(
              timeline.source === 'vsrt' ? 'travelWeather.forecastHourlyVsrtHint' : 'travelWeather.forecastStepHint',
              timeline.source === 'vsrt'
                ? '동네예보 초단기 격자 예보(약 1시간 간격). 시각은 발표·격자점 기준입니다.'
                : '시각은 기상청 발표 시각입니다. 단기구역(reg) 예보는 보통 3시간 간격입니다.'
            )}
          </p>
        </div>
      ) : null}
    </section>
  );
}
