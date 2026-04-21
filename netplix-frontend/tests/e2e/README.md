# Frontend E2E (Playwright)

CineTrip UI 의 핵심 유저 플로우를 Playwright 로 회귀 검증합니다.

## 최초 설치

```bash
cd netplix-frontend
npm install -D @playwright/test@latest
npx playwright install --with-deps chromium
```

설치 후 `package.json` 의 `devDependencies` 에 `@playwright/test` 가 고정됩니다.

## 실행

```bash
# 헤드리스 전체 실행 (Next.js dev server 자동 기동)
npm run test:e2e

# UI 모드 (디버깅)
npm run test:e2e:ui

# 단일 파일만
npx playwright test tests/e2e/trending-regions.spec.js

# 이미 npm run dev 가 떠 있다면 webServer 스킵
PW_SKIP_WEBSERVER=1 npx playwright test
```

## 현재 커버리지

| 파일 | 시나리오 |
| --- | --- |
| `trending-regions.spec.js` | TrendingRegionsWidget 의 period(오늘/이번주/이번달) 탭 전환, 지역 목록 차이, ARIA 선택 상태, 카드 링크 검증 |

API 호출은 `page.route('**/api/v1/tour/trending-regions**')` 로 모킹하므로 **백엔드 없이도** 그린 빌드가 보장됩니다.

## CI 통합

`.github/workflows/ci.yml` 의 `frontend` job 이후 단계로 추가하려면 아래 한 블록을 추가하세요.

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
  working-directory: ./netplix-frontend

- name: Playwright tests
  env:
    CI: '1'
  run: npm run test:e2e
  working-directory: ./netplix-frontend

- name: Upload Playwright report
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: netplix-frontend/playwright-report
    retention-days: 7
```

## 새 테스트 추가 가이드

1. 가능한 실제 라우트가 아닌 `page.route` 모킹으로 네트워크 의존을 차단합니다.
2. 한글 문자열 매칭 시 `getByRole('heading', { name: '...' })` · `getByText('...')` 를 사용하고 CSS 선택자 지양.
3. period/지역 코드 같이 도메인 상수는 spec 상단에 PAYLOAD 객체로 추출해 유지보수성을 확보합니다.
