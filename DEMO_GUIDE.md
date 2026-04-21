# CineTrip 공모전 데모 가이드

> **"영화·DVD 문화 수요와 지역 관광 지수를 결합해, 쇠퇴 지역의 방문 수요를 공공데이터로 되살리는 서비스"**
>
> 본 문서는 5–8 분 분량의 데모 영상을 **한 번에 촬영**할 수 있도록 화면 순서·나레이션·API 호출·배치·확인 체크리스트를 시간순으로 정리한 촬영용 스크립트입니다.

---

## 1. 사전 준비 (촬영 전 반드시)

| 항목 | 확인 |
| --- | --- |
| `.env` 에 `OPENAI_API_KEY`, `KAKAO_*`, `VISITKOREA_*` 설정 | ✅ |
| MySQL/Redis 기동 (`docker compose up -d` in `infra/`) | ✅ |
| `app-api` : `gradlew :netplix-apps:app-api:bootRun --args="--spring.profiles.active=local"` (8080) | ✅ |
| `app-batch` : `gradlew :netplix-apps:app-batch:bootRun` (8081) | ✅ |
| `netplix-frontend` : `npm run dev` (3000) | ✅ |
| 브라우저 배율 100 %, 창 1920×1080, 다크모드 OFF | ✅ |
| 녹화 툴: OBS 또는 ShareX, 오디오 48 kHz, 마이크 레벨 −6 dB | ✅ |
| 사전 실행 스모크: `powershell -File scripts\smoke.ps1` → PASS 10/10 확인 | ✅ |

> ℹ 스모크가 FAIL 이면 촬영하지 말고 로그부터 봅니다. `app-api` 터미널에서 Flyway · RAG loader 에러 스택을 먼저 제거.

---

## 2. 전체 타임라인 (권장 6:00)

| 구간 | 시간 | 화면 | 핵심 멘트 |
| --- | --- | --- | --- |
| 오프닝 | 0:00 – 0:30 | 제목 카드 | 문제 제기 — "쇠퇴 지자체 × 청년 오프라인 문화소비 재발견" |
| 문화 지도 | 0:30 – 1:30 | `/dashboard` Culture Map | 공공 DVD 매장 밀도 + 관광 지수 히트맵 |
| CineTrip | 1:30 – 3:00 | `/cine-trip` | 영화→지역 여행 코스 큐레이션 |
| 영화 상세 CTA | 3:00 – 3:30 | `/dashboard/images` | 영화 → 실제 촬영지 여행 전환 |
| AI 여행 모드 | 3:30 – 4:30 | `/dashboard` 프롬프트 입력 | 지역 컨텍스트 기반 추천 |
| 관리자 인사이트 | 4:30 – 5:30 | `/admin` 인사이트 탭 | 문화 × 관광 매트릭스 + CSV |
| 배치 & 공유 | 5:30 – 6:00 | 터미널 로그 + 공유 모달 | 일일 배치 3종 + 카카오톡 공유 |

---

## 3. 장면별 촬영 스크립트

### 🎬 Scene 1. 오프닝 — 문제 제기 (0:00 – 0:30)

**화면**: 제목 카드 ("Netplix CineTrip — 공공 문화·관광 데이터로 지역을 되살리다")

**나레이션 (30초)**
> "전국에 3,000개가 넘는 DVD 매장 중 2/3가 이미 사라졌습니다. 동시에 많은 지자체는 방문객 감소로 고민하고 있습니다.
> 저희는 한국관광공사 데이터랩과 문체부 DVD 매장 데이터를 결합해, **영화라는 문화 콘텐츠로 지역 재방문 수요를 만드는** 서비스를 만들었습니다."

---

### 🎬 Scene 2. 문화 지도 (0:30 – 1:30)

**URL**: `http://localhost:3000/dashboard`

**행동**
1. 페이지 로드 직후 상단 `Trending Regions Widget` 을 가리킨다.
2. 아래 Leaflet 지도에서 서울·부산·제주에 마커 호버 → tooltip 숫자 노출.
3. 좌측 범례(문화자원 수요 vs 매장 밀도)를 커서로 슥 훑기.

**나레이션**
> "여기는 DVD 매장 데이터와 관광공사 지수를 실시간으로 겹쳐 보는 문화 지도입니다.
> 색이 진할수록 **문화 콘텐츠 수요는 있는데 오프라인 매장이 없는** 지역입니다."

