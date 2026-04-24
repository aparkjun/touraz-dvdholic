package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.medical.MedicalTourismSpot;
import fast.campus.netplix.medical.MedicalTourismSpotPort;
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
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) HTTP 어댑터.
 *
 * <p>WellnessTursmService 와 동일 패밀리로 가정하여 동일한 방어 전략을 적용한다:
 * <ul>
 *   <li>RestTemplate 이중 인코딩 방지 → {@link HttpClient#requestUri(URI, HttpMethod, HttpHeaders)}</li>
 *   <li>items 빈 문자열("") 0건 응답 → JSON 파싱 전 null 치환</li>
 *   <li>전체 목록 = 1페이지 동기 + 백그라운드 풀 적재 (Heroku 30s 회피)</li>
 *   <li>serviceKey 미설정 / 403 Forbidden(활용 미승인) / 비-JSON 응답 → 빈 리스트 반환</li>
 * </ul>
 *
 * <p>언어별 독립 캐시(ko/en) — 외국인 타깃 특성상 en 사용 빈도가 높다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaMedicalTourismHttpClient implements MedicalTourismSpotPort {

    private static final int MAX_PAGE_SIZE = 200;
    private static final String ALL_KEY_PREFIX = "__ALL__:";
    private static final int MAX_KEYWORD_CACHE = 64;
    private static final int MAX_PAGES_ALL = 10;
    private static final int MAX_PAGES_KEYWORD = 10;
    private static final int LOCATION_PAGE_ROWS = 100;
    private static final Set<String> SUPPORTED_LANGS = Set.of("ko", "en");

    private final HttpClient httpClient;

    @Value("${visitkorea.medical-tourism.api-key:}")
    private String serviceKey;

    @Value("${visitkorea.medical-tourism.area-url:https://apis.data.go.kr/B551011/MdclTursmService/areaBasedList}")
    private String areaUrl;

    @Value("${visitkorea.medical-tourism.location-url:https://apis.data.go.kr/B551011/MdclTursmService/locationBasedList}")
    private String locationUrl;

    @Value("${visitkorea.medical-tourism.search-url:https://apis.data.go.kr/B551011/MdclTursmService/searchKeyword}")
    private String searchUrl;

    @Value("${visitkorea.medical-tourism.cache-minutes:1440}")
    private long cacheMinutes;

    private final Map<String, CacheSnapshot> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && areaUrl != null && !areaUrl.isBlank();
    }

    @PostConstruct
    void prewarm() {
        if (!isConfigured()) {
            log.info("[MEDICAL] serviceKey/URL 미설정 - 프리워밍 생략");
            return;
        }
        // ko 만 프리워밍. en 은 최초 호출 시점에 적재(외국인 방문 트래픽이 발생하는 시점).
        CompletableFuture.runAsync(() -> {
            try {
                refreshAll("ko");
                log.info("[MEDICAL] 프리워밍 완료 - {} 건 로드",
                        getSnapshot(allKey("ko")).sites.size());
            } catch (Exception ex) {
                log.warn("[MEDICAL] 프리워밍 실패 (활용신청 미승인 가능): {}", ex.getMessage());
            }
        });
    }

    @Override
    public List<MedicalTourismSpot> fetchAll(String lang, int limit) {
        if (!isConfigured()) return List.of();
        String l = normalize(lang);
        String key = allKey(l);
        CacheSnapshot snap = cache.get(key);

        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(areaUrl, Map.of("arrange", "C"), l, 1);
            if (first == null) return List.of();
            List<MedicalTourismSpot> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(key, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleAllRefresh(l);
            return take(partial, limit);
        }

        scheduleAllRefresh(l);
        return take(snap.sites, limit);
    }

    @Override
    public List<MedicalTourismSpot> fetchNearby(String lang, double latitude, double longitude, int radiusM, int limit) {
        if (!isConfigured()) return List.of();
        String l = normalize(lang);
        Map<String, String> params = Map.of(
                "mapX", String.valueOf(longitude),
                "mapY", String.valueOf(latitude),
                "radius", String.valueOf(Math.max(1, radiusM)),
                "arrange", "E"
        );
        PageResult pr = requestPage(locationUrl, params, l, 1, LOCATION_PAGE_ROWS);
        if (pr == null) return List.of();
        List<MedicalTourismSpot> sorted = pr.items.stream()
                .map(s -> withDistance(s, latitude, longitude))
                .sorted((a, b) -> Double.compare(
                        a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                        b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()))
                .collect(Collectors.toList());
        return take(sorted, limit);
    }

    @Override
    public List<MedicalTourismSpot> fetchByKeyword(String lang, String keyword, int limit) {
        if (!isConfigured()) return List.of();
        if (keyword == null || keyword.isBlank()) return fetchAll(lang, limit);
        String l = normalize(lang);
        String cacheKey = l + ":" + keyword.trim().toLowerCase(Locale.ROOT);

        CacheSnapshot snap = cache.get(cacheKey);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(searchUrl, Map.of("keyword", keyword.trim()), l, 1);
            if (first == null) return List.of();
            List<MedicalTourismSpot> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(cacheKey, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleKeywordRefresh(l, keyword.trim(), cacheKey);
            return take(partial, limit);
        }

        scheduleKeywordRefresh(l, keyword.trim(), cacheKey);
        return take(snap.sites, limit);
    }

    private void scheduleAllRefresh(String lang) {
        CompletableFuture.runAsync(() -> {
            try { refreshAll(lang); }
            catch (Exception ex) {
                log.warn("[MEDICAL] 백그라운드 전체 갱신 실패 lang={}: {}", lang, ex.getMessage());
            }
        });
    }

    private void scheduleKeywordRefresh(String lang, String keyword, String cacheKey) {
        CompletableFuture.runAsync(() -> {
            try { refreshByKeyword(lang, keyword, cacheKey); }
            catch (Exception ex) {
                log.warn("[MEDICAL] 백그라운드 키워드 갱신 실패 lang={} keyword={} err={}",
                        lang, keyword, ex.getMessage());
            }
        });
    }

    private synchronized void refreshAll(String lang) {
        List<MedicalTourismSpot> sites = requestAllPages(areaUrl, Map.of("arrange", "C"), lang, MAX_PAGES_ALL);
        if (sites == null) {
            log.warn("[MEDICAL] lang={} 전체 로드 실패 - 캐시 유지", lang);
            return;
        }
        cache.put(allKey(lang), new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[MEDICAL] lang={} 전체 캐시 갱신 - {} 건", lang, sites.size());
    }

    private synchronized void refreshByKeyword(String lang, String keyword, String cacheKey) {
        List<MedicalTourismSpot> sites = requestAllPages(searchUrl, Map.of("keyword", keyword), lang, MAX_PAGES_KEYWORD);
        if (sites == null) {
            log.warn("[MEDICAL] lang={} keyword={} 로드 실패 - 캐시 저장 스킵", lang, keyword);
            return;
        }
        if (cache.size() >= MAX_KEYWORD_CACHE) {
            cache.entrySet().stream()
                    .filter(e -> !e.getKey().startsWith(ALL_KEY_PREFIX))
                    .min((a, b) -> Long.compare(a.getValue().loadedAtEpochMs, b.getValue().loadedAtEpochMs))
                    .ifPresent(e -> cache.remove(e.getKey()));
        }
        cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[MEDICAL] lang={} 키워드={} 캐시 갱신 - {} 건", lang, keyword, sites.size());
    }

    private List<MedicalTourismSpot> requestAllPages(String baseUrl, Map<String, String> extraParams, String lang, int maxPages) {
        PageResult first = requestPage(baseUrl, extraParams, lang, 1);
        if (first == null) return null;

        List<MedicalTourismSpot> acc = new ArrayList<>(first.items);
        int totalCount = first.totalCount;
        if (totalCount <= first.items.size()) {
            return Collections.unmodifiableList(acc);
        }

        int totalPages = (int) Math.min(
                maxPages,
                (long) Math.ceil(totalCount / (double) MAX_PAGE_SIZE));

        for (int page = 2; page <= totalPages; page++) {
            PageResult pr = requestPage(baseUrl, extraParams, lang, page);
            if (pr == null || pr.items.isEmpty()) {
                log.warn("[MEDICAL] lang={} page={} 빈/실패 - 지금까지 {}건으로 마감",
                        lang, page, acc.size());
                break;
            }
            acc.addAll(pr.items);
        }
        log.info("[MEDICAL] lang={} 페이지 순회 완료 - totalCount={} 로드={} (maxPages={})",
                lang, totalCount, acc.size(), maxPages);
        return Collections.unmodifiableList(acc);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, String lang, int pageNo) {
        return requestPage(baseUrl, extraParams, lang, pageNo, MAX_PAGE_SIZE);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, String lang, int pageNo, int rows) {
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json");
        sb.append("&MobileOS=ETC");
        sb.append("&MobileApp=touraz-dvdholic");
        sb.append("&numOfRows=").append(rows);
        sb.append("&pageNo=").append(pageNo);
        // MdclTursmService 는 Wellness 와 동일하게 langDivCd 필수로 가정
        sb.append("&langDivCd=").append(lang);
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
            // 403 Forbidden (활용신청 미승인)은 흔한 초기 상태이므로 WARN 대신 INFO
            String msg = ex.getMessage() != null ? ex.getMessage() : "";
            if (msg.contains("403") || msg.toLowerCase(Locale.ROOT).contains("forbidden")) {
                log.info("[MEDICAL] 403 Forbidden - 공공데이터포털 활용신청 승인 필요. page={} url={}",
                        pageNo, urlForLog);
            } else {
                log.error("[MEDICAL] 호출 실패 page={} url={} err={}", pageNo, urlForLog, msg);
            }
            return null;
        }

        if (raw == null || raw.isBlank()) {
            log.warn("[MEDICAL] 빈 응답 page={}", pageNo);
            return null;
        }

        String trimmed = raw.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            log.warn("[MEDICAL] 비-JSON 응답 (미승인/쿼터 초과 가능) page={} prefix={}",
                    pageNo, trimmed.substring(0, Math.min(80, trimmed.length())));
            return null;
        }

        VisitKoreaMedicalTourismResponse parsed;
        try {
            String safe = trimmed
                    .replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                    .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaMedicalTourismResponse.class);
        } catch (Exception ex) {
            log.error("[MEDICAL] 파싱 실패 page={} err={}", pageNo, ex.getMessage());
            return null;
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null) {
            return new PageResult(List.of(), 0);
        }

        VisitKoreaMedicalTourismResponse.Body body = parsed.getResponse().getBody();
        int totalCount = body.getTotalCount() != null ? body.getTotalCount() : 0;

        if (body.getItems() == null || body.getItems().getItem() == null) {
            return new PageResult(List.of(), totalCount);
        }

        List<MedicalTourismSpot> list = body.getItems().getItem().stream()
                .map(VisitKoreaMedicalTourismHttpClient::toDomain)
                .filter(s -> s.getName() != null && !s.getName().isBlank())
                .collect(Collectors.toList());
        return new PageResult(list, totalCount);
    }

    private static MedicalTourismSpot toDomain(VisitKoreaMedicalTourismResponse.Item i) {
        Double lat = parseDouble(i.getMapY());
        Double lng = parseDouble(i.getMapX());
        String addr = joinAddr(i.getBaseAddr(), i.getDetailAddr());
        String image = nullIfBlank(i.getOrgImage());
        if (image == null) image = nullIfBlank(i.getThumbImage());
        return MedicalTourismSpot.builder()
                .id(i.getContentId())
                .name(i.getTitle())
                .address(addr)
                .zipcode(nullIfBlank(i.getZipCd()))
                .latitude(lat)
                .longitude(lng)
                .imageUrl(image)
                .tel(nullIfBlank(i.getTel()))
                .category(nullIfBlank(i.getMedClusterCd()))
                .areaCode(nullIfBlank(i.getLDongRegnCd()))
                .sigunguCode(nullIfBlank(i.getLDongSignguCd()))
                .contentTypeId(nullIfBlank(i.getContentTypeId()))
                .language(nullIfBlank(i.getLangDivCd()))
                .build();
    }

    private static MedicalTourismSpot withDistance(MedicalTourismSpot s, double lat, double lng) {
        if (s.getLatitude() == null || s.getLongitude() == null) return s;
        double d = haversineKm(lat, lng, s.getLatitude(), s.getLongitude());
        return MedicalTourismSpot.builder()
                .id(s.getId())
                .name(s.getName())
                .address(s.getAddress())
                .zipcode(s.getZipcode())
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .imageUrl(s.getImageUrl())
                .tel(s.getTel())
                .category(s.getCategory())
                .areaCode(s.getAreaCode())
                .sigunguCode(s.getSigunguCode())
                .contentTypeId(s.getContentTypeId())
                .language(s.getLanguage())
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

    private static String normalize(String lang) {
        if (lang == null) return "ko";
        String n = lang.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LANGS.contains(n) ? n : "ko";
    }

    private static String allKey(String lang) {
        return ALL_KEY_PREFIX + lang;
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

    private record CacheSnapshot(List<MedicalTourismSpot> sites, long loadedAtEpochMs, boolean partial) {
        static CacheSnapshot empty() { return new CacheSnapshot(List.of(), 0L, false); }
    }

    private record PageResult(List<MedicalTourismSpot> items, int totalCount) {}
}
