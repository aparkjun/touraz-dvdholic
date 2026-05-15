'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 공식 스토어 / 구글 안내 URL (리다이렉트·버전은 구글 정책에 따름).
 * - 모바일: Google Earth 앱 (GPX 등은 앱·OS에 따라 다름)
 * - Windows·macOS: Google Earth Pro 데스크톱 설치 안내(동일 게이트에서 OS 선택)
 */
const URLS = {
  ios: 'https://apps.apple.com/app/google-earth/id293622097',
  android: 'https://play.google.com/store/apps/details?id=com.google.earth',
  windows: 'https://www.google.com/intl/ko/earth/download/gep/agree.html',
  mac: 'https://www.google.com/intl/ko/earth/download/gep/agree.html',
};

/**
 * @param {'light'|'dark'} variant
 * @param {boolean} compact — 작은 칩·좁은 화면용
 */
export default function GoogleEarthProPlatformLinks({ variant = 'dark', compact = false }) {
  const { t } = useTranslation();
  const isLight = variant === 'light';
  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: compact ? 10.5 : 11.5,
    fontWeight: 700,
    textDecoration: 'none',
    padding: compact ? '4px 9px' : '5px 11px',
    borderRadius: 999,
    border: isLight ? '1px solid rgba(5, 150, 105, 0.38)' : '1px solid rgba(110, 231, 183, 0.38)',
    color: isLight ? '#065f46' : '#d1fae5',
    background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(6, 78, 59, 0.35)',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };

  const items = [
    { key: 'ios', href: URLS.ios, labelKey: 'common.earthProLinkIos', fb: 'iOS · App Store' },
    { key: 'android', href: URLS.android, labelKey: 'common.earthProLinkAndroid', fb: 'Android · Play 스토어' },
    { key: 'windows', href: URLS.windows, labelKey: 'common.earthProLinkWindows', fb: 'Windows · Earth Pro' },
    { key: 'mac', href: URLS.mac, labelKey: 'common.earthProLinkMac', fb: 'macOS · Earth Pro' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 8,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          fontSize: compact ? 10 : 11,
          fontWeight: 650,
          letterSpacing: '0.02em',
          color: isLight ? '#0f172a' : 'rgba(236, 254, 255, 0.82)',
          lineHeight: 1.35,
        }}
      >
        {t(
          'common.earthProLinksHint',
          'GPX 경로 보기 — 기기에 맞게 구글 어스(모바일) 또는 Earth Pro(Windows·Mac)를 설치해 주세요.'
        )}
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
        }}
      >
        {items.map(({ key, href, labelKey, fb }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={chip}
          >
            {t(labelKey, fb)}
          </a>
        ))}
      </div>
    </div>
  );
}