**확인할 API (백그라운드)**
- `GET /api/v1/dvd-stores/stats/by-region`
- `GET /api/v1/tour/regions`
- `GET /api/v1/tour/trending-regions?limit=10`

---

### 🎬 Scene 3. CineTrip — 영화로 떠나는 여행 (1:30 – 3:00)

**URL**: `http://localhost:3000/cine-trip`

**행동**
1. 상단 지역 칩에서 **"서울"** 클릭 → 카드 5-6장 리렌더.
2. `기생충` 카드 강조 — "SHOT", "성북구 자하문로 실촬영" 태그.
3. `"여행 코스 보기"` 버튼 클릭 전, **공유 버튼 한 번** 클릭 → Toast "링크가 복사되었습니다" 강조.
4. 지역 칩 **"제주"** 로 전환 → `건축학개론`, `지금 만나러 갑니다` 등 다른 큐레이션.

**나레이션**
> "영화 106편을 17개 광역 지자체에 매핑해두었습니다.
> 촬영지, 배경, 그리고 테마 3가지 관점으로 연결되고,
> 오른쪽 숫자 `trending score` 는 매일 새벽 배치가 관광 지수와 검색량으로 재계산합니다."

**API**
- `GET /api/v1/cine-trip?limit=20`
- `GET /api/v1/cine-trip/region/1` (서울), `/region/39` (제주)

---

### 🎬 Scene 4. 영화 상세 → 여행 CTA (3:00 – 3:30)

**URL**: `http://localhost:3000/dashboard/images` (또는 대시보드에서 영화 카드 클릭)

**행동**
1. 영화 상세 포스터 아래 **"이 영화로 떠나는 여행"** CineTripCTA 박스 노출.
2. 지역 배지 + `Travel with this film` 버튼 클릭 → `/cine-trip?movie=...` 로 이동.
3. 공유 아이콘 클릭 → 카카오 피드 시뮬레이션 (KAKAO_JS_KEY 없으면 Web Share → 클립보드 fallback).

**나레이션**
> "영화를 보고 나서 자연스럽게 **'가보고 싶은 여행지'** 로 이어집니다.
> 카카오톡 공유도 붙여서 친구를 끌고 가게 만들었습니다."

---

### 🎬 Scene 5. AI 여행 모드 (3:30 – 4:30)

**URL**: `http://localhost:3000/dashboard`

**행동**
1. 페이지 하단 프롬프트 영역으로 스크롤.
2. **"AI 여행 모드"** 토글 ON.
3. 지역 드롭다운에서 `강원(areaCode=32)` 선택.
4. 프롬프트: `"가을에 혼자 보기 좋은 잔잔한 영화"` 입력 → `추천` 클릭.
5. 결과 카드에서 `추천 이유` + `지역 컨텍스트` 두 줄 다 읽기.

**나레이션**
> "AI 여행 모드를 켜면, 일반 추천과 달리 **해당 지역의 문화·관광 지수를 LLM 프롬프트 컨텍스트에 넣어** 보낼 영화를 골라줍니다.
> 강원처럼 문화 자원 점수가 낮은 지역도 '이 영화 한 편 보고 한번 가볼까' 수요를 만들 수 있습니다."

**API**
- `POST /api/v1/movie/recommend/prompt?travelMode=true&areaCode=32`

---

### 🎬 Scene 6. 관리자 인사이트 (4:30 – 5:30)

**URL**: `http://localhost:3000/admin` → 로그인 → 탭 **"문화 × 관광 인사이트"**

**행동**
1. 상단 KPI 카드 4개(총 매장·폐업률·평균 관광수요·평균 검색량)를 호버.
2. **Top 폐업률** 바 차트 → 쇠퇴 지역 Top 5 강조.
3. **Top 검색량** 바 차트로 옆에 병치.
4. 하단 테이블에서 `areaCode` 정렬 토글.
5. **`CSV 다운로드`** 버튼 클릭 → 엑셀에서 오픈 장면 삽입.

**나레이션**
> "지자체 공무원이 바로 쓸 수 있도록 **문화와 관광 데이터를 한 장의 매트릭스** 로 정렬했습니다.
> CSV 로 내려받아 내부 보고서에도 그대로 붙일 수 있습니다."

