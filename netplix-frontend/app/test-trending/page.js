'use client';

import React from 'react';
import TrendingRegionsWidget from '@/components/TrendingRegionsWidget';

// Playwright E2E 전용 — 외부 의존 최소화 상태로 TrendingRegionsWidget 만 렌더한다.
// 테스트는 /api/v1/tour/trending-regions?period=... 을 route.mock 으로 가로챈다.
export default function TestTrendingPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0b0b0e',
        padding: 40,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
      data-testid="trending-test-root"
    >
      <TrendingRegionsWidget limit={5} />
    </main>
  );
}
