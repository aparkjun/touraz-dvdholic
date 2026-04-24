package fast.campus.netplix.visitkorea;

import fast.campus.netplix.audioguide.AudioGuideItem;
import fast.campus.netplix.audioguide.AudioGuideItemPort;
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
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) HTTP 어댑터.
 *
 * <p>Wellness/MdclTursmService 와 동일 방어 전략:
 * <ul>
 *   <li>RestTemplate 이중 인코딩 방지 → {@link HttpClient#requestUri(URI, HttpMethod, HttpHeaders)}</li>
 *   <li>items 빈 문자열 치환, 비-JSON 방어</li>
 *   <li>전체 목록 = 1페이지 동기 + 백그라운드 풀 적재 (Heroku 30s 회피)</li>
 *   <li>serviceKey/URL 미설정 · 403 Forbidden · 비-JSON 응답 → 빈 리스트 반환</li>
 * </ul>
 *
 * <p>캐시 키는 type+lang 조합으로 분리 (예: "THEME:ko", "STORY:en").
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaOdiiHttpClient implements AudioGuideItemPort {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String ALL_KEY_PREFIX = "__ALL__:";
    private static final int MAX_KEYWORD_CACHE = 64;
    private static final int MAX_PAGES_ALL = 10;
    private static final int MAX_PAGES_KEYWORD = 10;
    private static final int LOCATION_PAGE_ROWS = 50;
    private static final Set<String> SUPPORTED_LANGS = Set.of("ko", "en");

    private final HttpClient httpClient;

    @Value("${visitkorea.odii.api-key:}")
    private String serviceKey;

    @Value("${visitkorea.odii.base-url:https://apis.data.go.kr/B551011/Odii}")
    private String baseUrl;

    @Value("${visitkorea.odii.theme-based-url:}")
    private String themeBasedUrlProp;

    @Value("${visitkorea.odii.story-based-url:}")
    private String storyBasedUrlProp;

    @Value("${visitkorea.odii.theme-location-url:}")
    private String themeLocationUrlProp;

    @Value("${visitkorea.odii.story-location-url:}")
    private String storyLocationUrlProp;

    @Value("${visitkorea.odii.theme-search-url:}")
    private String themeSearchUrlProp;

    @Value("${visitkorea.odii.story-search-url:}")
    private String storySearchUrlProp;

    @Value("${visitkorea.odii.cache-minutes:1440}")
    private long cacheMinutes;

    private final Map<String, CacheSnapshot> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && baseUrl != null && !baseUrl.isBlank();
    }

    @PostConstruct
    void prewarm() {
        if (!isConfigured()) {
            log.info("[ODII] serviceKey/URL 미설정 - 프리워밍 생략");
            return;
        }
        // ko 테마만 프리워밍. story/en 은 최초 호출 시 적재.
        CompletableFuture.runAsync(() -> {
            try {
                refreshAll(AudioGuideItem.Type.THEME, "ko");
                log.info("[ODII] 프리워밍 완료 (THEME:ko) - {} 건 로드",
                        getSnapshot(allKey(AudioGuideItem.Type.THEME, "ko")).sites.size());
            } catch (Exception ex) {
                log.warn("[ODII] 프리워밍 실패 (활용신청 미승인 가능): {}", ex.getMessage());
            }
        });
    }

    // =========================================================================
    // Port
    // =========================================================================

    @Override
    public List<AudioGuideItem> fetchAll(AudioGuideItem.Type type, String lang, int limit) {
        if (!isConfigured()) return List.of();
        String l = normalize(lang);
        String key = allKey(type, l);
        CacheSnapshot snap = cache.get(key);

        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(basedUrl(type), Map.of(), type, l, 1);
            if (first == null) return List.of();
            List<AudioGuideItem> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(key, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleAllRefresh(type, l);
            return take(partial, limit);
        }

        scheduleAllRefresh(type, l);
        return take(snap.sites, limit);
    }

    @Override
    public List<AudioGuideItem> fetchNearby(AudioGuideItem.Type type, String lang,
                                            double latitude, double longitude, int radiusM, int limit) {
        if (!isConfigured()) return List.of();
        String l = normalize(lang);
        Map<String, String> params = Map.of(
                "mapX", String.valueOf(longitude),
                "mapY", String.valueOf(latitude),
                "radius", String.valueOf(Math.max(1, radiusM))
        );
        PageResult pr = requestPage(locationUrl(type), params, type, l, 1, LOCATION_PAGE_ROWS);
        if (pr == null) return List.of();
        List<AudioGuideItem> sorted = pr.items.stream()
                .map(s -> withDistance(s, latitude, longitude))
                .sorted((a, b) -> Double.compare(
                        a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                        b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()))
                .collect(Collectors.toList());
        return take(sorted, limit);
    }

    @Override
    public List<AudioGuideItem> fetchByKeyword(AudioGuideItem.Type type, String lang, String keyword, int limit) {
        if (!isConfigured()) return List.of();
        if (keyword == null || keyword.isBlank()) return fetchAll(type, lang, limit);
        String l = normalize(lang);
        String cacheKey = type.name() + ":" + l + ":" + keyword.trim().toLowerCase(Locale.ROOT);

        CacheSnapshot snap = cache.get(cacheKey);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(searchUrl(type), Map.of("keyword", keyword.trim()), type, l, 1);
            if (first == null) return List.of();
            List<AudioGuideItem> partial = Collections.unmodifiableList(new ArrayList<>(first.items));
            boolean needMore = first.totalCount > partial.size();
            cache.put(cacheKey, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleKeywordRefresh(type, l, keyword.trim(), cacheKey);
            return take(partial, limit);
        }

        scheduleKeywordRefresh(type, l, keyword.trim(), cacheKey);
        return take(snap.sites, limit);
    }

    // =========================================================================
    // URL 선택
    // =========================================================================

    private String basedUrl(AudioGuideItem.Type type) {
        if (type == AudioGuideItem.Type.STORY) {
            return !storyBasedUrlProp.isBlank() ? storyBasedUrlProp : baseUrl + "/storyBasedList";
        }
        return !themeBasedUrlProp.isBlank() ? themeBasedUrlProp : baseUrl + "/themeBasedList";
    }

    private String locationUrl(AudioGuideItem.Type type) {
        if (type == AudioGuideItem.Type.STORY) {
            return !storyLocationUrlProp.isBlank() ? storyLocationUrlProp : baseUrl + "/storyLocationBasedList";
        }
        return !themeLocationUrlProp.isBlank() ? themeLocationUrlProp : baseUrl + "/themeLocationBasedList";
    }

    private String searchUrl(AudioGuideItem.Type type) {
        if (type == AudioGuideItem.Type.STORY) {
            return !storySearchUrlProp.isBlank() ? storySearchUrlProp : baseUrl + "/storySearchList";
        }
        return !themeSearchUrlProp.isBlank() ? themeSearchUrlProp : baseUrl + "/themeSearchList";
    }

    // =========================================================================
    // 백그라운드 리프레시
    // =========================================================================

    private void scheduleAllRefresh(AudioGuideItem.Type type, String lang) {
        CompletableFuture.runAsync(() -> {
            try { refreshAll(type, lang); }
            catch (Exception ex) {
                log.warn("[ODII] 백그라운드 전체 갱신 실패 type={} lang={}: {}",
                        type, lang, ex.getMessage());
            }
        });
    }

    private void scheduleKeywordRefresh(AudioGuideItem.Type type, String lang, String keyword, String cacheKey) {
        CompletableFuture.runAsync(() -> {
            try { refreshByKeyword(type, lang, keyword, cacheKey); }
            catch (Exception ex) {
                log.warn("[ODII] 백그라운드 키워드 갱신 실패 type={} lang={} keyword={} err={}",
                        type, lang, keyword, ex.getMessage());
            }
        });
    }

    private synchronized void refreshAll(AudioGuideItem.Type type, String lang) {
        List<AudioGuideItem> sites = requestAllPages(basedUrl(type), Map.of(), type, lang, MAX_PAGES_ALL);
        if (sites == null) {
            log.warn("[ODII] type={} lang={} 전체 로드 실패 - 캐시 유지", type, lang);
            return;
        }
        cache.put(allKey(type, lang), new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[ODII] type={} lang={} 전체 캐시 갱신 - {} 건", type, lang, sites.size());
    }

    private synchronized void refreshByKeyword(AudioGuideItem.Type type, String lang, String keyword, String cacheKey) {
        List<AudioGuideItem> sites = requestAllPages(searchUrl(type), Map.of("keyword", keyword), type, lang, MAX_PAGES_KEYWORD);
        if (sites == null) {
            log.warn("[ODII] type={} lang={} keyword={} 로드 실패 - 캐시 저장 스킵", type, lang, keyword);
            return;
        }
        if (cache.size() >= MAX_KEYWORD_CACHE) {
            cache.entrySet().stream()
                    .filter(e -> !e.getKey().startsWith(ALL_KEY_PREFIX))
                    .min((a, b) -> Long.compare(a.getValue().loadedAtEpochMs, b.getValue().loadedAtEpochMs))
                    .ifPresent(e -> cache.remove(e.getKey()));
        }
        cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[ODII] type={} lang={} 키워드={} 캐시 갱신 - {} 건", type, lang, keyword, sites.size());
    }

    // =========================================================================
    // HTTP
    // =========================================================================

    private List<AudioGuideItem> requestAllPages(String baseUrl, Map<String, String> extraParams,
                                                 AudioGuideItem.Type type, String lang, int maxPages) {
        PageResult first = requestPage(baseUrl, extraParams, type, lang, 1);
        if (first == null) return null;

        List<AudioGuideItem> acc = new ArrayList<>(first.items);
        int totalCount = first.totalCount;
        if (totalCount <= first.items.size()) {
            return Collections.unmodifiableList(acc);
        }

        int totalPages = (int) Math.min(
                maxPages,
                (long) Math.ceil(totalCount / (double) MAX_PAGE_SIZE));

        for (int page = 2; page <= totalPages; page++) {
            PageResult pr = requestPage(baseUrl, extraParams, type, lang, page);
            if (pr == null || pr.items.isEmpty()) {
                log.warn("[ODII] type={} lang={} page={} 빈/실패 - 지금까지 {}건으로 마감",
                        type, lang, page, acc.size());
                break;
            }
            acc.addAll(pr.items);
        }
        log.info("[ODII] type={} lang={} 페이지 순회 완료 - totalCount={} 로드={} (maxPages={})",
                type, lang, totalCount, acc.size(), maxPages);
        return Collections.unmodifiableList(acc);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams,
                                   AudioGuideItem.Type type, String lang, int pageNo) {
        return requestPage(baseUrl, extraParams, type, lang, pageNo, MAX_PAGE_SIZE);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams,
                                   AudioGuideItem.Type type, String lang, int pageNo, int rows) {
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json");
        sb.append("&MobileOS=ETC");
        sb.append("&MobileApp=touraz-dvdholic");
        sb.append("&numOfRows=").append(rows);
        sb.append("&pageNo=").append(pageNo);
        // Odii 는 langCode 를 필수 파라미터로 요구 (확인된 스펙:
        //   resultCode=11, NO_MANDATORY_REQUEST_PARAMETERS_ERROR1(langCode)).
        // Wellness/MdclTursmService 와 달리 langDivCd 가 아닌 langCode 임에 주의.
        sb.append("&langCode=").append(lang);
        extraParams.forEach((k, v) -> sb.append('&').append(k).append('=')
                .append(URLEncoder.encode(v, StandardCharsets.UTF_8)));

        String urlForLog = sb.toString().replaceAll("serviceKey=[^&]+", "serviceKey=***");
        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            URI uri = URI.create(sb.toString());
            raw = httpClient.requestUri(uri, HttpMethod.GET, headers);
        } catch (Exception ex) {
            String msg = ex.getMessage() != null ? ex.getMessage() : "";
            if (msg.contains("403") || msg.toLowerCase(Locale.ROOT).contains("forbidden")) {
                log.info("[ODII] 403 Forbidden - 공공데이터포털 Odii 활용신청 승인 필요. type={} url={}",
                        type, urlForLog);
            } else {
                log.error("[ODII] 호출 실패 type={} page={} url={} err={}",
                        type, pageNo, urlForLog, msg);
            }
            return null;
        }

        if (raw == null || raw.isBlank()) {
            log.warn("[ODII] 빈 응답 type={} page={}", type, pageNo);
            return null;
        }

        String trimmed = raw.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            log.warn("[ODII] 비-JSON 응답 (미승인/쿼터 초과 가능) type={} page={} prefix={}",
                    type, pageNo, trimmed.substring(0, Math.min(80, trimmed.length())));
            return null;
        }

        VisitKoreaOdiiResponse parsed;
        try {
            String safe = trimmed
                    .replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                    .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaOdiiResponse.class);
        } catch (Exception ex) {
            log.error("[ODII] 파싱 실패 type={} page={} err={}", type, pageNo, ex.getMessage());
            return null;
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null) {
            return new PageResult(List.of(), 0);
        }

        VisitKoreaOdiiResponse.Body body = parsed.getResponse().getBody();
        int totalCount = body.getTotalCount() != null ? body.getTotalCount() : 0;

        if (body.getItems() == null || body.getItems().getItem() == null) {
            return new PageResult(List.of(), totalCount);
        }

        List<AudioGuideItem> list = body.getItems().getItem().stream()
                .map(item -> toDomain(item, type))
                .filter(s -> s.getTitle() != null && !s.getTitle().isBlank())
                .collect(Collectors.toList());
        return new PageResult(list, totalCount);
    }

    // =========================================================================
    // Mapping
    // =========================================================================

    private static AudioGuideItem toDomain(VisitKoreaOdiiResponse.Item i, AudioGuideItem.Type type) {
        Double lat = parseDouble(i.getMapY());
        Double lng = parseDouble(i.getMapX());
        String id = (type == AudioGuideItem.Type.STORY)
                ? (nullIfBlank(i.getStid()) != null ? i.getStid() : i.getTid())
                : (nullIfBlank(i.getTid()) != null ? i.getTid() : i.getStid());
        return AudioGuideItem.builder()
                .id(id)
                .themeId(nullIfBlank(i.getTid()))
                .type(type)
                .title(i.getTitle())
                .audioTitle(nullIfBlank(i.getAudioTitle()))
                .audioUrl(nullIfBlank(i.getAudioUrl()))
                .playTimeText(nullIfBlank(i.getPlayTimeText()))
                .description(nullIfBlank(i.getDescription()))
                .imageUrl(nullIfBlank(i.getImageUrl()))
                .address(combineAddress(i.getBaseAddr(), i.getDetailAddr()))
                .latitude(lat)
                .longitude(lng)
                .themeCategory(nullIfBlank(i.getThemeCategory()))
                .language(nullIfBlank(i.getLangCode()))
                .build();
    }

    private static AudioGuideItem withDistance(AudioGuideItem s, double lat, double lng) {
        if (s.getLatitude() == null || s.getLongitude() == null) return s;
        double d = haversineKm(lat, lng, s.getLatitude(), s.getLongitude());
        return AudioGuideItem.builder()
                .id(s.getId())
                .themeId(s.getThemeId())
                .type(s.getType())
                .title(s.getTitle())
                .audioTitle(s.getAudioTitle())
                .audioUrl(s.getAudioUrl())
                .playTimeText(s.getPlayTimeText())
                .description(s.getDescription())
                .imageUrl(s.getImageUrl())
                .address(s.getAddress())
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .themeCategory(s.getThemeCategory())
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

    /** Odii 응답의 addr1 + addr2 를 공백으로 결합해 단일 주소 문자열로 만든다. */
    private static String combineAddress(String addr1, String addr2) {
        String a1 = nullIfBlank(addr1);
        String a2 = nullIfBlank(addr2);
        if (a1 == null && a2 == null) return null;
        if (a1 == null) return a2;
        if (a2 == null) return a1;
        return a1 + " " + a2;
    }

    private static String normalize(String lang) {
        if (lang == null) return "ko";
        String n = lang.trim().toLowerCase(Locale.ROOT);
        return SUPPORTED_LANGS.contains(n) ? n : "ko";
    }

    private static String allKey(AudioGuideItem.Type type, String lang) {
        return ALL_KEY_PREFIX + type.name() + ":" + lang;
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

    private record CacheSnapshot(List<AudioGuideItem> sites, long loadedAtEpochMs, boolean partial) {
        static CacheSnapshot empty() { return new CacheSnapshot(List.of(), 0L, false); }
    }

    private record PageResult(List<AudioGuideItem> items, int totalCount) {}
}