**API**
- `GET /api/v1/admin/insights/culture-vs-tour`
- `GET /api/v1/admin/insights/culture-vs-tour.csv`

---

### 🎬 Scene 7. 자동화 — 배치 3종 + 공유 (5:30 – 6:00)

**행동**
1. `app-batch` 터미널로 전환.
2. 아래 명령을 순서대로 실행하면서, 각 로그의 `BATCH 완료` 라인을 **강조 자막**으로 표시.

```powershell
curl -Method POST http://localhost:8081/batch/tour/sync
curl -Method POST http://localhost:8081/batch/tour/trending
curl -Method POST http://localhost:8081/batch/cine-trip/score
```

3. `/api/v1/tour/trending-regions?period=today&limit=5` 결과를 브라우저에서 새로고침 → 랭킹 변경 확인.

**나레이션 (클로징)**
> "03:30 KST 관광 지표 동기화, 04:00 KST 트렌딩 지역 재계산, 04:30 KST 영화 스코어 재계산 — **3종 일일 배치로 항상 최신 문화·관광 데이터**를 유지합니다.
> 공공데이터 × 문화 콘텐츠 × 지역 경제. 감사합니다."

---

## 4. 촬영 후 체크리스트

- [ ] **스모크 재실행**: `scripts/smoke.ps1 -RunBatches` → 12+/12 PASS
- [ ] **영상 시청 검토**: 포인터가 실제 API 호출 시점과 일치하는가
- [ ] **캡션 확인**: 한글 자막 — 1줄 16자 이하
- [ ] **PII**: 테스트 계정 이메일/토큰이 노출되지 않았는가
- [ ] **브랜딩**: 로고와 공모전 템플릿 오버레이
- [ ] **포맷**: MP4 H.264, 1080p, 5–8 분, 120 MB 이하

---

## 5. 자주 만나는 트러블 + 즉시 대응

| 증상 | 원인 | 대응 |
| --- | --- | --- |
| `trending-regions?period=today` 가 빈 배열 | 배치 미실행 | `POST /batch/tour/trending` 수동 실행 후 새로고침 |
| `/api/v1/cine-trip/count` = 0 | 시드 임포트 실패 | `app-api` 로그에서 `cine-trip-seed.csv` 파싱 에러 확인 |
| AI 여행 모드 응답에 `regionContext` null | `OPENAI_API_KEY` 미설정 | `.env` 확인 → `app-api` 재기동 |
| 카카오 공유가 즉시 클립보드로 빠짐 | `NEXT_PUBLIC_KAKAO_JS_KEY` 미설정 | 의도된 fallback. 데모에선 설명으로 넘어감 |
| Flyway V37 에러 | `trending_regions_cache` 기존 레코드 타입 충돌 | `TRUNCATE TABLE trending_regions_cache; FLUSH TABLES;` → 재기동 |
| `schema-validation: wrong column type` | Hibernate vs MySQL 타입 불일치 | 관련 V35/V37 마이그레이션이 적용됐는지 확인 |

---

## 6. 참고 — 데모 전용 시나리오 프리셋

아래 3개 프리셋을 미리 URL 북마크로 만들어두면 전환이 매끄럽습니다.

```
1. http://localhost:3000/cine-trip?area=1      # 서울
2. http://localhost:3000/cine-trip?area=39     # 제주
3. http://localhost:3000/admin#insights        # 관리자 인사이트 탭
```

**AI 여행 모드 프롬프트 예시**

| 지역 | 프롬프트 |
| --- | --- |
| 강원(32) | `가을에 혼자 보기 좋은 잔잔한 영화 추천해줘` |
| 경남(36) | `해안 로드무비 느낌의 한국 영화` |
| 전남(38) | `남도 음식과 사람 이야기가 담긴 따뜻한 영화` |

---

## 7. 스모크 스크립트 사용법

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1 -RunBatches
```

```bash
# macOS / Linux / Git-Bash
./scripts/smoke.sh
RUN_BATCHES=1 ./scripts/smoke.sh
API_BASE=http://dev.internal:8080 ./scripts/smoke.sh
```

실행 결과는 `PASS` / `FAIL` 컬러 요약으로 종료코드가 0/1 로 반환되므로 GitHub Actions 나 사내 Jenkins 에 그대로 물릴 수 있습니다.
