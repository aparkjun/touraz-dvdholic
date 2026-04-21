# =============================================================================
# E2E Smoke Test — CineTrip 공모전 데모 파이프라인 (Windows PowerShell)
#
# 사용법:
#   powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1 -ApiBase "http://localhost:8080" -BatchBase "http://localhost:8081"
#   powershell -ExecutionPolicy Bypass -File scripts\smoke.ps1 -RunBatches
#
# 검증 범위:
#   1) Health : API/Batch 서버 기동 확인
#   2) Tour   : 지자체 지표·트렌딩 지역 API (캐시 fallback 포함)
#   3) CineTrip : 큐레이션 목록 / 지역 필터 / 카운트
#   4) DVD Store: 지역 집계 (문화×관광 인사이트 원본)
#   5) Batch  : 수동 트리거 3종 (선택적 -RunBatches)
# =============================================================================
param(
    [string]$ApiBase   = "http://localhost:8080",
    [string]$BatchBase = "http://localhost:8081",
    [switch]$RunBatches
)

$ErrorActionPreference = "Continue"
$script:Passed = 0
$script:Failed = 0
$script:Results = @()

function Test-Endpoint {
    param(
        [string]$Label,
        [string]$Method = "GET",
        [string]$Url,
        [int]$ExpectStatus = 200,
        [string]$ExpectContains = $null,
        [switch]$AllowEmpty
    )
    Write-Host ""
    Write-Host "▶ $Label" -ForegroundColor Cyan
    Write-Host "  $Method $Url" -ForegroundColor DarkGray

    try {
        $resp = Invoke-WebRequest -Method $Method -Uri $Url -TimeoutSec 15 `
                -UseBasicParsing -ErrorAction Stop
        $status = [int]$resp.StatusCode
        $body   = $resp.Content

        $ok = ($status -eq $ExpectStatus)
        if ($ok -and $ExpectContains) {
            $ok = $body -like "*$ExpectContains*"
        }
        if ($ok -and -not $AllowEmpty -and [string]::IsNullOrWhiteSpace($body)) {
            $ok = $false
        }

        if ($ok) {
            Write-Host "  ✓ $status" -ForegroundColor Green
            $preview = if ($body.Length -gt 160) { $body.Substring(0,160) + "..." } else { $body }
            Write-Host "  $preview" -ForegroundColor DarkGray
            $script:Passed++
            $script:Results += [pscustomobject]@{ Label=$Label; Status="PASS"; Code=$status }
        } else {
            Write-Host "  ✗ status=$status (expected $ExpectStatus, contains=$ExpectContains)" -ForegroundColor Red
            $script:Failed++
            $script:Results += [pscustomobject]@{ Label=$Label; Status="FAIL"; Code=$status }
        }
    } catch {
        Write-Host "  ✗ 요청 실패: $($_.Exception.Message)" -ForegroundColor Red
        $script:Failed++
        $script:Results += [pscustomobject]@{ Label=$Label; Status="ERROR"; Code=0 }
    }
}

Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host " CineTrip E2E Smoke Test " -ForegroundColor Yellow
Write-Host "   API   : $ApiBase" -ForegroundColor Yellow
Write-Host "   Batch : $BatchBase" -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Yellow

# ---------- 0. Health ----------
Test-Endpoint -Label "API Health"   -Url "$ApiBase/actuator/health"   -ExpectContains "UP"
Test-Endpoint -Label "Batch Health" -Url "$BatchBase/actuator/health" -ExpectContains "UP"

# ---------- 1. Tour ----------
Test-Endpoint -Label "관광 지표 - 지자체별 최신 스냅샷" `
              -Url "$ApiBase/api/v1/tour/regions" `
              -AllowEmpty

Test-Endpoint -Label "트렌딩 지역 (검색량 Top-5, fallback 경로)" `
              -Url "$ApiBase/api/v1/tour/trending-regions?limit=5" `
              -AllowEmpty

Test-Endpoint -Label "트렌딩 지역 캐시 (period=today)" `
              -Url "$ApiBase/api/v1/tour/trending-regions?period=today&limit=5" `
              -AllowEmpty

Test-Endpoint -Label "트렌딩 지역 캐시 (period=week)" `
              -Url "$ApiBase/api/v1/tour/trending-regions?period=week&limit=5" `
              -AllowEmpty

# ---------- 2. CineTrip ----------
Test-Endpoint -Label "CineTrip 시드 카운트" `
              -Url "$ApiBase/api/v1/cine-trip/count"

Test-Endpoint -Label "CineTrip 큐레이션 (default mix, limit=5)" `
              -Url "$ApiBase/api/v1/cine-trip?limit=5"

Test-Endpoint -Label "CineTrip 지역 필터 (서울 areaCode=1)" `
              -Url "$ApiBase/api/v1/cine-trip/region/1" `
              -AllowEmpty

Test-Endpoint -Label "CineTrip 특정 영화 (영화명='기생충')" `
              -Url "$ApiBase/api/v1/cine-trip/movie?name=%EA%B8%B0%EC%83%9D%EC%B6%A9" `
              -AllowEmpty

# ---------- 3. DVD Store (문화×관광 원본) ----------
Test-Endpoint -Label "DVD 매장 지역 통계 (Admin 인사이트 원본)" `
              -Url "$ApiBase/api/v1/dvd-stores/stats/by-region" `
              -AllowEmpty

# ---------- 4. Batch 수동 트리거 (선택) ----------
if ($RunBatches) {
    Write-Host ""
    Write-Host "─── Batch 수동 실행 ───────────────────────────────────────" -ForegroundColor Yellow
    Test-Endpoint -Label "Batch: SyncTourIndexBatch"        -Method POST -Url "$BatchBase/batch/tour/sync"
    Start-Sleep -Seconds 2
    Test-Endpoint -Label "Batch: ComputeTrendingRegions"    -Method POST -Url "$BatchBase/batch/tour/trending"
    Start-Sleep -Seconds 2
    Test-Endpoint -Label "Batch: RecomputeCineTripScore"    -Method POST -Url "$BatchBase/batch/cine-trip/score"
} else {
    Write-Host ""
    Write-Host "ℹ Batch 수동 트리거를 실행하려면 -RunBatches 스위치를 붙이세요." -ForegroundColor DarkYellow
}

# ---------- 리포트 ----------
Write-Host ""
Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host " 결과 요약 : PASS=$script:Passed  FAIL=$script:Failed" -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Yellow
$script:Results | Format-Table -AutoSize

if ($script:Failed -gt 0) { exit 1 } else { exit 0 }
