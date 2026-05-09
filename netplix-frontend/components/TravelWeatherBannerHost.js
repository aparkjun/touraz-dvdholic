'use client';

import { usePathname } from 'next/navigation';
import { isTravelThemedPath } from '@/components/AppRouteTheme';
import TravelWeatherStrip from '@/components/TravelWeatherStrip';

/** NavBar 아래 — 여행 테마 경로에서만 단기예보 스트립 노출 */
export default function TravelWeatherBannerHost() {
  const pathname = usePathname();
  if (!isTravelThemedPath(pathname)) return null;
  if (pathname === '/dashboard' || pathname?.startsWith('/dashboard/')) return null;
  return <TravelWeatherStrip />;
}
