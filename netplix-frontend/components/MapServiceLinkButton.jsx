'use client';

import React from 'react';

const NAVER_IMG = '/brands/naver-logo-green.png';
const KAKAO_IMG = '/brands/kakao-map-logo.png';
const GOOGLE_IMG = '/brands/google-g-logo.png';
const GOOGLE_MAPS_IMG = '/brands/google-maps-product.png';

function BrandMark({ brand, compact }) {
  const isCompact = compact === true;
  if (brand === 'naver') {
    return (
      <img
        src={NAVER_IMG}
        alt=""
        width={72}
        height={14}
        decoding="async"
        style={{
          height: isCompact ? 18 : 22,
          width: 'auto',
          maxWidth: isCompact ? 88 : 100,
          objectFit: 'contain',
          display: 'block',
        }}
        aria-hidden
      />
    );
  }
  if (brand === 'kakao') {
    return (
      <img
        src={KAKAO_IMG}
        alt=""
        width={48}
        height={48}
        decoding="async"
        style={{
          width: isCompact ? 28 : 34,
          height: isCompact ? 28 : 34,
          objectFit: 'contain',
          display: 'block',
        }}
        aria-hidden
      />
    );
  }
  if (brand === 'googleMaps') {
    return (
      <img
        src={GOOGLE_MAPS_IMG}
        alt=""
        width={96}
        height={96}
        decoding="async"
        style={{
          width: isCompact ? 26 : 30,
          height: isCompact ? 26 : 30,
          objectFit: 'contain',
          display: 'block',
        }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={GOOGLE_IMG}
      alt=""
      width={48}
      height={48}
      decoding="async"
      style={{
        width: isCompact ? 24 : 28,
        height: isCompact ? 24 : 28,
        objectFit: 'contain',
        display: 'block',
      }}
      aria-hidden
    />
  );
}

/**
 * 공식 브랜드 에셋(public/brands, README.txt 참고) + 밝은 카드형 버튼.
 * @param {'naver'|'kakao'|'google'|'googleMaps'} brand
 */
export function MapServiceLinkButton({
  href,
  brand,
  label,
  size = 'default',
  className,
  style,
  /** 외부 지도로 나가기 직전(복귀 시 모달 복원 등) — 기본 동작은 막지 않음 */
  onBeforeOpen,
}) {
  const isCompact = size === 'compact';
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: isCompact ? 8 : 10,
    padding: isCompact ? '7px 10px' : '11px 14px',
    borderRadius: 12,
    border: '1px solid rgba(15, 23, 42, 0.1)',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: isCompact ? 12 : 14,
    fontWeight: 700,
    letterSpacing: brand === 'naver' ? -0.02 : -0.01,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    textAlign: 'left',
    minHeight: isCompact ? 40 : 48,
    outline: 'none',
    textDecoration: 'none',
    boxSizing: 'border-box',
    ...style,
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onBeforeOpen?.();
      }}
      style={baseStyle}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px #fff, 0 0 0 4px #6366f1';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0, alignItems: 'center' }}>
        <BrandMark brand={brand} compact={isCompact} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    </a>
  );
}
