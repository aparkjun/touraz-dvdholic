import { NextResponse } from 'next/server';

const VISITED_COOKIE = 'visited_home';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30일

// 미들웨어 체크에서 제외할 경로(Prefix 매칭)
// - API/OAuth 백엔드 프록시, Next.js 내부 리소스, PWA/정적 파일 등은 제외
const BYPASS_PREFIXES = [
  '/api',
  '/oauth2',
  '/login/oauth2',
  '/_next',
  '/static',
  '/public',
  '/assets',
  '/locales',
];

const BYPASS_FILES = new Set([
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/sw.js',
  '/service-worker.js',
  '/apple-touch-icon.png',
]);

function shouldBypass(pathname) {
  if (BYPASS_FILES.has(pathname)) return true;
  for (const prefix of BYPASS_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
  }
  // 확장자가 있는 정적 리소스 (이미지, 폰트 등) 는 통과
  if (/\.[a-zA-Z0-9]{2,5}$/.test(pathname)) return true;
  return false;
}

export function middleware(request) {
  const { nextUrl } = request;
  const { pathname, search } = nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const hasVisited = request.cookies.get(VISITED_COOKIE)?.value === '1';
  const isNativeApp = request.cookies.get('X-App-Platform')?.value === 'native';

  // 홈('/') 진입 시: 방문 쿠키를 세팅하고 통과
  if (pathname === '/') {
    const response = NextResponse.next();
    if (!hasVisited) {
      response.cookies.set(VISITED_COOKIE, '1', {
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        httpOnly: false,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return response;
  }

  // 랜딩 CTA(둘러보기·로그인·회원가입) 와 네이티브 앱은 방문 쿠키가 없어도 통과.
  // iOS Capacitor WKWebView 는 Set-Cookie/Lax 쿠키가 다음 이동에 안 붙어
  // /login 등이 즉시 / 로 튕겨 '버튼이 안 눌리는' 것처럼 보인다.
  const LANDING_EXITS = new Set(['/login', '/signup', '/dashboard']);
  if (!hasVisited && !isNativeApp && !LANDING_EXITS.has(pathname)) {
    const url = nextUrl.clone();
    url.pathname = '/';
    // 방문 후 원래 목적지로 이동할 수 있도록 next 파라미터 저장
    url.search = '';
    const nextParam = `${pathname}${search || ''}`;
    if (nextParam && nextParam !== '/') {
      url.searchParams.set('next', nextParam);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Next.js 내부 경로와 정적 파일은 매처에서 제외
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|manifest.json|robots.txt|sitemap.xml|sw.js|service-worker.js).*)',
  ],
};
