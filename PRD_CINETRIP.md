> 전체 ui는 magic mcp를 호출해줘.
> 버튼들은 단색으로 하지 말고 두가지 색깔로 해줘.

# PRD — CineTrip × 문화지도

> "영화/DVD 콘텐츠와 한국관광공사 데이터랩을 엮어, **취향 기반 국내여행**을 제안하고 **지역 문화 인프라(DVD 매장 포함)**의 인사이트를 제공하는 확장 기능."

- 문서 버전: v1.0 (2026-04-21)
- 작성: touraz-dvdholic 팀
- 대상 릴리스: 한국관광공사 공모전 제출 버전 (MVP)
- 관련 외부 API: [한국관광콘텐츠랩 데이터랩 API](https://api.visitkorea.or.kr/#/useUtilExercises) · [data.go.kr 15152138](https://www.data.go.kr/data/15152138/openapi.do)

---

## 1. 배경 (Why)

### 1.1 문제 정의

- 기존 앱은 **영화/DVD 카탈로그 + 전국 DVD 매장 지도**를 이미 보유하고 있지만, "왜 이 지역을 방문해야 하는가"에 대한 **여행 동기**가 약하다.
- 지자체 관광 담당 실무자는 **콘텐츠 IP(영화/드라마)** 를 관광 활성화에 활용하고 싶지만, _"우리 지역과 관련된 영화 + 현재 방문 수요 + 문화 인프라"_ 를 한 번에 볼 수 있는 도구가 없다.
- 오프라인 DVD 매장은 사라지고 있지만(`DvdStore.closureDate` 데이터 다수), **"문화자원 수요"** 가 높은 지자체는 여전히 존재 → 데이터 괴리를 통해 **새 문화 거점 후보**를 제안할 수 있다.

### 1.2 기회

1. 앱이 이미 보유한 자산:
   - 영화/DVD 카탈로그(TMDB) + 30+ 카테고리 + AI 추천(OpenAI)
   - 전국 DVD 매장 DB + 좌표 + 주변 찾기(Leaflet)
   - 배치 인프라(새벽 2~3시 KST 슬롯), 헥사고날 아키텍처, i18n, Capacitor iOS/Android
2. 관광공사 데이터랩 제공 지표:
   - **관광수요지수** (지자체별 방문 수요)
   - **관광경쟁력** (지자체별 공급·경쟁력)
   - **문화자원 수요** (문화 콘텐츠/시설 수요)
   - **관광서비스 수요** · **관광자원 수요** · **검색량** (시계열 트렌드)
3. 두 축의 교집합 = **"콘텐츠 투어리즘(Content Tourism)"** 플랫폼.

### 1.3 공모전 심사 포인트 연결

| 심사 항목       | 본 기능의 답                                                         |
| --------------- | -------------------------------------------------------------------- |
| API 활용 적합성 | 데이터랩 4개 주요 지표 전부 사용 (수요/경쟁력/문화자원/검색량)       |
| 지역 기반 활용  | `DvdStore.areaCode` 및 촬영지 지자체 매핑 테이블 기반 join           |
| 사회적 가치     | 소멸위기 지자체의 영화 IP 활용 관광 활성화 + 로컬 오프라인 매장 상생 |
| 기술 차별성     | 영화 IP × 위치 × AI 추천의 3중 퓨전 (경쟁작에서 드문 조합)           |

---

## 2. 목표 (What / Goals)

### 2.1 제품 목표

1. 사용자가 **영화/DVD 상세 → 해당 지역 여행 정보**로 바로 이동할 수 있게 한다.
2. 사용자가 **관광 트렌드가 뜨는 지역 → 관련 영화/DVD + 인근 DVD 매장**을 추천받을 수 있게 한다.
3. 지자체 담당자/연구자가 **DVD 매장 × 문화자원 수요 × 관광 경쟁력**을 한 화면에서 비교할 수 있게 한다.

### 2.2 Non-Goals (이번 스코프 제외)

- 실제 여행 예약/결제 (숙박·교통 연계 X)
- 지자체별 상세 관광 POI DB 자체 구축 (공공 API만 활용)
- 영화 촬영지 전수 크롤링 (MVP는 큐레이션 100편 + 확장형 구조)
- B2B 유료 지자체 리포트 SaaS화 (차후 단계)

### 2.3 성공 지표 (KPI)

| 구분   | 지표                                 | MVP 목표        |
| ------ | ------------------------------------ | --------------- |
| 사용성 | CineTrip 페이지 DAU / 전체 DAU       | ≥ 15%           |
| 사용성 | CineTrip → DVD 매장 상세 전환율      | ≥ 8%            |
| 사용성 | "AI 여행 모드" 프롬프트 완료율       | ≥ 60%           |
| 기술   | 관광공사 API 일일 호출량 (배치 경유) | ≤ 1,000 req/day |
| 기술   | 캐시 적중률 (지자체 지표)            | ≥ 90%           |
| 공모전 | 데이터랩 4대 지표 모두 UI 노출       | 100% 달성       |

---

## 3. 페르소나 & 사용자 스토리

### 3.1 페르소나

- **P1. "영화팬 지수(28, 회사원)"** — 주말마다 국내여행 아이디어를 얻고 싶어함. 방금 본 한국영화의 배경지가 궁금하다.
- **P2. "시네필 민호(42, DVD 수집가)"** — 지방 출장 길에 근처 DVD 매장을 들르고 싶음. 해당 지역의 문화 색깔도 궁금.
- **P3. "지자체 주무관 현정(35)"** — 우리 지역 관광수요가 떨어지는데, 우리 지역 배경 영화로 마케팅 기회를 찾고 싶음. 앱 관리자 대시보드를 보는 유일한 내부 유저군.

### 3.2 핵심 유저 스토리 (MoSCoW)

| ID   | 스토리                                                                                                              | 우선순위     |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ------------ |
| US-1 | P1로서, 영화 상세화면에서 **"이 영화의 배경으로 여행하기"** 를 눌러 해당 지자체 정보와 인근 DVD 매장을 본다.        | Must         |
| US-2 | P1로서, 홈에서 **"오늘 검색량 급등 지자체 Top 3"** 와 각 지역 배경 영화 2~3편을 한눈에 본다.                        | Must         |
| US-3 | P1로서, AI 추천창에 _"경남 주말여행 영화"_ 라고 쓰면 AI가 관광공사 지표를 근거로 **추천 이유를 포함**해서 답해준다. | Must         |
| US-4 | P2로서, DVD 매장 지도에서 **"관광 수요"/"문화자원 수요"** 히트맵 레이어를 토글해 지역별 색상으로 본다.              | Must         |
| US-5 | P3로서, 관리자 화면에서 **"DVD 매장 폐업률 vs 문화자원 수요"** 시계열 차트와 CSV 다운로드를 받는다.                 | Should       |
| US-6 | P1로서, 소멸위기 지자체 배지가 붙은 영화에 **"지역을 살리는 영화"** 라벨이 보인다.                                  | Should       |
| US-7 | P1로서, CineTrip 결과를 **친구에게 공유**할 수 있다 (카카오톡 공유).                                                | Could        |
| US-8 | P3로서, 지자체별 월간 리포트를 **이메일 구독**으로 받는다.                                                          | Won't (차기) |

---

## 4. 범위 (Scope / Features)

### 4.1 Feature A — 관광공사 API 연동 레이어 (Foundation)

**목적**: 모든 기능의 기반. 헥사고날 아키텍처 규칙에 맞춰 외부 API는 `adapter-http` 에, 저장은 `adapter-persistence` 에 둔다.

**구현 요소**

- `netplix-adapters/adapter-http/.../visitkorea/` 패키지 신설
  - `VisitKoreaDataLabHttpClient` — 기존 `TmdbHttpClient` 와 동일 패턴의 `RestTemplate` 기반 클라이언트
  - 응답 DTO: `TourDemandIndexResponse`, `TourCompetitivenessResponse`, `CulturalResourceDemandResponse`, `TourSearchVolumeResponse`
  - 인증: data.go.kr `serviceKey` 쿼리 파라미터 / `.env` 에 `VISITKOREA_SERVICE_KEY` 추가
- `netplix-core/core-port/.../tour/` 포트
  - `FetchTourDemandPort`, `FetchCulturalResourcePort`, `FetchTourSearchTrendPort`
- `netplix-core/core-domain/.../tour/`
  - 도메인: `TourIndex(areaCode, regionName, period, demand, competitiveness, culturalDemand, searchVolume)`
- `netplix-adapters/adapter-persistence/.../tour/`
  - `TourIndexSnapshotEntity` 테이블 (areaCode + date unique) — **일 1회 배치가 upsert**
  - `TourIndexRepository`
- **레이트리밋 / 캐시**
  - Redis TTL 6시간 (실시간 페이지 요청 방어)
  - 배치 실행 시 API 호출 허용 (배치 경유 호출이 주 경로)

**백엔드 API (apps-api)**

```
GET  /api/v1/tour/regions                      # 지자체 리스트 + 최신 스냅샷
GET  /api/v1/tour/region/{areaCode}            # 단일 지자체 지표 + 시계열
GET  /api/v1/tour/trending?period=today&limit=10   # 검색량 급등 Top N
```

**비고**: 기존 `HttpModule` 에 Bean 등록, `PortModule` 에 포트 배선.

---

### 4.2 Feature B — CineTrip: 영화 × 지역 큐레이션 (핵심)

**목적**: US-1, US-3, US-6 충족. 공모전의 **메인 데모 플로우**.

**데이터 모델**

- `MOVIE_REGION_MAPPING` 신규 테이블 (수동 큐레이션 + 확장 가능)
  ```
  movie_name VARCHAR        -- movies.movie_name FK
  area_code  VARCHAR        -- 지자체 코드 (관광공사 지자체 표준 코드)
  region_name VARCHAR       -- "부산광역시 해운대구"
  mapping_type ENUM('SHOT', 'BACKGROUND', 'THEME')  -- 촬영지/배경/테마
  evidence VARCHAR(500)     -- "영화 '범죄도시4' 주요 촬영지"
  confidence TINYINT        -- 1~5 (큐레이션 신뢰도)
  created_at/by, modified_at/by
  ```
- 초기 데이터: **큐레이션 CSV 100편 수작업 투입** → `test_dvd_csv/` 와 동일한 패턴으로 `/resources/seed/movie-region-mapping.csv` 제공

**UI — `/cine-trip` 신설 Next.js 페이지**

레이아웃:

```
┌──────────────────────────────────────────────┐
│ Hero: "영화로 떠나는 국내여행"                │
│ [오늘 검색량 급등 지자체 Top 3 카드]          │ ← US-2
├──────────────────────────────────────────────┤
│ [지역 검색/필터: 시도 > 시군구]               │
│ [선택 지역 카드]                             │
│  - 관광수요지수 (게이지)                     │
│  - 관광경쟁력 (뱃지)                         │
│  - 문화자원 수요 (뱃지)                      │
│  - 검색량 30일 트렌드 (스파크라인)           │
│  - 소멸위기 배지 (조건부)                    │
├──────────────────────────────────────────────┤
│ [이 지역 배경 영화/DVD] — 가로 스크롤 캐로셀 │
│   (기존 dash-card 스타일 재사용)            │
├──────────────────────────────────────────────┤
│ [이 지역 DVD 매장] — 3~5곳 미니 맵 + 리스트  │
│   ("지도에서 전체 보기" → /dvd-stores?area=) │
└──────────────────────────────────────────────┘
```

**진입 경로**

1. 네비게이션 바에 `CineTrip` 메뉴 추가 (`NavBar.js`).
2. 영화 상세(`/dashboard/images`)에 "이 영화의 배경으로 여행하기" CTA 버튼 → `/cine-trip?movieName=...`.
3. 홈 대시보드 상단 신규 위젯 **"오늘 뜨는 지역"** — 기존 Today/Week/Month 위젯 옆에 1/3 폭 카드.

**백엔드 API**

```
GET /api/v1/cinetrip/region/{areaCode}
    → { region: TourIndex, movies: MovieResponse[], dvdStores: DvdStore[] }
GET /api/v1/cinetrip/movie/{movieName}/regions
    → MovieRegionMapping[] (영화 기준 역매핑)
GET /api/v1/cinetrip/trending?period=today&limit=3
    → { region: TourIndex, featuredMovies: MovieResponse[] }[]
```

---

### 4.3 Feature C — 문화지도(Culture Map) — DVD 매장 × 관광 히트맵

**목적**: US-4, US-5 충족. 기존 `/dvd-stores` 페이지를 **인사이트 레이어**로 업그레이드.

**UI 변경**

- 지도 우상단 레이어 스위치(3종, 다중 선택 가능):
  1. **DVD 매장 밀도** (운영 중 매장 기준)
  2. **관광수요지수** (지자체 choropleth)
  3. **문화자원 수요** (지자체 choropleth)
- 지자체 클릭 시 팝오버:
  - 매장 수(영업/폐업), 관광수요, 경쟁력, 문화자원, 30일 검색량 추이
  - "이 지역 CineTrip 보기" → `/cine-trip?areaCode=...`
- **괴리 지역 자동 강조** 토글:
  - "문화자원 수요 상위 20% ∩ DVD 매장 0" → 보라색 외곽선 + "신규 문화 거점 후보" 라벨
  - "DVD 매장 다수 ∩ 관광수요 하위 20%" → 주황색 외곽선 + "로컬 마케팅 필요" 라벨

**데이터 파이프**

- 프론트는 `/api/v1/tour/regions` 1회 호출 + 지자체 GeoJSON 정적 파일(`/public/geo/kr-admin.json`)로 choropleth 렌더.
- 히트맵 레이어는 Leaflet 이미 설치되어 있으므로 `leaflet.heat` 플러그인 추가 또는 `GeoJSON` layer 활용.

**백엔드 API**

```
GET /api/v1/dvd-stores/stats/by-region       # 지자체별 {total, operating, closed}
GET /api/v1/tour/regions?include=areaCode,demand,culturalDemand  # 경량 응답
```

---

### 4.4 Feature D — AI 추천 "여행 모드" 확장

**목적**: US-3 충족. 기존 `/api/v1/movie/recommend/prompt` (`PromptRecommendUseCase`) 를 확장.

**동작**

1. 프론트 프롬프트 박스에 토글: _"여행/지역 추천 포함"_
2. 토글 ON 시 요청에 `mode=travel` 쿼리 추가.
3. 백엔드: 프롬프트에서 **지역명 추출(정규식 + 한국 시도/시군구 사전)** → `TourIndex` 스냅샷을 **system context**로 주입:
   ```
   [관광공사 데이터 컨텍스트]
   경남 통영시: 관광수요지수 76 (상위 18%), 문화자원수요 82, 검색량 30일 +38%.
   전남 곡성군: 관광수요지수 42 (하위 35%, 소멸위기), 문화자원수요 55, 검색량 +5%.
   ...
   위 데이터를 근거로 사용자의 요청에 맞는 영화와 지역을 제안하고, 응답 JSON의 `reason` 에 지표 숫자를 포함하라.
   ```
4. 응답 카드에 **근거 뱃지** 표시: `🔥 검색량 +38%`, `⚠️ 관광 경쟁력 하위 20%`.

**확장 포인트**

- 기존 `OpenAiClientPort` 에 `recommendWithTourContext(query, tourIndices)` 메서드 추가.
- 결과 DTO `MovieWithRecommendReason` 에 `regionContext: { areaCode, metrics }` 필드 추가.

---

### 4.5 Feature E — 관리자 대시보드 인사이트 (Should)

**목적**: US-5, P3 페르소나.

- 관리자(`/admin`) 탭 신설: **"문화×관광 인사이트"**
- 차트:
  1. 지자체별 DVD 매장 영업/폐업률 히트맵
  2. 문화자원수요 vs 폐업률 산점도
  3. 관광수요지수 월간 추이 (전국 평균 vs 선택 지자체)
- "CSV 다운로드" 버튼 (기존 관리자 CSV export 패턴 재사용 가능하면 활용)

---

### 4.6 Feature F — 배치 잡 (인프라)

**신규 배치 3종 (`netplix-apps/app-batch`)**

| 배치                          | 주기           | 설명                                                                                         |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `SyncTourIndexBatch`          | 매일 03:30 KST | 관광공사 API 일일 호출 → `tour_index_snapshots` upsert. 지자체 약 250개 × 4지표 ≈ 1,000 req. |
| `ComputeTrendingRegionsBatch` | 매일 04:00 KST | 검색량 7일 이동평균 대비 급등률 계산 → `trending_regions` 캐시 갱신.                         |
| `RecomputeCineTripScoreBatch` | 매일 04:30 KST | 영화×지역 매핑의 `trending_score` 재계산 (검색량·수요 반영).                                 |

- 기존 `BatchScheduler` 와 `HttpPageItemReader` 패턴 재사용.
- 실패 시 Slack/이메일 알림은 기존 관리자 알림 파이프를 따른다.

---

## 5. 정보 아키텍처 / 사이트맵 변경

```
/ (대시보드)
├── /dashboard          ← 기존. "오늘 뜨는 지역" 위젯 신규 추가 (섹션 4.2 US-2)
├── /dashboard/images   ← 기존. "이 영화의 배경으로 여행하기" CTA 버튼 추가
├── /cine-trip          ← [신규] CineTrip 메인 페이지
│   └── /cine-trip?areaCode=... / ?movieName=...
├── /dvd-stores         ← 기존. 히트맵 레이어 / 괴리 지역 토글 추가
├── /admin              ← 기존. "문화×관광 인사이트" 탭 추가
└── /support, /account, /signup, /login 등 (변경 없음)
```

네비게이션(`components/NavBar.js`) 에 `CineTrip` 항목 추가. 모바일(Capacitor) 하단 탭에도 1칸 추가.

---

## 6. 데이터 설계

### 6.1 신규 엔티티

```
TOUR_INDEX_SNAPSHOTS
 ─ id (PK, BIGINT)
 ─ area_code VARCHAR(20)       -- 지자체 코드
 ─ region_name VARCHAR(100)
 ─ snapshot_date DATE
 ─ tour_demand_idx DECIMAL(6,2)
 ─ tour_competitiveness DECIMAL(6,2)
 ─ cultural_resource_demand DECIMAL(6,2)
 ─ tour_service_demand DECIMAL(6,2)
 ─ tour_resource_demand DECIMAL(6,2)
 ─ search_volume INT
 ─ created_at / modified_at
 UNIQUE(area_code, snapshot_date)
 INDEX (snapshot_date, area_code)

MOVIE_REGION_MAPPINGS
 ─ id (PK)
 ─ movie_name VARCHAR(255)     -- FK to movies.movie_name
 ─ area_code VARCHAR(20)
 ─ region_name VARCHAR(100)
 ─ mapping_type ENUM('SHOT','BACKGROUND','THEME')
 ─ evidence VARCHAR(500)
 ─ confidence TINYINT          -- 1~5
 ─ trending_score DECIMAL(6,2) -- 배치가 갱신
 ─ created_at / modified_at
 INDEX (area_code), INDEX (movie_name)

TRENDING_REGIONS_CACHE
 ─ area_code (PK)
 ─ period ENUM('today','week','month')
 ─ rank TINYINT
 ─ score DECIMAL(6,2)
 ─ computed_at DATETIME
```

### 6.2 기존 테이블 활용

- `DVD_STORES.area_code`: 이미 존재 → **지자체 코드 표준화 매핑 테이블**(`area_code_map`) 1회성 정리 필요 (DVD매장 코드 ↔ 관광공사 지자체 코드 정합성 검증).
- `MOVIES.movie_name` ↔ `MOVIE_REGION_MAPPINGS.movie_name` 매칭.

### 6.3 마이그레이션

- Flyway V{next}\_\_tour_index_and_mapping.sql 1개 추가.

---

## 7. API 명세 (요약)

### 7.1 공개 GET

| Method | Path                                         | 목적                                          |
| ------ | -------------------------------------------- | --------------------------------------------- |
| GET    | `/api/v1/tour/regions`                       | 모든 지자체 최신 스냅샷 (히트맵용, 경량 응답) |
| GET    | `/api/v1/tour/region/{areaCode}`             | 단일 지자체 상세 + 30/90일 시계열             |
| GET    | `/api/v1/tour/trending?period=today&limit=3` | 검색량 급등 Top N                             |
| GET    | `/api/v1/cinetrip/region/{areaCode}`         | 지역 큐레이션 뷰 (지역 + 영화 + 매장)         |
| GET    | `/api/v1/cinetrip/movie/{movieName}/regions` | 영화 → 지역 역매핑                            |
| GET    | `/api/v1/cinetrip/trending?period=today`     | US-2 홈 위젯용                                |
| GET    | `/api/v1/dvd-stores/stats/by-region`         | 지자체별 매장 통계                            |

### 7.2 확장 (기존 수정)

| Method | Path                             | 변경                                     |
| ------ | -------------------------------- | ---------------------------------------- |
| GET    | `/api/v1/movie/recommend/prompt` | `?mode=travel` 추가 시 Tour context 주입 |

### 7.3 관리자 (인증 필요)

| Method | Path                                         | 목적                 |
| ------ | -------------------------------------------- | -------------------- |
| GET    | `/api/v1/admin/insights/culture-vs-tour`     | 산점도/시계열 데이터 |
| GET    | `/api/v1/admin/insights/culture-vs-tour.csv` | CSV 다운로드         |

응답 포맷은 기존 `ApiResponse<T>` (`{ success, data, ... }`) 규약을 따른다.

---

## 8. 비기능 요구사항

| 항목       | 요구                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| 성능       | `/api/v1/tour/regions` p95 < 300ms (Redis 캐시)                                |
| 성능       | `/cine-trip` 페이지 LCP < 2.5s (모바일 4G)                                     |
| 가용성     | 관광공사 API 장애 시 **마지막 스냅샷 fallback** (배치 결과 유지)               |
| 보안       | `VISITKOREA_SERVICE_KEY` 는 서버 환경변수, 절대 프론트 노출 금지               |
| 레이트리밋 | API 호출은 배치(일 1회)가 주 경로. 프론트 직접 호출은 자체 엔드포인트 경유     |
| i18n       | 모든 신규 문구는 `ko.json`/`en.json` 에 키 추가 (`cinetrip.*`, `cultureMap.*`) |
| 접근성     | 히트맵 색상은 색약 친화 팔레트(ColorBrewer OrRd/Purples)                       |
| 모바일     | Capacitor iOS/Android 동일 동작, 네이티브 지도 fallback 불필요(Leaflet 유지)   |
| 로깅       | 신규 엔드포인트는 기존 `UserAuditHistoryService` 로그 정책 준수                |

---

## 9. 분석 / 이벤트 트래킹

| 이벤트                    | 트리거              | 속성                                       |
| ------------------------- | ------------------- | ------------------------------------------ |
| `cinetrip_view`           | `/cine-trip` 진입   | source(direct/nav/movie-detail), areaCode? |
| `cinetrip_region_select`  | 지역 선택           | areaCode, source                           |
| `cinetrip_movie_click`    | 큐레이션 영화 클릭  | areaCode, movieName                        |
| `trending_region_click`   | 홈 "오늘 뜨는 지역" | areaCode, rank                             |
| `culturemap_layer_toggle` | 레이어 스위치       | layer, enabled                             |
| `ai_travel_mode_submit`   | 여행 모드 프롬프트  | hasRegion, regionCount                     |

기존 트래킹 파이프(`showBanner` / `getTrackingStatus` 쪽) 와 별개로, 서버 측 audit log 중심.

---

## 10. 릴리스 플랜

> **진행 현황 요약 (2026-04-21 기준)** — Phase 0~3 전량 완료, Phase 4(배치 4종: Sync/Trending/CineTripScore/AutoTag) 완료, D-day 마일스톤 E2E 스모크·데모 가이드·Playwright UI 회귀 완료, **Phase 5 LLM 기반 촬영지 자동 태깅까지 완료**.
> 남은 선택 과제는 ①관광공사·OpenAI 키 운영 이식·모니터링, ②`trending_regions_cache.score` 외부 노출.

### Phase 0 — 기반 (Week 1) ✅

- [x] 관광공사 API `adapter-http` 클라이언트 + DTO (`VisitKoreaDataLabAdapter`)
- [x] Flyway 마이그레이션 (`V33` tour_index + mapping + cache, `V34/V35/V37` 컬럼 타입 보정)
- [x] `SyncTourIndexBatch` 기본 잡 + Redis 캐시 (`tourIndex:latestPerRegion`, `tourIndex:topSearchVolume`)

### Phase 1 — 문화지도 (Week 2) ✅ ← **공모전 데모 1**

- [x] `/api/v1/tour/regions`, `/api/v1/dvd-stores/stats/by-region`
- [x] `/dashboard` 히트맵 레이어(`CultureMapLayer.js`) + 괴리 지역 토글
- [x] i18n 문구 추가 (`cultureMap.*`)

### Phase 2 — CineTrip (Week 3) ✅ ← **공모전 데모 2 (메인)**

- [x] `movie_region_mappings` 시드 CSV — **106편 / 17개 광역지자체 전 커버** (`cine-trip-seed.csv`, `V36` reset 마이그레이션)
- [x] `/cine-trip` 페이지 + `CineTripCTA` (영화 상세) + 카카오톡 공유
- [x] 홈 "오늘 뜨는 지역" 위젯 (`TrendingRegionsWidget.js`) + **period 토글(오늘/이번주/이번달)**
- [x] AI 추천 "여행 모드" 토글 (`PromptRecommendService` travelMode 분기, `regionContext` 응답 필드)

### Phase 3 — 관리자 & 공유 (Week 4) ✅

- [x] 관리자 "문화×관광 인사이트" 탭 (`/admin#insights`) + CSV 다운로드
- [x] `GET /api/v1/admin/insights/culture-vs-tour(.csv)` — `CultureVsTourRow` 도메인
- [x] 카카오톡 공유 (`shareUtils.js`) — Kakao SDK → Web Share → 클립보드 fallback
- [x] i18n 키 정리 (`cineTrip.*`, `admin.insights.*`, `trendingRegions.period.*`)

### Phase 4 — 배치 자동화 (Week 5) ✅

- [x] `SyncTourIndexBatch` — 매일 03:30 KST (기존)
- [x] `ComputeTrendingRegionsBatch` — 매일 04:00 KST, today/week/month 3 period 캐시 재계산 (`trending_regions_cache`)
- [x] `RecomputeCineTripScoreBatch` — 매일 04:30 KST, `MovieRegionMapping.trending_score` 재계산
- [x] 수동 트리거 REST 엔드포인트 3종 (`POST /batch/tour/{sync,trending}`, `/batch/cine-trip/score`)
- [x] `/api/v1/tour/trending-regions?period=today|week|month` 캐시 우선 + 검색량 Top-N fallback

### 마일스톤 — 공모전 제출일 D-day ✅

- [x] E2E 스모크 테스트 — `scripts/smoke.ps1` (Windows) + `scripts/smoke.sh` (Unix), 10+3 엔드포인트 커버
- [x] 데모 영상 가이드 — `DEMO_GUIDE.md` 6분 시나리오(7 씬, 나레이션 원고 포함)
- [x] CI 자동화 — `.github/workflows/ci.yml` (PR 컴파일+테스트), `smoke-remote.yml` (수동 + nightly 22:00 UTC)
- [ ] App Store / Play Store 업데이트 (선택)
- [ ] Playwright UI 회귀 (period 탭 전환 · CineTrip 카드 렌더) — Post-launch

### Phase 5 (Post-launch, Optional)

- [ ] 관광공사·OpenAI 키를 **운영(Heroku Config Vars)에 이식** + 쿼터 사용량 모니터링 (Sentry 알림 / Datadog metric)
  - 키 자체는 `.env` 의 값을 그대로 사용 (교체 없음)
  - 관광공사 일일 호출 제한 1,000회 초과 시 알림
- [x] **LLM 기반 촬영지 자동 태깅** (룰 + gpt-4o-mini 2단계, 2026-04-21 완료)
  - 설계 변경: TMDB keywords 호출 없이 DB 에 이미 적재된 `overview/genre/productionCountries/cast/director` 만 사용 → rate-limit/비용 절감
  - **1차 룰 매칭**: `RegionKeywordDictionary`(17개 광역 지자체 한·영·로마자 키워드) → confidence=4, source=RULE
  - **2차 LLM 분류**: 룰 0건 + 한국영화(`productionCountries=Korea` 또는 `originalLanguage=ko`) 에 한해 gpt-4o-mini `response_format=json_object` 호출
    - area_code 화이트리스트(1~8,31~39) + mapping_type 화이트리스트(SHOT|BACKGROUND|THEME) 검증
    - temperature=0, 영화당 최대 3개 매핑
  - **자동 승인 vs 큐잉**: confidence ≥ 3 → `movie_region_mappings` 즉시 upsert / confidence ≤ 2 → `pending_mapping_reviews` 큐잉
  - **관리자 승인 UI**: `/admin` → "AI 매핑 승인" 탭(주황 배지 + 대기건수), 승인 시 `movie_region_mappings` 반영 / 반려 시 상태만 전환
  - **배치 파이프라인**: `AutoTagCineTripMappingBatch` — 매일 **05:00 KST** (RecomputeCineTripScoreBatch 04:30 이후 → 다음 주기에 trending_score 자동 충전)
  - 주요 파일:
    - DB: `flyway/V38__create_pending_mapping_reviews.sql`
    - 도메인: `MovieRegionSuggestion`, `PendingMappingReview`
    - 포트: `LlmMappingPort`, `PendingMappingReviewPort`
    - 서비스: `AutoTagCineTripMappingService`, `ReviewPendingMappingService`, `RegionKeywordDictionary`
    - 어댑터: `OpenAiMappingAdapter` (adapter-http), `PendingMappingReviewRepository` (adapter-persistence), `PendingMappingReviewEntity`
    - 배치: `AutoTagCineTripMappingBatch` (app-batch, `POST /batch/cine-trip/auto-tag`) + **app-api `BatchController` `POST /api/v1/batch/cine-trip/auto-tag`** (Heroku web dyno 에서도 수동 트리거 가능)
    - API: `GET /api/v1/admin/cine-trip/pending-mappings`, `POST .../{id}/approve`, `POST .../{id}/reject`
    - 프론트: `app/admin/page.js` `PendingMappingsPanel`, i18n `admin.aiMappingReview.*`
    - 테스트: `AutoTagCineTripMappingServiceTest` 4 케이스 (룰 자동승인 / LLM 저신뢰도 큐잉 / 이미 매핑된 영화 스킵 / LLM 고신뢰도 자동승인)
  - **Heroku 배포 후 검증 절차**:
    1. 환경변수는 Heroku Config Vars 에 이미 세팅돼 있음 (`OPENAI_API_KEY`, `VISITKOREA_SERVICE_KEY`, `JAWSDB_MARIA_URL`, …) — 로컬 실행 불필요
    2. 배포 후 자동 실행: 매일 05:00 KST 스케줄러가 `app-batch` 에서 `AutoTagCineTripMappingBatch` 실행 (또는 worker dyno / Heroku Scheduler 구성 시)
    3. **즉시 검증하려면** 관리자 토큰으로 `POST https://<heroku-app>/api/v1/batch/cine-trip/auto-tag` 호출 → 비동기 시작
    4. 진행 로그: `heroku logs --tail --source app --dyno web` 에서 `[AUTOTAG-MANUAL]` 확인
    5. 결과 확인: `/admin` 로그인 → **AI 매핑 승인** 탭 (주황 배지에 대기 건수 표시)
- [ ] `trending_regions_cache.score` 필드를 `TourResponse` 에 노출 (현재는 period 인식만 사용, 점수는 내부)

---

## 11. 리스크 & 대응

| 리스크                                                   | 영향             | 대응                                                                 |
| -------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| 관광공사 API 지자체 코드가 DVD 매장 `areaCode` 와 불일치 | 히트맵/조인 실패 | Phase 0 에서 `area_code_map` 정합성 점검 배치 선행                   |
| 영화-지역 매핑 큐레이션 비용                             | 콘텐츠 퀄리티    | MVP는 100편 수작업 → Phase 4 에서 TMDB keywords + LLM 자동 분류 확장 |
| 관광공사 API rate limit / 다운                           | CineTrip 빈 상태 | 배치 스냅샷 fallback + "데이터 최신화 지연" 안내                     |
| 히트맵 성능 (지자체 ~250개)                              | LCP 저하         | GeoJSON 단순화(topojson) + choropleth 서버 사전계산                  |
| AI "여행 모드" 토큰 비용 증가                            | OpenAI 비용      | 지역 컨텍스트는 **상위 10개 지자체만** 주입 / 세션 캐시 재사용       |
| 공모전 일정 촉박                                         | 제출 지연        | Phase 1 + 2 만으로도 제출 가능하도록 Phase 3 를 Optional 배치        |

---

## 12. 의존성 & 가정

- `VISITKOREA_SERVICE_KEY` 발급 완료 (✅ 사용자 승인받음)
  0329ad0b39ea7e3db929d34ec79b4c253ece7ee0a751e17a2f80432a1907130d
- 지자체 GeoJSON: 공개 데이터(행정안전부 행정구역 경계) 사용, 상업 재배포 아님
- 촬영지 정보 출처는 **공개 뉴스/영화진흥위원회 촬영 정보** 기반 큐레이션 (저작권 이슈 없음)
- Leaflet, React-Leaflet, lucide-react 이미 프로젝트에 존재 → 신규 디펜던시 최소(leaflet.heat 정도)

---

## 13. 참고 자료

- 한국관광콘텐츠랩: https://api.visitkorea.or.kr/#/useUtilExercises
- 공공데이터포털(데이터랩): https://www.data.go.kr/data/15152138/openapi.do
- 기존 문서: `docs/RAG_AND_DATA_SOURCES.md`
- 관련 엔티티: `core-domain/dvdstore/DvdStore.java`, `MOVIES` 테이블

---

## 14. 오픈 이슈 (합의 필요)

1. **메뉴명**: 한글 "씨네트립" vs 영문 "CineTrip" — 기본은 `CineTrip`.
2. **지자체 단위**: 시도(17개) vs 시군구(~250개) — MVP는 **시군구 기본 + 시도 롤업 토글**.
3. **큐레이션 시드 100편 선정 기준**: "최근 5년 한국영화 흥행 Top 50 + DVD 인기 50" 제안.
4. **관리자 리포트 CSV 포맷**: UTF-8 BOM 유무 — 엑셀 호환 고려해 BOM 포함 제안.

피드백 주시면 v1.1 로 반영합니다.
