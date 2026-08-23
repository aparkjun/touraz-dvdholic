# ?곹솕 ?섏씠吏 1000 ?뺤씤 ?ㅽ겕由쏀듃
# 1留뚰렪 = ?섏씠吏 0~999 (1000?섏씠吏), ?섏씠吏??10??
# 留덉?留??섏씠吏(999)媛 ?뺤긽 議고쉶?섎뒗吏 ?뺤씤

param(
    [string]$BaseUrl = "https://touraz-dvdholic-2194adc70fa6.herokuapp.com",
    [int]$LastPage = 999,
    [switch]$CheckImages
)

$ErrorActionPreference = "Stop"

function Test-MoviePage {
    param([int]$Page)
    $url = "$BaseUrl/api/v1/movie/playing/search?page=$Page"
    try {
        $res = Invoke-RestMethod -Uri $url -Method POST -ContentType "application/json" -Body "{}"
        return $res
    } catch {
        Write-Host "ERR: Page $Page - $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Test-PosterUrl {
    param([string]$PosterPath)
    if ([string]::IsNullOrEmpty($PosterPath)) { return $false }
    $url = "https://image.tmdb.org/t/p/w500$PosterPath"
    try {
        $r = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 5 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch {
        return $false
    }
}

Write-Host "=== ?곹솕 留덉?留??섏씠吏 ?뺤씤 ===" -ForegroundColor Cyan
Write-Host "URL: $BaseUrl"
Write-Host "?뺤씤???섏씠吏: $LastPage (0-based, 1000踰덉㎏ ?섏씠吏)`n"

# 1) 留덉?留??섏씠吏 議고쉶
Write-Host "[1] ?섏씠吏 $LastPage API ?몄텧..." -ForegroundColor Yellow
$data = Test-MoviePage -Page $LastPage
if (-not $data) {
    Write-Host "?ㅽ뙣: API ?묐떟 ?놁쓬" -ForegroundColor Red
    exit 1
}

if (-not $data.success) {
    Write-Host "?ㅽ뙣: success=false" -ForegroundColor Red
    Write-Host "  code: $($data.code), message: $($data.message)"
    exit 1
}

$movies = $data.data.movies
$hasNext = $data.data.hasNext
$page = $data.data.page

Write-Host "  success: $($data.success)"
Write-Host "  page: $page"
Write-Host "  hasNext: $hasNext"
Write-Host "  movies count: $($movies.Count)" -ForegroundColor $(if ($movies.Count -gt 0) { "Green" } else { "Red" })

if ($movies.Count -eq 0) {
    Write-Host "`n?ㅽ뙣: 留덉?留??섏씠吏???곹솕媛 ?놁뒿?덈떎." -ForegroundColor Red
    Write-Host "  -> ?곹솕媛 1留뚰렪 誘몃쭔?닿굅???섏씠吏 ?몃뜳?ㅺ? ?섎せ?섏뿀?????덉뒿?덈떎."
    exit 1
}

# 2) ?ъ뒪???대?吏 ?뺤씤 (?좏깮)
if ($CheckImages -and $movies.Count -gt 0) {
    Write-Host "`n[2] ?ъ뒪???대?吏 ?묎렐 ?뺤씤 (?쒕낯 1媛?..." -ForegroundColor Yellow
    $m = $movies[0]
    $posterPath = $m.posterPath
    $ok = Test-PosterUrl -PosterPath $posterPath
    if ($ok) {
        Write-Host "  OK: $($m.movieName) - poster ?뺤긽" -ForegroundColor Green
    } else {
        Write-Host "  WARN: $($m.movieName) - poster ?묎렐 ?ㅽ뙣 (path: $posterPath)" -ForegroundColor Yellow
    }
}

# 3) ?댁쟾 ?섏씠吏濡?hasNext ?뺤씤 (999硫?hasNext=false ?ъ빞 ??
Write-Host "`n[3] hasNext 寃利?.." -ForegroundColor Yellow
if ($page -eq $LastPage -and $hasNext -eq $true) {
    Write-Host "  WARN: 留덉?留??섏씠吏?몃뜲 hasNext=true (?ㅼ쓬 ?섏씠吏媛 ???덉쓣 ???덉쓬)" -ForegroundColor Yellow
} elseif ($page -eq $LastPage -and $hasNext -eq $false) {
    Write-Host "  OK: 留덉?留??섏씠吏, hasNext=false" -ForegroundColor Green
}

Write-Host "`n=== 寃곌낵: ?섏씠吏 $LastPage ?뺤긽 議고쉶??(?곹솕 $($movies.Count)?? ===" -ForegroundColor Green
Write-Host "?곹솕 ??뿉???섏씠吏 1000(1-based) ?먮뒗 ?섏씠吏 ?몃뜳??999(0-based)媛 ?쒖떆?⑸땲??"
