$base = "https://touraz-dvdholic-2194adc70fa6.herokuapp.com"
$tests = @(
    @{ Label = "CineTrip count";             Url = "$base/api/v1/cine-trip/count" },
    @{ Label = "CineTrip mix (limit=5)";     Url = "$base/api/v1/cine-trip?limit=5" },
    @{ Label = "CineTrip 지역(서울=1)";       Url = "$base/api/v1/cine-trip/region/1" },
    @{ Label = "CineTrip 지역(부산=6)";       Url = "$base/api/v1/cine-trip/region/6" },
    @{ Label = "CineTrip 영화(기생충)";       Url = "$base/api/v1/cine-trip/movie?name=%EA%B8%B0%EC%83%9D%EC%B6%A9" },
    @{ Label = "Tour regions";               Url = "$base/api/v1/tour/regions" },
    @{ Label = "Trending (검색량 Top5)";      Url = "$base/api/v1/tour/trending-regions?limit=5" },
    @{ Label = "Trending period=today";      Url = ("$base/api/v1/tour/trending-regions?period=today" + [char]38 + "limit=5") },
    @{ Label = "Trending period=week";       Url = ("$base/api/v1/tour/trending-regions?period=week"  + [char]38 + "limit=5") },
    @{ Label = "Trending period=month";      Url = ("$base/api/v1/tour/trending-regions?period=month" + [char]38 + "limit=5") },
    @{ Label = "DVD 매장 지역 통계";          Url = "$base/api/v1/dvd-stores/stats/by-region" },
    @{ Label = "영화 카탈로그 첫 페이지";      Url = "$base/api/v1/movie?page=1" },
    @{ Label = "영화 상세(기생충)";           Url = "$base/api/v1/movie/%EA%B8%B0%EC%83%9D%EC%B6%A9" }
)

$pass = 0; $fail = 0; $rows = @()
foreach ($t in $tests) {
    Write-Host ""
    Write-Host ("▶ " + $t.Label) -ForegroundColor Cyan
    Write-Host ("  GET " + $t.Url) -ForegroundColor DarkGray
    try {
        $r = Invoke-WebRequest -Uri $t.Url -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        $code = [int]$r.StatusCode
        $body = $r.Content
        $ok = ($code -eq 200) -and (-not [string]::IsNullOrWhiteSpace($body))
        if ($ok) {
            Write-Host ("  ✓ " + $code) -ForegroundColor Green
            $prev = if ($body.Length -gt 180) { $body.Substring(0,180) + "..." } else { $body }
            Write-Host ("  " + $prev) -ForegroundColor DarkGray
            $pass++
            $rows += [pscustomobject]@{ Label = $t.Label; Status = "PASS"; Code = $code }
        } else {
            Write-Host ("  ✗ 빈 응답 또는 잘못된 status=" + $code) -ForegroundColor Red
            $fail++
            $rows += [pscustomobject]@{ Label = $t.Label; Status = "FAIL"; Code = $code }
        }
    } catch {
        Write-Host ("  ✗ ERROR: " + $_.Exception.Message) -ForegroundColor Red
        $fail++
        $rows += [pscustomobject]@{ Label = $t.Label; Status = "ERROR"; Code = 0 }
    }
}

Write-Host ""
Write-Host "=============================================================" -ForegroundColor Yellow
Write-Host (" 결과 요약 : PASS=" + $pass + "  FAIL=" + $fail) -ForegroundColor Yellow
Write-Host "=============================================================" -ForegroundColor Yellow
$rows | Format-Table -AutoSize
