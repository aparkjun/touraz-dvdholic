#!/usr/bin/env bash
# =============================================================================
# E2E Smoke Test — CineTrip 공모전 데모 파이프라인 (bash, macOS/Linux/Git-Bash)
#
# 사용법:
#   ./scripts/smoke.sh
#   API_BASE=http://localhost:8080 BATCH_BASE=http://localhost:8081 ./scripts/smoke.sh
#   RUN_BATCHES=1 ./scripts/smoke.sh
# =============================================================================
set -u

API_BASE="${API_BASE:-http://localhost:8080}"
BATCH_BASE="${BATCH_BASE:-http://localhost:8081}"
RUN_BATCHES="${RUN_BATCHES:-0}"

PASS=0
FAIL=0

# ANSI colors (터미널이면)
if [ -t 1 ]; then
    C_CYAN="\033[36m"; C_GREEN="\033[32m"; C_RED="\033[31m"
    C_YEL="\033[33m"; C_GRAY="\033[90m"; C_RST="\033[0m"
else
    C_CYAN=""; C_GREEN=""; C_RED=""; C_YEL=""; C_GRAY=""; C_RST=""
fi

check() {
    local label="$1"
    local method="$2"
    local url="$3"
    local expect_status="${4:-200}"
    local expect_contains="${5:-}"

    echo ""
    echo -e "${C_CYAN}▶ ${label}${C_RST}"
    echo -e "${C_GRAY}  ${method} ${url}${C_RST}"

    local tmp http_status body
    tmp=$(mktemp)
    http_status=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" --max-time 15 "$url" || echo "000")
    body=$(cat "$tmp" 2>/dev/null || echo "")
    rm -f "$tmp"

    local ok=1
    if [ "$http_status" != "$expect_status" ]; then ok=0; fi
    if [ -n "$expect_contains" ] && ! printf '%s' "$body" | grep -q -- "$expect_contains"; then ok=0; fi

    if [ "$ok" = "1" ]; then
        echo -e "${C_GREEN}  ✓ ${http_status}${C_RST}"
        echo -e "${C_GRAY}  $(printf '%s' "$body" | head -c 160)${C_RST}"
        PASS=$((PASS+1))
    else
        echo -e "${C_RED}  ✗ status=${http_status} (expected ${expect_status}, contains='${expect_contains}')${C_RST}"
        echo -e "${C_GRAY}  $(printf '%s' "$body" | head -c 200)${C_RST}"
        FAIL=$((FAIL+1))
    fi
}

echo -e "${C_YEL}=============================================================${C_RST}"
echo -e "${C_YEL} CineTrip E2E Smoke Test ${C_RST}"
echo -e "${C_YEL}   API   : ${API_BASE} ${C_RST}"
echo -e "${C_YEL}   Batch : ${BATCH_BASE} ${C_RST}"
echo -e "${C_YEL}=============================================================${C_RST}"

# 0. Health
check "API Health"   GET "${API_BASE}/actuator/health"   200 "UP"
check "Batch Health" GET "${BATCH_BASE}/actuator/health" 200 "UP"

# 1. Tour
check "관광 지표 - 지자체별 최신 스냅샷"                GET "${API_BASE}/api/v1/tour/regions"
check "트렌딩 지역 (검색량 Top-5, fallback)"             GET "${API_BASE}/api/v1/tour/trending-regions?limit=5"
check "트렌딩 지역 캐시 (period=today)"                   GET "${API_BASE}/api/v1/tour/trending-regions?period=today&limit=5"
check "트렌딩 지역 캐시 (period=week)"                    GET "${API_BASE}/api/v1/tour/trending-regions?period=week&limit=5"

# 2. CineTrip
check "CineTrip 시드 카운트"                              GET "${API_BASE}/api/v1/cine-trip/count"
check "CineTrip 큐레이션 (default mix, limit=5)"          GET "${API_BASE}/api/v1/cine-trip?limit=5"
check "CineTrip 지역 필터 (서울 areaCode=1)"              GET "${API_BASE}/api/v1/cine-trip/region/1"
check "CineTrip 특정 영화 (영화명='기생충')"              GET "${API_BASE}/api/v1/cine-trip/movie?name=%EA%B8%B0%EC%83%9D%EC%B6%A9"

# 3. DVD Store (문화×관광 원본)
check "DVD 매장 지역 통계"                                GET "${API_BASE}/api/v1/dvd-stores/stats/by-region"

# 4. Batch 수동 트리거
if [ "$RUN_BATCHES" = "1" ]; then
    echo ""
    echo -e "${C_YEL}─── Batch 수동 실행 ───────────────────────────────────────${C_RST}"
    check "Batch: SyncTourIndexBatch"       POST "${BATCH_BASE}/batch/tour/sync"
    sleep 2
    check "Batch: ComputeTrendingRegions"   POST "${BATCH_BASE}/batch/tour/trending"
    sleep 2
    check "Batch: RecomputeCineTripScore"   POST "${BATCH_BASE}/batch/cine-trip/score"
else
    echo ""
    echo -e "${C_YEL}ℹ Batch 수동 트리거를 실행하려면 RUN_BATCHES=1 를 붙이세요.${C_RST}"
fi

echo ""
echo -e "${C_YEL}=============================================================${C_RST}"
echo -e "${C_YEL} 결과 요약 : PASS=${PASS} FAIL=${FAIL} ${C_RST}"
echo -e "${C_YEL}=============================================================${C_RST}"

if [ "$FAIL" -gt 0 ]; then exit 1; else exit 0; fi
