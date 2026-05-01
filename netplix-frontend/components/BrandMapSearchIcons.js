'use client';

/**
 * 외부 지도·검색 링크용 브랜드 마크(SVG).
 * - 카카오맵: 노란 버튼엔 dark 핀, 그 외는 currentColor
 * - 네이버: Simple Icons 형태의 N 마크, currentColor(초록 버튼은 흰색 등 부모에서 지정)
 * - Google: 공식 브랜드 색상 조합의 G 마크(멀티 path)
 */

export function KakaoMapLogo({ size = 20, dark = false, style, className }) {
  const fill = dark ? '#191919' : 'currentColor';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={fill}
        d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7z"
      />
    </svg>
  );
}

export function NaverNLogo({ size = 20, style, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.273 3.575v16.85H12.06l-4.32-10.08v10.08H3.727V3.575H7.94l4.32 10.08V3.575h4.013z" />
    </svg>
  );
}

/** Google 멀티컬러 G (48×48 뷰박스, 임의 크기로 스케일) */
export function GoogleGLogo({ size = 22, style, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691 12.877 19.51c.85-2.555 3.102-4.38 5.787-4.38 3.059 0 5.842 1.155 7.961 3.039l5.657-5.657C29.268 4 24 4 16.318 4 9.657 4 4 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.199 0 9.914-1.987 13.455-5.231l-6.19-5.238A11.86 11.86 0 0 1 24 38c-5.202 0-9.618-3.293-11.283-7.89l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.972 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
