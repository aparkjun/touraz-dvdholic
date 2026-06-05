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

/* ── 브랜드 대표 아이콘 (인라인 SVG, 의존성 없음) ───────────────────────── */

// iOS · App Store — 앱스토어 블루 라운드 사각형 + 흰색 애플 로고
function AppStoreIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gepl-as" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#18BFFB" />
          <stop offset="1" stopColor="#2072F3" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.4" fill="url(#gepl-as)" />
      <path
        fill="#fff"
        d="M14.86 7.18c.5-.61.84-1.45.75-2.29-.72.03-1.59.48-2.11 1.09-.46.53-.87 1.39-.76 2.21.8.06 1.62-.41 2.12-1.01zm.74 1.18c-1.16-.07-2.15.66-2.7.66-.56 0-1.41-.62-2.32-.61-1.2.02-2.3.69-2.91 1.76-1.24 2.16-.32 5.35.89 7.11.59.85 1.29 1.81 2.21 1.78.89-.04 1.22-.58 2.3-.58 1.07 0 1.37.58 2.31.56.96-.02 1.56-.87 2.15-1.72.68-.99.95-1.95.97-2-.02-.01-1.86-.72-1.88-2.83-.02-1.77 1.44-2.61 1.5-2.66-.82-1.2-2.09-1.34-2.55-1.37z"
      />
    </svg>
  );
}

// Android · Play 스토어 — 구글 플레이 플레이 삼각형(4색 그라데이션)
function GooglePlayIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gepl-gp" x1="4" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00E2FF" />
          <stop offset="0.4" stopColor="#00F076" />
          <stop offset="0.72" stopColor="#FFCE00" />
          <stop offset="1" stopColor="#FF3A44" />
        </linearGradient>
      </defs>
      <path fill="url(#gepl-gp)" d="M5 3.4c0-.74.8-1.2 1.44-.83l13.1 7.6c.64.37.64 1.29 0 1.66l-13.1 7.6c-.64.37-1.44-.09-1.44-.83V3.4z" />
    </svg>
  );
}

// Windows — 4개 파란 사각형
function WindowsIcon({ size = 19 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#0078D4" d="M3 4.5l8.2-1.12v8.2H3V4.5zm0 15l8.2 1.12v-8.1H3v6.98zm9.3 1.27L21 22V12.6h-8.7v8.17zM12.3 3.23v8.17H21V2l-8.7 1.23z" />
    </svg>
  );
}

// macOS — 애플 로고
function AppleIcon({ size = 19, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill={color}
        d="M16.36 1.43c0 1.14-.42 2.2-1.13 3.02-.86.98-2.27 1.74-3.39 1.65-.14-1.11.43-2.27 1.1-3.02.84-.94 2.32-1.65 3.42-1.65zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.97-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.93-1.0-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.78-4.04-3.35C-.07 16.86-.33 11.6 1.4 8.79c.99-1.6 2.55-2.6 4.02-2.6 1.5 0 2.44 1.0 3.68 1.0 1.2 0 1.93-1.0 3.67-1.0 1.31 0 2.7.71 3.69 1.94-3.24 1.78-2.71 6.41.04 8.07z"
      />
    </svg>
  );
}

/**
 * @param {'light'|'dark'} variant
 * @param {boolean} compact — 작은 칩·좁은 화면용
 */
export default function GoogleEarthProPlatformLinks({ variant = 'dark', compact = false }) {
  const { t } = useTranslation();
  const isLight = variant === 'light';
  const iconSize = compact ? 22 : 26;
  // 텍스트 라벨 대신 브랜드 대표 아이콘만 노출 — 한눈에 OS/스토어를 알 수 있게.
  const chip = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    width: iconSize + (compact ? 12 : 14),
    height: iconSize + (compact ? 12 : 14),
    borderRadius: 12,
    border: isLight ? '1px solid rgba(5, 150, 105, 0.38)' : '1px solid rgba(110, 231, 183, 0.38)',
    background: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(6, 78, 59, 0.35)',
    lineHeight: 0,
  };
  const appleColor = isLight ? '#0f172a' : '#f1f5f9';

  const items = [
    { key: 'ios', href: URLS.ios, labelKey: 'common.earthProLinkIos', fb: 'iOS · App Store', Icon: () => <AppStoreIcon size={iconSize} /> },
    { key: 'android', href: URLS.android, labelKey: 'common.earthProLinkAndroid', fb: 'Android · Play 스토어', Icon: () => <GooglePlayIcon size={iconSize} /> },
    { key: 'windows', href: URLS.windows, labelKey: 'common.earthProLinkWindows', fb: 'Windows · Earth Pro', Icon: () => <WindowsIcon size={iconSize - 1} /> },
    { key: 'mac', href: URLS.mac, labelKey: 'common.earthProLinkMac', fb: 'macOS · Earth Pro', Icon: () => <AppleIcon size={iconSize - 1} color={appleColor} /> },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 8,
        alignItems: 'flex-start',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontSize: compact ? 10 : 11,
          fontWeight: 650,
          letterSpacing: '0.02em',
          color: isLight ? '#0f172a' : 'rgba(236, 254, 255, 0.82)',
          lineHeight: 1.35,
          maxWidth: '100%',
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
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
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        {items.map(({ key, href, labelKey, fb, Icon }) => {
          const label = t(labelKey, fb);
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={chip}
              aria-label={label}
              title={label}
            >
              <Icon />
            </a>
          );
        })}
      </div>
    </div>
  );
}
