package fast.campus.netplix.visitkorea;

import fast.campus.netplix.camping.CampingSite;
import fast.campus.netplix.camping.CampingSitePort;
import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.util.ObjectMapperUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 한국관광공사 고캠핑(GoCamping) HTTP 어댑터.
 *
 * <p>PhotoGalleryService1 에서 학습한 교훈을 그대로 적용:
 * <ul>
 *   <li>RestTemplate 이중 인코딩 방지를 위해 {@link HttpClient#requestUri(URI, HttpMethod, HttpHeaders)} 사용</li>
 *   <li>items 가 빈 문자열("")로 내려오는 0건 응답을 JSON 파싱 전에 null 로 치환</li>
 *   <li>전체 목록은 1페이지 동기 + 백그라운드 풀 적재 (Heroku 30s 타임아웃 회피)</li>
 *   <li>serviceKey 미설정 / 403 / 비-JSON 응답 시 빈 리스트 반환 → UI 자연 숨김</li>
 * </ul>
 *
 * <p>캐시 정책:
 * <ul>
 *   <li>__ALL__ : 전국 전체 (24h TTL). 프리워밍 시도(실패해도 서비스 기동은 계속).</li>
 *   <li>키워드 : 키워드별 개별 캐시 (최대 64개, LRU 근사치)</li>
 *   <li>위치기반(lat,lng,radius): 캐시하지 않음. 매 호출 1페이지만 동기 조회 (키워드 공간 폭발 방지).</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GoCampingHttpClient implements CampingSitePort {

    private static final int MAX_PAGE_SIZE = 200;
    private static final String ALL_KEY = "__ALL__";
    private static final int MAX_KEYWORD_CACHE = 64;
    /** 전국 야영장 ~3,700개. 넉넉히 50 페이지(= 10,000개) 가드. */
    private static final int MAX_PAGES_ALL = 50;
    /** 키워드 검색은 일반적으로 작음. 20 페이지(= 4,000개) 가드. */
    private static final int MAX_PAGES_KEYWORD = 20;
    /** 위치기반은 단일 페이지로 충분. 반경 20km 면 수십 개 수준. */
    private static final int LOCATION_PAGE_ROWS = 100;

    private final HttpClient httpClient;

    @Value("${visitkorea.camping.api-key:}")
    private String serviceKey;

    @Value("${visitkorea.camping.based-url:https://apis.data.go.kr/B551011/GoCamping/basedList}")
    private String basedUrl;

    @Value("${visitkorea.camping.location-url:https://apis.data.go.kr/B551011/GoCamping/locationBasedList}")
    private String locationUrl;

    @Value("${visitkorea.camping.search-url:https://apis.data.go.kr/B551011/GoCamping/searchList}")
    private String searchUrl;

    @Value("${visitkorea.camping.cache-minutes:1440}")
    private long cacheMinutes;

    private final Map<String, CacheSnapshot> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && basedUrl != null && !basedUrl.isBlank();
    }

    @PostConstruct
    void prewarm() {
        if (!isConfigured()) {
            log.info("[CAMPING] serviceKey/URL 미설정 - 프리워밍 생략");
            return;
        }
        // 실제 네트워크 호출은 백그라운드에서 (서비스 기동 지연 방지)
        CompletableFuture.runAsync(() -> {
            try {
                refreshAll();
                log.info("[CAMPING] 프리워밍 완료 - {} 건 로드",
                        getSnapshot(ALL_KEY).sites.size());
            } catch (Exception ex) {
                log.warn("[CAMPING] 프리워밍 실패 (다음 호출에서 재시도): {}", ex.getMessage());
            }
        });
    }

    @Override
    public List<CampingSite> fetchAll(int limit) {
        if (!isConfigured()) return List.of();
        CacheSnapshot snap = cache.get(ALL_KEY);

        // 캐시 완전/신선 → 즉시 반환
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        // 캐시 없음: 1페이지만 동기 로드하고 나머지는 백그라운드에서 적재
        if (snap == null) {
            PageResult first = requestPage(basedUrl, Map.of(), 1);
            if (first == null) return List.of();
            List<CampingSite> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(ALL_KEY, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleAllRefresh();
            return take(partial, limit);
        }

        // partial 또는 stale → 현재 가진 것 반환 + 백그라운드 갱신
        scheduleAllRefresh();
        return take(snap.sites, limit);
    }

    @Override
    public List<CampingSite> fetchNearby(double latitude, double longitude, int radiusM, int limit) {
        if (!isConfigured()) return List.of();
        // KTO API 는 mapX=경도, mapY=위도, radius(m)
        Map<String, String> params = Map.of(
                "mapX", String.valueOf(longitude),
                "mapY", String.valueOf(latitude),
                "radius", String.valueOf(Math.max(1, radiusM))
        );
        // 위치기반은 보통 수십 건 이내이므로 단일 페이지면 충분.
        PageResult pr = requestPage(locationUrl, params, 1, LOCATION_PAGE_ROWS);
        if (pr == null) return List.of();
        // 호출자 좌표 기준 거리(km) 재계산 후 정렬.
        List<CampingSite> sorted = pr.items.stream()
                .map(s -> withDistance(s, latitude, longitude))
                .sorted((a, b) -> Double.compare(
                        a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                        b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()))
                .collect(Collectors.toList());
        return take(sorted, limit);
    }

    @Override
    public List<CampingSite> fetchByKeyword(String keyword, int limit) {
        if (!isConfigured()) return List.of();
        if (keyword == null || keyword.isBlank()) return fetchAll(limit);
        String key = keyword.trim().toLowerCase(Locale.ROOT);

        CacheSnapshot snap = cache.get(key);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(searchUrl, Map.of("keyword", keyword.trim()), 1);
            if (first == null) return List.of();
            List<CampingSite> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(key, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleKeywordRefresh(keyword.trim(), key);
            return take(partial, limit);
        }

        scheduleKeywordRefresh(keyword.trim(), key);
        return take(snap.sites, limit);
    }

    private void scheduleAllRefresh() {
        CompletableFuture.runAsync(() -> {
            try { refreshAll(); }
            catch (Exception ex) {
                log.warn("[CAMPING] 백그라운드 전체 갱신 실패: {}", ex.getMessage());
            }
        });
    }

    private void scheduleKeywordRefresh(String keyword, String cacheKey) {
        CompletableFuture.runAsync(() -> {
            try { refreshByKeyword(keyword, cacheKey); }
            catch (Exception ex) {
                log.warn("[CAMPING] 백그라운드 키워드 갱신 실패 keyword={} err={}",
                        keyword, ex.getMessage());
            }
        });
    }

    private synchronized void refreshAll() {
        List<CampingSite> sites = requestAllPages(basedUrl, Map.of(), MAX_PAGES_ALL);
        if (sites == null) {
            log.warn("[CAMPING] 전체 로드 실패 - 캐시 유지");
            return;
        }
        cache.put(ALL_KEY, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[CAMPING] 전체 캐시 갱신 - {} 건", sites.size());
    }

    private synchronized void refreshByKeyword(String keyword, String cacheKey) {
        List<CampingSite> sites = requestAllPages(searchUrl, Map.of("keyword", keyword), MAX_PAGES_KEYWORD);
        if (sites == null) {
            log.warn("[CAMPING] 키워드={} 로드 실패 - 캐시 저장 스킵", keyword);
            return;
        }
        if (cache.size() >= MAX_KEYWORD_CACHE) {
            cache.entrySet().stream()
                    .filter(e -> !e.getKey().equals(ALL_KEY))
                    .min((a, b) -> Long.compare(a.getValue().loadedAtEpochMs, b.getValue().loadedAtEpochMs))
                    .ifPresent(e -> cache.remove(e.getKey()));
        }
        cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[CAMPING] 키워드={} 캐시 갱신 - {} 건", keyword, sites.size());
    }

    /**
     * totalCount 기반으로 1..N 페이지를 순회 적재.
     * - 첫 페이지 실패면 null (호출자가 음성 캐시 저장 스킵)
     * - 중간 실패 시 지금까지 모은 것 반환 (부분 복구)
     */
    private List<CampingSite> requestAllPages(String baseUrl, Map<String, String> extraParams, int maxPages) {
        PageResult first = requestPage(baseUrl, extraParams, 1);
        if (first == null) return null;

        List<CampingSite> acc = new ArrayList<>(first.items);
        int totalCount = first.totalCount;
        if (totalCount <= first.items.size()) {
            return Collections.unmodifiableList(acc);
        }

        int totalPages = (int) Math.min(
                maxPages,
                (long) Math.ceil(totalCount / (double) MAX_PAGE_SIZE));

        for (int page = 2; page <= totalPages; page++) {
            PageResult pr = requestPage(baseUrl, extraParams, page);
            if (pr == null || pr.items.isEmpty()) {
                log.warn("[CAMPING] page={} 빈/실패 - 지금까지 {}건으로 마감", page, acc.size());
                break;
            }
            acc.addAll(pr.items);
        }
        log.info("[CAMPING] 페이지 순회 완료 - totalCount={} 로드={} (maxPages={})",
                totalCount, acc.size(), maxPages);
        return Collections.unmodifiableList(acc);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, int pageNo) {
        return requestPage(baseUrl, extraParams, pageNo, MAX_PAGE_SIZE);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, int pageNo, int rows) {
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json");
        sb.append("&MobileOS=ETC");
        sb.append("&MobileApp=touraz-dvdholic");
        sb.append("&numOfRows=").append(rows);
        sb.append("&pageNo=").append(pageNo);
        extraParams.forEach((k, v) -> sb.append('&').append(k).append('=')
                .append(URLEncoder.encode(v, StandardCharsets.UTF_8)));

        String raw;
        String urlForLog = sb.toString().replaceAll("serviceKey=[^&]+", "serviceKey=***");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            URI uri = URI.create(sb.toString());
            raw = httpClient.requestUri(uri, HttpMethod.GET, headers);
        } catch (Exception ex) {
            log.error("[CAMPING] 호출 실패 page={} url={} err={}", pageNo, urlForLog, ex.getMessage());
            return null;
        }

        if (raw == null || raw.isBlank()) {
            log.warn("[CAMPING] 빈 응답 page={}", pageNo);
            return null;
        }

        String trimmed = raw.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            log.warn("[CAMPING] 비-JSON 응답 (미승인/쿼터 초과 가능) page={} prefix={}",
                    pageNo, trimmed.substring(0, Math.min(80, trimmed.length())));
            return null;
        }

        GoCampingResponse parsed;
        try {
            // 0건 응답에서 items/item 이 빈 문자열로 내려오는 경우 파싱 실패 방지
            String safe = trimmed
                    .replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                    .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
            parsed = ObjectMapperUtil.toObject(safe, GoCampingResponse.class);
        } catch (Exception ex) {
            log.error("[CAMPING] 파싱 실패 page={} err={}", pageNo, ex.getMessage());
            return null;
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null) {
            return new PageResult(List.of(), 0);
        }

        GoCampingResponse.Body body = parsed.getResponse().getBody();
        int totalCount = body.getTotalCount() != null ? body.getTotalCount() : 0;

        if (body.getItems() == null || body.getItems().getItem() == null) {
            return new PageResult(List.of(), totalCount);
        }

        List<CampingSite> list = body.getItems().getItem().stream()
                .map(GoCampingHttpClient::toDomain)
                .filter(s -> s.getName() != null && !s.getName().isBlank())
                .collect(Collectors.toList());
        return new PageResult(list, totalCount);
    }

    private static CampingSite toDomain(GoCampingResponse.Item i) {
        Double lat = parseDouble(i.getMapY());
        Double lng = parseDouble(i.getMapX());
        String addr = joinAddr(i.getAddr1(), i.getAddr2());
        return CampingSite.builder()
                .id(i.getContentId())
                .name(i.getFacltNm())
                .address(addr)
                .zipcode(i.getZipcode())
                .latitude(lat)
                .longitude(lng)
                .induty(nullIfBlank(i.getInduty()))
                .lctCl(nullIfBlank(i.getLctCl()))
                .shortIntro(nullIfBlank(i.getLineIntro()))
                .longIntro(nullIfBlank(i.getIntro()))
                .imageUrl(nullIfBlank(i.getFirstImageUrl()))
                .tel(nullIfBlank(i.getTel()))
                .homepage(nullIfBlank(i.getHomepage()))
                .direction(nullIfBlank(i.getDirection()))
                .doNm(nullIfBlank(i.getDoNm()))
                .sigunguNm(nullIfBlank(i.getSigunguNm()))
                .build();
    }

    private static CampingSite withDistance(CampingSite s, double lat, double lng) {
        if (s.getLatitude() == null || s.getLongitude() == null) return s;
        double d = haversineKm(lat, lng, s.getLatitude(), s.getLongitude());
        return CampingSite.builder()
                .id(s.getId())
                .name(s.getName())
                .address(s.getAddress())
                .zipcode(s.getZipcode())
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .induty(s.getInduty())
                .lctCl(s.getLctCl())
                .shortIntro(s.getShortIntro())
                .longIntro(s.getLongIntro())
                .imageUrl(s.getImageUrl())
                .tel(s.getTel())
                .homepage(s.getHomepage())
                .direction(s.getDirection())
                .doNm(s.getDoNm())
                .sigunguNm(s.getSigunguNm())
                .distanceKm(Math.round(d * 100.0) / 100.0)
                .build();
    }

    private static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private static Double parseDouble(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Double.parseDouble(s.trim()); }
        catch (NumberFormatException e) { return null; }
    }

    private static String nullIfBlank(String s) { return (s == null || s.isBlank()) ? null : s; }

    private static String joinAddr(String a1, String a2) {
        if ((a1 == null || a1.isBlank()) && (a2 == null || a2.isBlank())) return null;
        StringBuilder sb = new StringBuilder();
        if (a1 != null && !a1.isBlank()) sb.append(a1.trim());
        if (a2 != null && !a2.isBlank()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(a2.trim());
        }
        return sb.toString();
    }

    private CacheSnapshot getSnapshot(String key) {
        return cache.getOrDefault(key, CacheSnapshot.empty());
    }

    private boolean isStale(CacheSnapshot snap) {
        if (snap == null || snap.sites.isEmpty()) return true;
        long ageMin = (Instant.now().toEpochMilli() - snap.loadedAtEpochMs) / 60_000L;
        return ageMin >= cacheMinutes;
    }

    private static <T> List<T> take(List<T> list, int limit) {
        if (list == null) return List.of();
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private record CacheSnapshot(List<CampingSite> sites, long loadedAtEpochMs, boolean partial) {
        static CacheSnapshot empty() { return new CacheSnapshot(List.of(), 0L, false); }
    }

    private record PageResult(List<CampingSite> items, int totalCount) {}
}
