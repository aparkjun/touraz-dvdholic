// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * TrendingRegionsWidget — period 토글 E2E.
 * 백엔드 없이도 검증되도록 trending-regions API 를 route.mock 으로 가로채고,
 *   - period=today → [서울, 부산, ...]
 *   - period=week  → [강원, 제주, ...]
 *   - period=month → [전북, 경남, ...]
 * 각각 다른 지역 목록을 반환해 UI 상태가 period 별로 바뀌는지 확인한다.
 */

const PAYLOAD = {
  today: [
    { areaCode: '1',  regionName: '서울', searchVolume: 1200 },
    { areaCode: '6',  regionName: '부산', searchVolume:  900 },
    { areaCode: '4',  regionName: '대구', searchVolume:  700 },
  ],
  week: [
    { areaCode: '32', regionName: '강원', searchVolume: null },
    { areaCode: '39', regionName: '제주', searchVolume: null },
    { areaCode: '36', regionName: '경남', searchVolume: null },
  ],
  month: [
    { areaCode: '37', regionName: '전북', searchVolume: null },
    { areaCode: '38', regionName: '전남', searchVolume: null },
    { areaCode: '35', regionName: '경북', searchVolume: null },
  ],
};

async function mockTrending(page) {
  await page.route('**/api/v1/tour/trending-regions**', async (route) => {
    const url = new URL(route.request().url());
    const period = (url.searchParams.get('period') || 'today').toLowerCase();
    const list = PAYLOAD[period] || PAYLOAD.today;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: list }),
    });
  });
}

test.describe('TrendingRegionsWidget period toggle', () => {
  test.beforeEach(async ({ page }) => {
    await mockTrending(page);
  });

  test('기본 로드 — today 기간의 지역이 노출되고 타이틀이 "오늘 뜨는 지역"', async ({ page }) => {
    await page.goto('/test-trending');

    await expect(page.getByRole('heading', { name: '오늘 뜨는 지역' })).toBeVisible();
    await expect(page.getByText('서울')).toBeVisible();
    await expect(page.getByText('부산')).toBeVisible();
    // searchVolume 표시 (toLocaleString)
    await expect(page.getByText('1,200')).toBeVisible();
  });

  test('이번주 탭 클릭 → 부제/제목 전환 + 다른 지역 목록', async ({ page }) => {
    await page.goto('/test-trending');

    await page.getByRole('tab', { name: '이번주' }).click();

    await expect(page.getByRole('heading', { name: '이번주 뜨는 지역' })).toBeVisible();
    await expect(page.getByText('관광수요·경쟁력 가중 지수')).toBeVisible();
    await expect(page.getByText('강원')).toBeVisible();
    await expect(page.getByText('제주')).toBeVisible();
    // week 페이로드는 searchVolume=null → 숫자 배지가 숨겨져야 함
    await expect(page.getByText('1,200')).toHaveCount(0);
  });

  test('이번달 탭 → 전북/전남/경북 + ARIA 선택상태', async ({ page }) => {
    await page.goto('/test-trending');

    const monthTab = page.getByRole('tab', { name: '이번달' });
    await monthTab.click();
    await expect(monthTab).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByRole('heading', { name: '이번달 뜨는 지역' })).toBeVisible();
    await expect(page.getByText('문화·관광자원 종합 점수')).toBeVisible();
    await expect(page.getByText('전북')).toBeVisible();
    await expect(page.getByText('전남')).toBeVisible();
  });

  test('지역 카드 클릭 → /cine-trip?area=... 로 이동', async ({ page }) => {
    await page.goto('/test-trending');

    const seoulLink = page.getByRole('link', { name: /서울/ }).first();
    await expect(seoulLink).toHaveAttribute('href', /\/cine-trip\?area=1/);
  });
});
