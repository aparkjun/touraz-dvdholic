'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';
import {
  deriveTravelWeatherPresentation,
  useTravelWeatherShortReg,
  buildTravelWeatherTimeline,
  formatTimelineAria,
  buildDashboardNavCaption,
  buildDashboardRegionLine,
  skyStateLabel,
  resolveSeriesForWeatherTimeline,
} from '@/lib/travelWeatherShared';
import { WEATHER_REGION_PRESETS, weatherPresetLabel } from '@/lib/weatherRegionPresets';

const MINE_TAB = 'mine';

function ForecastSection({ title, hint, slots, t }) {
  if (!slots?.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{title}</span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 6,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
        }}
      >
        {slots.map((s) => {
          const SlotIcon = s.Icon;
          const stateShort = skyStateLabel(s.sky, s.pty, s.wet, t);
          return (
            <div
              key={`${s.date}-${s.time}`}
              title={stateShort}
              style={{
                flex: '0 0 auto',
                width: 64,
                borderRadius: 12,
                padding: '8px 5px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(15, 23, 42, 0.07)',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#475569' }}>
                {s.hour}
                {t('travelWeather.hourSuffix', '시')}
              </span>
              <SlotIcon size={22} aria-hidden {...s.iconProps} />
              {s.tmp != null ? (
                <span style={{ fontSize: 12, fontWeight: 750, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                  {s.tmp}
                  {t('travelWeather.degreeSymbol', '°')}
                </span>
              ) : (
                <span style={{ fontSize: 10, color: '#94a3b8' }}>—</span>
              )}
              {s.pop != null ? (
                <span style={{ fontSize: 9, fontWeight: 650, color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}>
                  {t('travelWeather.panelPopShort', 'POP {{n}}%', { n: s.pop })}
                </span>
              ) : (
                <span style={{ fontSize: 8, fontWeight: 600, color: '#94a3b8', textAlign: 'center', lineHeight: 1.2, maxWidth: '100%' }}>
                  {stateShort}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {hint ? (
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.4, color: '#64748b' }}>{hint}</p>
      ) : null}
    </div>
  );
}

function timelinesFromApiData(d) {
  if (!d || d.configured === false) {
    return { vsrtSlots: [], shortSlots: [], hasVsrt: false, hasShort: false };
  }
  const hasVsrt = Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0;
  const series = resolveSeriesForWeatherTimeline(d);
  const hasSeries = series.length > 0;
  if (d.upstreamError && !hasVsrt && !hasSeries) {
    return { vsrtSlots: [], shortSlots: [], hasVsrt: false, hasShort: false };
  }
  if (!hasSeries && !hasVsrt) {
    return { vsrtSlots: [], shortSlots: [], hasVsrt: false, hasShort: false };
  }
  const vsrtT = buildTravelWeatherTimeline(series, { maxSlots: 14, vsrtHourly: d.vsrtHourly, skipVsrt: false });
  const shortT = buildTravelWeatherTimeline(series, { maxSlots: 14, skipVsrt: true });
  return {
    vsrtSlots: vsrtT.slots || [],
    shortSlots: shortT.slots || [],
    hasVsrt: (vsrtT.slots || []).length > 0,
    hasShort: (shortT.slots || []).length > 0,
  };
}

/** 지역 탭: reg+좌표 우선, 실패 시 reg 단독 */
async function fetchShortRegForPreset(preset) {
  const paramSets = [
    { reg: preset.reg, lat: preset.lat, lng: preset.lng },
    { reg: preset.reg },
  ];
  for (const params of paramSets) {
    try {
      const res = await axios.get('/api/v1/weather/short-reg', { params });
      const body = res?.data;
      if (body?.success === false) continue;
      const d = body?.data;
      if (d && typeof d === 'object') return d;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 대시보드 네비 — 위젯 클릭 시 지역별 탭 · 시간대 예보(초단기+단기) */
export default function DashboardWeatherNavGlyph() {
  const { t, i18n } = useTranslation();
  const state = useTravelWeatherShortReg();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeRegionId, setActiveRegionId] = useState(MINE_TAB);
  const [regionCache, setRegionCache] = useState({});
  const [regionErr, setRegionErr] = useState({});
  const [fetchingReg, setFetchingReg] = useState(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 12, width: 320 });
  const wrapRef = useRef(null);
  const anchorRef = useRef(null);
  const panelId = 'app-dashboard-weather-panel';

  const presetTabs = useMemo(() => {
    const my = state.phase === 'ready' && state.data?.reg ? String(state.data.reg) : null;
    if (!my) return WEATHER_REGION_PRESETS;
    return WEATHER_REGION_PRESETS.filter((p) => p.reg !== my);
  }, [state.phase, state.data?.reg]);

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
    if (
      d.upstreamError &&
      !(Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0) &&
      resolveSeriesForWeatherTimeline(d).length === 0
    ) {
      return {
        kind: 'idle',
        Icon: Cloud,
        iconProps: { strokeWidth: 1.5, color: '#94a3b8' },
        ariaLabel: t('travelWeather.ariaPreparing', '날씨 안내를 준비 중입니다.'),
      };
    }
    const seriesForDerive = d.series?.length
      ? d.series
      : d.vsrtHourly?.length
        ? d.vsrtHourly
        : resolveSeriesForWeatherTimeline(d);
    return deriveTravelWeatherPresentation(seriesForDerive, d.payload, t);
  }, [state.phase, state.data, t]);

  const timeline = useMemo(() => {
    if (state.phase !== 'ready' || !state.data) return { slots: [], source: undefined };
    const d = state.data;
    if (d.configured === false) return { slots: [], source: undefined };
    const hasVsrt = Array.isArray(d.vsrtHourly) && d.vsrtHourly.length > 0;
    const series = resolveSeriesForWeatherTimeline(d);
    const hasSeries = series.length > 0;
    if (d.upstreamError && !hasVsrt && !hasSeries) return { slots: [], source: undefined };
    if (!hasSeries && !hasVsrt) return { slots: [], source: undefined };
    return buildTravelWeatherTimeline(series, { maxSlots: 8, vsrtHourly: d.vsrtHourly });
  }, [state.phase, state.data]);

  const timelineAria = useMemo(() => formatTimelineAria(timeline.slots || [], t), [timeline.slots, t]);

  const caption = useMemo(
    () => buildDashboardNavCaption(presentation, timeline, t, state.phase === 'ready' ? state.data : null),
    [presentation, timeline, t, state.phase, state.data]
  );

  const activePanelData = activeRegionId === MINE_TAB ? (state.phase === 'ready' ? state.data : null) : regionCache[activeRegionId];

  const activeTimelines = useMemo(() => timelinesFromApiData(activePanelData), [activePanelData]);

  const activeRegionHint = useMemo(() => {
    if (!activePanelData) return { regionLine: '', regionHint: '' };
    return buildDashboardRegionLine(activePanelData, t);
  }, [activePanelData, t]);

  const gridNote =
    activePanelData?.vsrtGrid && activePanelData.vsrtGrid.nx != null && activePanelData.vsrtGrid.ny != null
      ? t('travelWeather.panelVsrtGrid', '초단기 격자 nx={{nx}} ny={{ny}}', {
          nx: activePanelData.vsrtGrid.nx,
          ny: activePanelData.vsrtGrid.ny,
        })
      : '';

  useEffect(() => {
    if (!panelOpen) {
      setActiveRegionId(MINE_TAB);
      return;
    }
    setRegionErr({});
  }, [panelOpen]);

  const regionCacheRef = useRef({});
  useEffect(() => {
    regionCacheRef.current = regionCache;
  }, [regionCache]);

  useEffect(() => {
    if (!panelOpen || activeRegionId === MINE_TAB) return;
    if (regionCacheRef.current[activeRegionId]) return;

    const preset = WEATHER_REGION_PRESETS.find((p) => p.reg === activeRegionId);
    if (!preset) return;

    let cancelled = false;
    setFetchingReg(activeRegionId);

    fetchShortRegForPreset(preset)
      .then((d) => {
        if (cancelled) return;
        if (d) setRegionCache((c) => ({ ...c, [activeRegionId]: d }));
        else setRegionErr((e) => ({ ...e, [activeRegionId]: true }));
      })
      .finally(() => {
        if (!cancelled) {
          setFetchingReg((f) => (f === activeRegionId ? null : f));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [panelOpen, activeRegionId]);

  const updatePanelPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(360, Math.max(280, window.innerWidth - 24));
    setPanelPos({
      top: r.bottom + 8,
      right: Math.max(12, window.innerWidth - r.right),
      width: w,
    });
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [panelOpen, updatePanelPosition]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setPanelOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [panelOpen]);

  const shellStyle = {
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 152,
    minWidth: 0,
    padding: '4px 8px 4px 5px',
    borderRadius: 12,
    background: 'linear-gradient(145deg, rgba(255,255,255,0.88), rgba(248,250,252,0.62))',
    border: '1px solid rgba(15, 23, 42, 0.1)',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
  };

  const iconWrap = {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(15, 23, 42, 0.06)',
  };

  if (state.phase === 'loading') {
    return (
      <div
        className="app-nav-dashboard-weather"
        style={shellStyle}
        aria-busy="true"
        aria-label={t('travelWeather.navLocatingWeather', '위치·날씨 확인 중')}
        title={t('travelWeather.navLocatingWeather', '위치·날씨 확인 중')}
      >
        <div style={iconWrap}>
          <Loader2 size={18} strokeWidth={1.75} className="animate-spin" style={{ color: '#64748b' }} aria-hidden />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', lineHeight: 1.2 }}>
          {t('travelWeather.navLocatingShort', '위치·날씨')}
        </span>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div
        className="app-nav-dashboard-weather"
        style={shellStyle}
        aria-label={t('travelWeather.ariaError', '날씨를 불러오지 못했습니다.')}
        title={t('travelWeather.ariaError', '날씨를 불러오지 못했습니다.')}
      >
        <div style={iconWrap}>
          <CloudOff size={18} strokeWidth={1.45} style={{ color: '#94a3b8' }} aria-hidden />
        </div>
        <span style={{ fontSize: 10, fontWeight: 650, color: '#94a3b8' }}>{t('travelWeather.navErrorShort', '날씨 오류')}</span>
      </div>
    );
  }

  if (!presentation) return null;

  const slot0 = timeline.slots?.[0];
  const Icon = slot0?.Icon ?? presentation.Icon;
  const iconProps = slot0?.iconProps ?? presentation.iconProps;
  const { ariaLabel, kind } = presentation;
  const size = kind === 'rain' || kind === 'vague' || kind === 'maybe' || slot0?.wet ? 20 : 18;

  const placeHint = caption.regionHint || caption.regionLine;
  const glyphAria = [placeHint, ariaLabel, timelineAria].filter(Boolean).join('. ');
  const glyphTitle = placeHint ? `${placeHint} — ${[ariaLabel, timelineAria].filter(Boolean).join('. ')}` : glyphAria;

  const textEllipsis = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  const showPanelLoader = activeRegionId !== MINE_TAB && fetchingReg === activeRegionId && !activePanelData;
  const showPanelErr = activeRegionId !== MINE_TAB && regionErr[activeRegionId] && !activePanelData && !showPanelLoader;
  const lang = i18n?.language || 'ko';

  const tabButtonStyle = (active) => ({
    flex: '0 0 auto',
    border: 'none',
    borderRadius: 999,
    padding: '6px 11px',
    fontSize: 11,
    fontWeight: active ? 800 : 600,
    cursor: 'pointer',
    background: active ? 'rgba(15, 118, 110, 0.18)' : 'rgba(15, 23, 42, 0.06)',
    color: active ? '#0f766e' : '#475569',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  });

  const widgetInner = (
    <>
      <div style={iconWrap}>
        <Icon size={size} aria-hidden {...iconProps} />
      </div>
      <div style={{ minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {caption.regionLine ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 750,
              color: '#0f766e',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              ...textEllipsis,
            }}
          >
            {caption.regionLine}
          </span>
        ) : null}
        <span
          style={{
            fontSize: 10,
            fontWeight: 750,
            color: '#334155',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            ...textEllipsis,
          }}
        >
          {caption.line1}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: '#0f172a',
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            ...textEllipsis,
          }}
        >
          {caption.line2}
        </span>
        {caption.line3 ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 750,
              fontVariantNumeric: 'tabular-nums',
              color: '#475569',
              lineHeight: 1.15,
              ...textEllipsis,
            }}
          >
            {caption.line3}
          </span>
        ) : null}
        {caption.foot ? (
          <span style={{ fontSize: 8, fontWeight: 650, color: '#64748b', letterSpacing: '0.02em', lineHeight: 1.15 }}>
            {caption.foot}
          </span>
        ) : null}
      </div>
      <ChevronDown
        size={14}
        strokeWidth={2.25}
        aria-hidden
        style={{
          flexShrink: 0,
          color: '#64748b',
          transform: panelOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
        }}
      />
    </>
  );

  return (
    <div ref={wrapRef} className="app-nav-dashboard-weather-wrap" style={{ position: 'relative' }}>
      <button
        ref={anchorRef}
        type="button"
        className="app-nav-dashboard-weather app-nav-dashboard-weather--widget"
        style={{
          ...shellStyle,
          cursor: 'pointer',
          border: shellStyle.border,
          font: 'inherit',
          textAlign: 'left',
          width: 'auto',
          maxWidth: 160,
        }}
        aria-expanded={panelOpen}
        aria-controls={panelId}
        aria-label={t('travelWeather.widgetAria', '{{summary}}. 지역별 예보 패널 열기', { summary: glyphAria })}
        title={glyphTitle}
        onClick={() => setPanelOpen((v) => !v)}
      >
        {widgetInner}
      </button>
      {panelOpen ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('travelWeather.panelByRegion', '지역별 예보')}
          className="app-nav-weather-panel"
          style={{
            position: 'fixed',
            zIndex: 1300,
            top: panelPos.top,
            right: panelPos.right,
            width: panelPos.width,
            maxHeight: 'min(75vh, 480px)',
            overflowY: 'auto',
            padding: '14px 14px 16px',
            borderRadius: 16,
            background: 'linear-gradient(165deg, rgba(255,255,255,0.98), rgba(248,250,252,0.97))',
            border: '1px solid rgba(15, 23, 42, 0.12)',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
                {t('travelWeather.panelByRegion', '지역별 예보')}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 10, lineHeight: 1.35, color: '#64748b' }}>
                {t('travelWeather.panelRegionTabsHint', '탭마다 해당 지역 대표 좌표로 초단기·단기 API를 다시 요청합니다.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              style={{
                flexShrink: 0,
                border: 'none',
                background: 'rgba(15, 23, 42, 0.06)',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              {t('travelWeather.widgetClose', '닫기')}
            </button>
          </div>

          <div
            role="tablist"
            aria-label={t('travelWeather.regionTablistAria', '예보 지역 선택')}
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 10,
              marginBottom: 8,
              borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeRegionId === MINE_TAB}
              style={tabButtonStyle(activeRegionId === MINE_TAB)}
              onClick={() => setActiveRegionId(MINE_TAB)}
            >
              {t('travelWeather.tabMine', '내 위치')}
            </button>
            {presetTabs.map((p) => (
              <button
                key={p.reg}
                type="button"
                role="tab"
                aria-selected={activeRegionId === p.reg}
                style={tabButtonStyle(activeRegionId === p.reg)}
                onClick={() => setActiveRegionId(p.reg)}
              >
                {weatherPresetLabel(p, lang)}
              </button>
            ))}
          </div>

          {activeRegionHint.regionLine || gridNote ? (
            <div style={{ fontSize: 11, fontWeight: 650, color: '#0f766e', marginBottom: 10, lineHeight: 1.35 }}>
              {activeRegionHint.regionLine || t('travelWeather.navRegionCode', '예보구역 {{code}}', { code: activePanelData?.reg || '—' })}
              {gridNote ? ` · ${gridNote}` : ''}
            </div>
          ) : null}

          {showPanelLoader ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 4px', color: '#64748b' }}>
              <Loader2 size={20} strokeWidth={1.75} className="animate-spin" aria-hidden />
              <span style={{ fontSize: 12 }}>{t('travelWeather.panelLoadingRegion', '해당 지역 예보 불러오는 중…')}</span>
            </div>
          ) : showPanelErr ? (
            <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
              {t('travelWeather.panelRegionError', '이 지역 예보를 불러오지 못했습니다. 잠시 후 다시 탭을 눌러 보세요.')}
            </p>
          ) : activePanelData?.configured === false ? (
            <div style={{ fontSize: 12, lineHeight: 1.45, color: '#b45309' }}>
              <p style={{ margin: '0 0 6px' }}>
                {t(
                  'travelWeather.panelKmaUnavailable',
                  '기상청 단기·초단기 예보를 켜려면 서버에 KMA_API_KEY가 필요합니다. Heroku Config Vars에 공공데이터포털에서 발급한 키를 설정한 뒤 재배포하세요.'
                )}
              </p>
              {activePanelData.message ? (
                <p style={{ margin: 0, fontSize: 11, color: '#78716c' }}>{String(activePanelData.message)}</p>
              ) : null}
            </div>
          ) : !activeTimelines.hasVsrt && !activeTimelines.hasShort ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{t('travelWeather.panelEmpty', '표시할 예보 시간대가 없습니다.')}</p>
          ) : (
            <>
              <ForecastSection
                title={t('travelWeather.panelVsrt', '초단기예보 (≈1시간)')}
                hint={
                  activeTimelines.hasVsrt
                    ? t(
                        'travelWeather.forecastHourlyVsrtHint',
                        '초단기 격자(시간). 같은 시각의 단기 SKY·POP 등이 있으면 슬롯에 보강됩니다.'
                      )
                    : ''
                }
                slots={activeTimelines.hasVsrt ? activeTimelines.vsrtSlots : []}
                t={t}
              />
              <ForecastSection
                title={t('travelWeather.panelShort', '단기예보 (3시간·SKY)')}
                hint={
                  activeTimelines.hasShort
                    ? t(
                        'travelWeather.forecastStepHint',
                        '단기 reg 구역의 3시간 간격 예보. 맑음·구름·흐림(SKY)·강수확률(POP) 등.'
                      )
                    : ''
                }
                slots={activeTimelines.hasShort ? activeTimelines.shortSlots : []}
                t={t}
              />
            </>
          )}
          <p style={{ margin: '12px 0 0', fontSize: 9, lineHeight: 1.4, color: '#94a3b8' }}>
            {t(
              'travelWeather.panelDisclaimer',
              '값은 기상청 발표·API 응답을 바탕으로 합니다. 출입·안전은 반드시 공식 예보를 확인하세요.'
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
