# DVD ?섏씠吏 1000 ?뺤씤 ?ㅽ겕由쏀듃
# 1留뚰렪 = ?섏씠吏 0~999 (1000?섏씠吏), ?섏씠吏??10??

param(
    [string]$BaseUrl = "https://touraz-dvdholic-2194adc70fa6.herokuapp.com",
    [int]$LastPage = 999,
    [switch]$CheckImages
)

$ErrorActionPreference = "Stop"

$url = "$BaseUrl/api/v1/movie/search?page=$LastPage"
Write-Host "=== DVD 留덉?留??섏씠吏 ?뺤씤 ===" -ForegroundColor Cyan
Write-Host "URL: $url`n"

try {
    $data = Invoke-RestMethod -Uri $url -Method POST -ContentType "application/json" -Body "{}"
    $movies = $data.data.movies
    Write-Host "page: $($data.data.page), hasNext: $($data.data.hasNext), count: $($movies.Count)" -ForegroundColor $(if ($movies.Count -gt 0) { "Green" } else { "Red" })
    if ($movies.Count -gt 0) {
        Write-Host "OK: ?섏씠吏 $LastPage ?뺤긽 (DVD $($movies.Count)??" -ForegroundColor Green
    } else {
        Write-Host "?ㅽ뙣: 留덉?留??섏씠吏??DVD ?놁쓬" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
