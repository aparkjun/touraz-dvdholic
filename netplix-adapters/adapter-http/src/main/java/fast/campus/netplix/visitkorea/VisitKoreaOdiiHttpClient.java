package fast.campus.netplix.visitkorea;

import fast.campus.netplix.audioguide.AudioGuideItem;
import fast.campus.netplix.audioguide.AudioGuideItemPort;
import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.util.ObjectMapperUtil;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
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
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) HTTP 어댑터.
 *
 * <p>Wellness/MdclTursmService 와 동일 방어 전략:
 * <ul>
 *   <li>RestTemplate 이중 인코딩 방지 → {@link HttpClient#requestUri(URI, HttpMethod, HttpHeaders)}</li>
 *   <li>items 빈 문자열 치환, 비-JSON 방어</li>
 *   <li>전체 목록 limit=0 시 동기 풀 적재 + 2페이지~는 제한 병렬 요청으로 지연 완화</li>
 *   <li>serviceKey/URL 미설정 · 403 Forbidden · 비-JSON 응답 → 빈 리스트 반환</li>
 * </ul>
 *
 * <p>캐시 키는 type+lang 조합으로 분리 (예: "THEME:ko", "STORY:zh").
 * 프런트 {@code /audio-guide} 상단 라벨은 KO·EN·ZH·JA 이고, 캐시 키는 canonical {@code ko|en|zh|ja}.
 * 중·일 GW {@code langCode} 표기는 명세·버전별로 {@code zh}/{@code chs}/{@code jp}/{@code jpn} 등이 혼재할 수 있어
 * {@link #resolveOdiiQueryLangForRequest} 가 테마/스토리 목록 1페이지로 한 번 프로브한 뒤 캐시한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaOdiiHttpClient implements AudioGuideItemPort {

    private static final int MAX_PAGE_SIZE = 100;
    private static final String ALL_KEY_PREFIX = "__ALL__:";
    private static final int MAX_KEYWORD_CACHE = 64;
    // 확인된 totalCount: themeBasedList 약 2,231건, storyBasedList 는 공공 API 기준 6,000건 초과.
    // 100건/페이지 × 100페이지 = 10,000건 상한 → 스토리 풀 적재 시 누락 방지.
    private static final int MAX_PAGES_ALL = 100;
    // 키워드 검색 결과는 일반적으로 수백 건 이내지만 안전하게 여유.
    private static final int MAX_PAGES_KEYWORD = 30;
    private static final int LOCATION_PAGE_ROWS = 50;
    /** TourAPI 계열 locationBased 공통: radius(m) 상한 초과 시 GW 가 빈 목록·비정상 응답을 줄 수 있음. */
    private static final int LOCATION_RADIUS_MAX_M = 20_000;
    private static final Set<String> SUPPORTED_LANGS = Set.of("ko", "en", "zh", "ja");

    /** 목록 추가 페이지를 순차가 아닌 병렬로 받아 EN/ZH/JA 첫 로딩 시간을 줄인다. */
    private static final int ODII_PARALLEL_PAGE_FETCH = 8;

    private static final ExecutorService ODII_PAGE_FETCH_POOL = Executors.newFixedThreadPool(
            ODII_PARALLEL_PAGE_FETCH,
            r -> {
                Thread t = new Thread(r, "odii-page-fetch");
                t.setDaemon(true);
                return t;
            });

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

    /** 미설정 시 요청마다 로그 도배 방지 */
    private final AtomicBoolean warnedMisconfigured = new AtomicBoolean(false);

    /** GW langCode 프로브 결과: {@code THEME:zh} 처럼 type 과 묶어 STORY/THEME 가 다른 코드를 쓰는 경우를 대비한다. */
    private final ConcurrentHashMap<String, String> resolvedOdiiQueryLangByCanonical = new ConcurrentHashMap<>();

    /**
     * 전역 synchronized 금지: KO 스토리 등 대량 페이지 적재가 EN/ZH/JA 적재와 같은 락을 잡으면
     * 요청 스레드가 수십 초 대기·타임아웃 후 빈 응답(0건)처럼 보일 수 있다.
     */
    private final ConcurrentHashMap<String, Object> refreshMonitors = new ConcurrentHashMap<>();

    private Object monitorFor(String lockKey) {
        return refreshMonitors.computeIfAbsent(lockKey, k -> new Object());
    }

    /** API 키·URL 없으면 한 번만 WARN */
    private boolean guardConfigured() {
        if (isConfigured()) {
            return true;
        }
        if (warnedMisconfigured.compareAndSet(false, true)) {
            log.warn("[ODII] ODII_API_KEY 또는 VISITKOREA_SERVICE_KEY·baseUrl 미설정 — 오디오 가이드는 항상 0건입니다.");
        }
        return false;
    }

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
        // ko 테마 + ko 스토리 프리워밍.
        // 스토리 캐시는 THEME 카드 모달의 "연관 해설 이야기" 즉시 로딩을 위해 필수.
        CompletableFuture<Void> koTheme = CompletableFuture.runAsync(() -> {
            try {
                refreshAll(AudioGuideItem.Type.THEME, "ko");
                log.info("[ODII] 프리워밍 완료 (THEME:ko) - {} 건 로드",
                        getSnapshot(allKey(AudioGuideItem.Type.THEME, "ko")).sites.size());
            } catch (Exception ex) {
                log.warn("[ODII] 프리워밍 실패 THEME:ko (활용신청 미승인 가능): {}", ex.getMessage());
            }
        });
        CompletableFuture<Void> koStory = CompletableFuture.runAsync(() -> {
            try {
                refreshAll(AudioGuideItem.Type.STORY, "ko");
                log.info("[ODII] 프리워밍 완료 (STORY:ko) - {} 건 로드",
                        getSnapshot(allKey(AudioGuideItem.Type.STORY, "ko")).sites.size());
            } catch (Exception ex) {
                log.warn("[ODII] 프리워밍 실패 STORY:ko: {}", ex.getMessage());
            }
        });

        /*
         * KO 테마·스토리 이후 잠시 두었다가 EN/ZH/JA 테마만 선적재 → 언어 전환 시 체감 속도 개선.
         * 스토리 탭은 필요 시 첫 요청에서 병렬 페이지 로드·캐시로 충분.
         */
        CompletableFuture.allOf(koTheme, koStory).whenComplete((__, err) -> CompletableFuture.runAsync(() -> {
            try {
                Thread.sleep(4000L);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return;
            }
            for (String lang : new String[]{"en", "zh", "ja"}) {
                try {
                    refreshAll(AudioGuideItem.Type.THEME, lang);
                    log.info("[ODII] 프리워밍 완료 (THEME:{}) - {} 건 로드", lang,
                            getSnapshot(allKey(AudioGuideItem.Type.THEME, lang)).sites.size());
                } catch (Exception ex) {
                    log.warn("[ODII] 프리워밍 실패 THEME:{} — {}", lang, ex.getMessage());
                }
            }
        }));
    }

    @PreDestroy
    void shutdownOdiiPageFetchPool() {
        ODII_PAGE_FETCH_POOL.shutdown();
        try {
            if (!ODII_PAGE_FETCH_POOL.awaitTermination(20, TimeUnit.SECONDS)) {
                ODII_PAGE_FETCH_POOL.shutdownNow();
            }
        } catch (InterruptedException e) {
            ODII_PAGE_FETCH_POOL.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    // =========================================================================
    // Port
    // =========================================================================

    @Override
    public List<AudioGuideItem> fetchAll(AudioGuideItem.Type type, String lang, int limit) {
        if (!guardConfigured()) return List.of();
        String l = normalize(lang);
        String key = allKey(type, l);

        /*
         * 프런트는 전체 목록에 limit=0 을 보낸다. 첫 페이지만 넣은 partial 캐시를 그대로 반환하면
         * (백그라운드 적재 전 단일 요청 시) 항상 100건으로 고정되므로, 무제한 요청은 동기 풀 적재한다.
         */
        if (limit <= 0) {
            CacheSnapshot snap = cache.get(key);
            if (snap != null && !snap.partial && !isStale(snap)) {
                return snap.sites;
            }
            refreshAll(type, l);
            snap = cache.get(key);
            return take(snap != null ? snap.sites : List.of(), limit);
        }

        CacheSnapshot snap = cache.get(key);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        // 빈 스냅샷(잘못된 langCode·일시 오류 등)은 만료로만 보지 않고 매번 동기 재조회한다.
        if (snap == null || snap.sites.isEmpty()) {
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
        if (!guardConfigured()) return List.of();
        String l = normalize(lang);
        int r = Math.max(1, radiusM);
        if (r <= LOCATION_RADIUS_MAX_M) {
            return nearbyViaLocationApi(type, l, latitude, longitude, r, limit);
        }
        return nearbyViaCatalogDistance(type, l, latitude, longitude, r, limit);
    }

    /** Odii theme/storyLocationBasedList — radius 는 보통 20km 이하여야 안정적. */
    private List<AudioGuideItem> nearbyViaLocationApi(AudioGuideItem.Type type, String canonicalLang,
                                                      double latitude, double longitude, int radiusM, int limit) {
        int radiusClamped = Math.max(1, Math.min(radiusM, LOCATION_RADIUS_MAX_M));
        Map<String, String> params = Map.of(
                "mapX", String.valueOf(longitude),
                "mapY", String.valueOf(latitude),
                "radius", String.valueOf(radiusClamped)
        );
        PageResult pr = requestPage(locationUrl(type), params, type, canonicalLang, 1, LOCATION_PAGE_ROWS);
        if (pr == null) return List.of();
        List<AudioGuideItem> sorted = pr.items.stream()
                .map(s -> withDistance(s, latitude, longitude))
                .sorted((a, b) -> Double.compare(
                        a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                        b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()))
                .collect(Collectors.toList());
        return take(sorted, limit);
    }

    /**
     * 반경이 GW location 상한을 넘을 때: 동기 {@link #fetchAll} 풀(좌표 있는 항목만)에서 Haversine 필터.
     * 첫 로드 시 캐시 비면 location 20km 로 폴백.
     */
    private List<AudioGuideItem> nearbyViaCatalogDistance(AudioGuideItem.Type type, String canonicalLang,
                                                          double latitude, double longitude, int radiusM, int limit) {
        double maxKm = radiusM / 1000.0;
        List<AudioGuideItem> all = fetchAll(type, canonicalLang, 0);
        if (all == null || all.isEmpty()) {
            return nearbyViaLocationApi(type, canonicalLang, latitude, longitude, LOCATION_RADIUS_MAX_M, limit);
        }
        List<AudioGuideItem> filtered = all.stream()
                .filter(s -> s.getLatitude() != null && s.getLongitude() != null)
                .map(s -> withDistance(s, latitude, longitude))
                .filter(s -> s.getDistanceKm() != null && s.getDistanceKm() <= maxKm)
                .sorted(Comparator.comparingDouble(s -> s.getDistanceKm() == null ? Double.MAX_VALUE : s.getDistanceKm()))
                .collect(Collectors.toList());
        if (filtered.isEmpty()) {
            return nearbyViaLocationApi(type, canonicalLang, latitude, longitude, LOCATION_RADIUS_MAX_M, limit);
        }
        return take(filtered, limit);
    }

    @Override
    public List<AudioGuideItem> fetchByKeyword(AudioGuideItem.Type type, String lang, String keyword, int limit) {
        if (!guardConfigured()) return List.of();
        if (keyword == null || keyword.isBlank()) return fetchAll(type, lang, limit);
        String l = normalize(lang);
        String cacheKey = type.name() + ":" + l + ":" + keyword.trim().toLowerCase(Locale.ROOT);

        if (limit <= 0) {
            CacheSnapshot snapFull = cache.get(cacheKey);
            if (snapFull != null && !snapFull.partial && !isStale(snapFull)) {
                return snapFull.sites;
            }
            refreshByKeyword(type, l, keyword.trim(), cacheKey);
            snapFull = cache.get(cacheKey);
            return take(snapFull != null ? snapFull.sites : List.of(), limit);
        }

        CacheSnapshot snap = cache.get(cacheKey);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null || snap.sites.isEmpty()) {
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

    /**
     * 특정 THEME 에 연결된 STORY 목록 조회.
     *
     * <p>Odii 응답: storyBasedList item 은 보통 {@code tid}=상위 THEME id, {@code stid}=이야기 id (명세).
     * 전용 조회 API 가 없어 전체 STORY 캐시에서 필터한다. 캐시가 partial 이면 조인이 빗나가므로
     * {@link #ensureFullStoryCacheForJoin} 으로 전체 적재를 보장한다.
     */
    @Override
    public List<AudioGuideItem> fetchStoriesByTheme(String themeId, String themeTitleHint, String lang, int limit) {
        if (!guardConfigured()) return List.of();
        if (themeId == null || themeId.isBlank()) return List.of();
        String l = normalize(lang);
        String key = themeId.trim();
        List<String> hints = deriveStoryTitleHints(themeTitleHint);

        LinkedHashSet<String> bridgeThemeCandidates = new LinkedHashSet<>();
        bridgeThemeCandidates.add(key);
        if (!"ko".equals(l)) {
            AudioGuideItem anchorTheme = findCachedThemeForBridge(l, key);
            if (anchorTheme != null && anchorTheme.getLatitude() != null && anchorTheme.getLongitude() != null) {
                double lat = anchorTheme.getLatitude();
                double lng = anchorTheme.getLongitude();
                appendKoThemeIdsNearCoordinates(lat, lng, 0.45, bridgeThemeCandidates);
                appendKoThemeIdsNearCoordinates(lat, lng, 1.5, bridgeThemeCandidates);
                appendKoThemeIdsNearCoordinates(lat, lng, 4.0, bridgeThemeCandidates);
            }
            appendKoThemeIdsFromThemeKeywordSearch(hints, bridgeThemeCandidates, l);
        }
        ensureFullStoryCacheForJoin(l);
        CacheSnapshot snap = cache.get(allKey(AudioGuideItem.Type.STORY, l));
        List<AudioGuideItem> stories = snap != null ? snap.sites : List.of();
        List<AudioGuideItem> matched = stories.stream()
                .filter(s -> themeIdMatches(s.getThemeId(), key))
                .collect(Collectors.toList());
        if (!matched.isEmpty()) {
            return take(matched, limit);
        }
        /*
         * zh/ja/en 에서 GW 가 STORY 의 tid/linkTid 를 비우거나 다른 필드명으로 주면 themeId 조인이 빗나간다.
         * 같은 스토리 레코드의 기본키(stid 등)는 보통 언어 간 동일하므로, KO 풀에서 themeId 매칭으로 id 목록을 만든 뒤
         * 현재 언어 캐시에서 동일 id 로 재조립한다.
         * 요청 테마 tid 와 KO STORY 의 상위 tid 가 언어별로 다를 수 있어, 현재 언어 테마 좌표로 KO 테마 tid 를 근접 매칭해 후보를 넓힌다.
         */
        if (!"ko".equals(l)) {
            List<AudioGuideItem> bridged = storiesByThemeBridgedViaKoIds(bridgeThemeCandidates, l, limit);
            if (!bridged.isEmpty()) {
                log.info("[ODII] stories-by-theme: KO 스토리 id 브리지 매칭 {}건 themeId={} lang={} tid후보={}",
                        bridged.size(), key, l, bridgeThemeCandidates.size());
                return take(bridged, limit);
            }
        }
        if (hints.isEmpty()) {
            if ("ko".equals(l)) {
                return List.of();
            }
            List<AudioGuideItem> geoEarly = tryKoGeoStoryBridge(l, key, limit);
            if (!geoEarly.isEmpty()) {
                return take(geoEarly, limit);
            }
            List<AudioGuideItem> locEarly = tryKoStoryLocationApiBridge(l, key, limit);
            return locEarly.isEmpty() ? List.of() : take(locEarly, limit);
        }
        int kwLimit = Math.min(Math.max(limit * 5, 48), 120);
        Map<String, AudioGuideItem> mergedById = new LinkedHashMap<>();
        for (String sub : hints) {
            if (sub.length() < 2) {
                continue;
            }
            List<AudioGuideItem> kw = fetchByKeyword(AudioGuideItem.Type.STORY, l, sub, kwLimit);
            for (AudioGuideItem s : kw) {
                mergedById.putIfAbsent(s.getId(), s);
            }
            if (mergedById.size() >= 500) {
                break;
            }
        }
        matched = mergedById.values().stream()
                .filter(s -> storyThemeMatchesAnyCandidate(s.getThemeId(), bridgeThemeCandidates))
                .collect(Collectors.toList());
        if (!matched.isEmpty()) {
            log.info("[ODII] stories-by-theme: 다중 키워드 후보에서 tid 매칭 {}건 themeId={}", matched.size(), key);
            return take(matched, limit);
        }
        // 코스형 긴 THEME 명("조천 → 교래 휴양림 → 수목원길")은 STORY 제목과 문자열이 달라 tid 없이 맞춰야 하는 경우가 많다.
        for (String sub : hints) {
            if (sub.length() < 2) {
                continue;
            }
            matched = mergedById.values().stream()
                    .filter(s -> storyItemTextContains(s, sub))
                    .collect(Collectors.toList());
            if (!matched.isEmpty()) {
                log.info("[ODII] stories-by-theme: 제목·audioTitle 부분 일치 {}건 themeId={} hint={}", matched.size(), key, sub);
                return take(matched, limit);
            }
        }
        if (!"ko".equals(l)) {
            List<AudioGuideItem> koKwBridged = storiesFromKoKeywordBridge(hints, bridgeThemeCandidates, l, limit, kwLimit);
            if (!koKwBridged.isEmpty()) {
                log.info("[ODII] stories-by-theme: KO 스토리 키워드 브리지 {}건 themeId={} lang={}",
                        koKwBridged.size(), key, l);
                return take(koKwBridged, limit);
            }
            List<AudioGuideItem> geoBridged = tryKoGeoStoryBridge(l, key, limit);
            if (!geoBridged.isEmpty()) {
                log.info("[ODII] stories-by-theme: 좌표 근접 KO 스토리 브리지 {}건 themeId={} lang={}",
                        geoBridged.size(), key, l);
                return take(geoBridged, limit);
            }
            List<AudioGuideItem> locBridged = tryKoStoryLocationApiBridge(l, key, limit);
            if (!locBridged.isEmpty()) {
                log.info("[ODII] stories-by-theme: storyLocation KO 브리지 {}건 themeId={} lang={}",
                        locBridged.size(), key, l);
                return take(locBridged, limit);
            }
        }
        return List.of();
    }

    /**
     * 테마 제목 힌트로 KO·EN 테마 키워드 검색 → 나온 tid 를 브리지 후보에 넣어 zh/ja 테마와 다른 KO tid 에 묶인 스토리까지 잡는다.
     */
    private void appendKoThemeIdsFromThemeKeywordSearch(List<String> hints, Set<String> bridgeThemeCandidates, String uiLang) {
        if (hints == null || hints.isEmpty()) {
            return;
        }
        int perKw = 40;
        List<String> queryLangs = new ArrayList<>(Arrays.asList("ko", "en"));
        if ("zh".equals(uiLang) || "ja".equals(uiLang)) {
            queryLangs.add(uiLang);
        }
        for (String queryLang : queryLangs) {
            for (String sub : hints) {
                if (sub.length() < 2) {
                    continue;
                }
                List<AudioGuideItem> themes = fetchByKeyword(AudioGuideItem.Type.THEME, queryLang, sub, perKw);
                for (AudioGuideItem t : themes) {
                    String tid = nullIfBlank(t.getId());
                    if (tid != null) {
                        bridgeThemeCandidates.add(tid.trim());
                    }
                }
                if (bridgeThemeCandidates.size() > 320) {
                    return;
                }
            }
        }
    }

    /** KO 스토리 검색으로 후보를 모은 뒤 tid 또는 제목 일치분을 현재 언어 스토리 레코드로 브리지한다. */
    private List<AudioGuideItem> storiesFromKoKeywordBridge(
            List<String> hints,
            Collection<String> bridgeThemeCandidates,
            String targetLang,
            int limit,
            int kwLimit) {
        if (hints == null || hints.isEmpty() || "ko".equals(targetLang)) {
            return List.of();
        }
        Map<String, AudioGuideItem> mergedKo = new LinkedHashMap<>();
        for (String sub : hints) {
            if (sub.length() < 2) {
                continue;
            }
            List<AudioGuideItem> kw = fetchByKeyword(AudioGuideItem.Type.STORY, "ko", sub, kwLimit);
            for (AudioGuideItem s : kw) {
                mergedKo.putIfAbsent(s.getId(), s);
            }
            if (mergedKo.size() >= 480) {
                break;
            }
        }
        if (mergedKo.isEmpty()) {
            for (String sub : hints) {
                if (sub.length() < 2) {
                    continue;
                }
                List<AudioGuideItem> kwLoc = fetchByKeyword(AudioGuideItem.Type.STORY, targetLang, sub, kwLimit);
                for (AudioGuideItem s : kwLoc) {
                    mergedKo.putIfAbsent(s.getId(), s);
                }
                if (mergedKo.size() >= 320) {
                    break;
                }
            }
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<String> orderedIds = new ArrayList<>();
        for (AudioGuideItem s : mergedKo.values()) {
            if (!storyThemeMatchesAnyCandidate(s.getThemeId(), bridgeThemeCandidates)) {
                continue;
            }
            String sid = s.getId();
            if (sid == null || sid.isBlank()) {
                continue;
            }
            if (seen.add(sid)) {
                orderedIds.add(sid);
            }
        }
        if (orderedIds.isEmpty()) {
            for (String sub : hints) {
                if (sub.length() < 2) {
                    continue;
                }
                for (AudioGuideItem s : mergedKo.values()) {
                    if (!storyItemTextContains(s, sub)) {
                        continue;
                    }
                    String sid = s.getId();
                    if (sid == null || sid.isBlank()) {
                        continue;
                    }
                    if (seen.add(sid)) {
                        orderedIds.add(sid);
                    }
                }
                if (!orderedIds.isEmpty()) {
                    break;
                }
            }
        }
        if (orderedIds.isEmpty()) {
            return List.of();
        }
        ensureFullStoryCacheForJoin("ko");
        CacheSnapshot koSnap = cache.get(allKey(AudioGuideItem.Type.STORY, "ko"));
        return bridgeKoOrderedStoryIdsToTargetLang(koSnap, orderedIds, targetLang, limit);
    }

    /** 테마 좌표 주변 KO 스토리(좌표 있는 항목)를 거리순으로 고른 뒤 대상 언어로 브리지한다. */
    private List<AudioGuideItem> tryKoGeoStoryBridge(String canonicalLang, String themeId, int limit) {
        if ("ko".equals(canonicalLang)) {
            return List.of();
        }
        AudioGuideItem anchorTheme = findCachedThemeForBridge(canonicalLang, themeId.trim());
        if (anchorTheme == null || anchorTheme.getLatitude() == null || anchorTheme.getLongitude() == null) {
            return List.of();
        }
        double lat = anchorTheme.getLatitude();
        double lng = anchorTheme.getLongitude();
        ensureFullStoryCacheForJoin("ko");
        CacheSnapshot koSnap = cache.get(allKey(AudioGuideItem.Type.STORY, "ko"));
        if (koSnap == null || koSnap.sites.isEmpty()) {
            return List.of();
        }
        int pool = Math.max(limit * 8, 80);
        for (double rKm : new double[]{0.6, 1.2, 2.5, 6.0, 15.0}) {
            List<String> geoIds = koStoryIdsNearCoordinates(lat, lng, rKm, pool);
            if (geoIds.isEmpty()) {
                continue;
            }
            List<AudioGuideItem> bridged = bridgeKoOrderedStoryIdsToTargetLang(koSnap, geoIds, canonicalLang, limit);
            if (!bridged.isEmpty()) {
                return bridged;
            }
        }
        return List.of();
    }

    private List<String> koStoryIdsNearCoordinates(double lat, double lng, double radiusKm, int maxIds) {
        ensureFullStoryCacheForJoin("ko");
        CacheSnapshot koSnap = cache.get(allKey(AudioGuideItem.Type.STORY, "ko"));
        if (koSnap == null || koSnap.sites.isEmpty()) {
            return List.of();
        }
        List<AudioGuideItem> hits = new ArrayList<>();
        for (AudioGuideItem s : koSnap.sites) {
            if (s.getLatitude() == null || s.getLongitude() == null) {
                continue;
            }
            String sid = nullIfBlank(s.getId());
            if (sid == null) {
                continue;
            }
            if (haversineKm(lat, lng, s.getLatitude(), s.getLongitude()) <= radiusKm) {
                hits.add(s);
            }
        }
        hits.sort(Comparator.comparingDouble(s -> haversineKm(lat, lng, s.getLatitude(), s.getLongitude())));
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (AudioGuideItem s : hits) {
            if (seen.add(s.getId()) && out.size() < maxIds) {
                out.add(s.getId());
            }
        }
        return out;
    }

    /**
     * 전역 캐시 스토리에 좌표가 비어 있어도, Odii storyLocationBasedList 로 근처 KO 스토리를 받아 브리지한다.
     * 풀 캐시에 없는 id 가 나오면 근접 API 행을 KO 원문으로 두고 타깃 언어 레코드만 교체한다.
     */
    private List<AudioGuideItem> tryKoStoryLocationApiBridge(String canonicalLang, String themeId, int limit) {
        if ("ko".equals(canonicalLang)) {
            return List.of();
        }
        AudioGuideItem anchor = findCachedThemeForBridge(canonicalLang, themeId.trim());
        if (anchor == null || anchor.getLatitude() == null || anchor.getLongitude() == null) {
            return List.of();
        }
        double lat = anchor.getLatitude();
        double lng = anchor.getLongitude();
        ensureFullStoryCacheForJoin("ko");
        CacheSnapshot koSnap = cache.get(allKey(AudioGuideItem.Type.STORY, "ko"));
        if (koSnap == null || koSnap.sites.isEmpty()) {
            return List.of();
        }
        int want = Math.max(limit * 14, 96);
        for (int radiusM : new int[]{600, 1800, 5000, 14000}) {
            List<AudioGuideItem> near = fetchNearby(AudioGuideItem.Type.STORY, "ko", lat, lng, radiusM, want);
            if (near == null || near.isEmpty()) {
                continue;
            }
            List<String> ids = new ArrayList<>();
            LinkedHashSet<String> seenIds = new LinkedHashSet<>();
            for (AudioGuideItem s : near) {
                String id = nullIfBlank(s.getId());
                if (id != null && seenIds.add(id.trim())) {
                    ids.add(id.trim());
                }
            }
            if (ids.isEmpty()) {
                continue;
            }
            List<AudioGuideItem> bridged = bridgeKoOrderedStoryIdsToTargetLang(koSnap, ids, canonicalLang, limit);
            if (!bridged.isEmpty()) {
                return bridged;
            }
            List<AudioGuideItem> direct = bridgeDirectKoRowsToTargetLang(near, canonicalLang, limit);
            if (!direct.isEmpty()) {
                return direct;
            }
        }
        return List.of();
    }

    /** storyLocation 응답 행을 id 순으로 타깃 언어 스토리로 바꾼다. 매칭 없으면 KO 행 유지. */
    private List<AudioGuideItem> bridgeDirectKoRowsToTargetLang(List<AudioGuideItem> koNearRows, String targetLang, int limit) {
        if (koNearRows == null || koNearRows.isEmpty()) {
            return List.of();
        }
        ensureFullStoryCacheForJoin(targetLang);
        CacheSnapshot locSnap = cache.get(allKey(AudioGuideItem.Type.STORY, targetLang));
        if (locSnap == null || locSnap.sites.isEmpty()) {
            return take(koNearRows, limit);
        }
        Map<String, AudioGuideItem> localizedById = locSnap.sites.stream()
                .collect(Collectors.toMap(AudioGuideItem::getId, s -> s, (a, b) -> a));
        Map<Long, AudioGuideItem> localizedByNumericStoryId = new HashMap<>();
        for (AudioGuideItem s : locSnap.sites) {
            String rawId = s.getId();
            if (rawId == null) {
                continue;
            }
            String nid = rawId.trim();
            if (nid.matches("\\d+")) {
                try {
                    localizedByNumericStoryId.putIfAbsent(Long.parseLong(nid), s);
                } catch (NumberFormatException ignored) {
                    /* noop */
                }
            }
        }
        List<AudioGuideItem> out = new ArrayList<>();
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        for (AudioGuideItem ko : koNearRows) {
            String sid = nullIfBlank(ko.getId());
            if (sid == null || !seen.add(sid.trim())) {
                continue;
            }
            String tid = sid.trim();
            AudioGuideItem hit = localizedById.get(tid);
            if (hit == null && tid.matches("\\d+")) {
                try {
                    hit = localizedByNumericStoryId.get(Long.parseLong(tid));
                } catch (NumberFormatException ignored) {
                    /* noop */
                }
            }
            out.add(hit != null ? hit : ko);
            if (out.size() >= limit) {
                break;
            }
        }
        return take(out, limit);
    }

    /**
     * KO 캐시에서 정해진 스토리 id 순서를 현재 언어 레코드로 바꾼다. 없으면 KO 레코드를 그대로 반환한다.
     */
    private List<AudioGuideItem> bridgeKoOrderedStoryIdsToTargetLang(
            CacheSnapshot koSnap, List<String> orderedStoryIds, String targetLang, int limit) {
        if (koSnap == null || koSnap.sites == null || orderedStoryIds == null || orderedStoryIds.isEmpty()) {
            return List.of();
        }
        ensureFullStoryCacheForJoin(targetLang);
        CacheSnapshot locSnap = cache.get(allKey(AudioGuideItem.Type.STORY, targetLang));
        if (locSnap == null || locSnap.sites.isEmpty()) {
            return koStoriesByOrderedIds(koSnap, orderedStoryIds, limit);
        }
        Map<String, AudioGuideItem> localizedById = locSnap.sites.stream()
                .collect(Collectors.toMap(AudioGuideItem::getId, s -> s, (a, b) -> a));
        Map<Long, AudioGuideItem> localizedByNumericStoryId = new HashMap<>();
        for (AudioGuideItem s : locSnap.sites) {
            String rawId = s.getId();
            if (rawId == null) {
                continue;
            }
            String nid = rawId.trim();
            if (nid.matches("\\d+")) {
                try {
                    localizedByNumericStoryId.putIfAbsent(Long.parseLong(nid), s);
                } catch (NumberFormatException ignored) {
                    /* noop */
                }
            }
        }
        List<AudioGuideItem> out = new ArrayList<>();
        for (String sid : orderedStoryIds) {
            AudioGuideItem hit = sid != null ? localizedById.get(sid) : null;
            if (hit == null && sid != null && sid.trim().matches("\\d+")) {
                try {
                    hit = localizedByNumericStoryId.get(Long.parseLong(sid.trim()));
                } catch (NumberFormatException ignored) {
                    /* noop */
                }
            }
            if (hit != null) {
                out.add(hit);
            }
        }
        if (out.isEmpty()) {
            return koStoriesByOrderedIds(koSnap, orderedStoryIds, limit);
        }
        return take(out, limit);
    }

    /** 현재 언어 THEME 캐시에서 카드 id 로 행을 찾아 좌표 브리지에 사용한다. */
    private AudioGuideItem findCachedThemeForBridge(String canonicalLang, String themeId) {
        String tk = allKey(AudioGuideItem.Type.THEME, canonicalLang);
        CacheSnapshot snap = cache.get(tk);
        if (snap == null || snap.partial || snap.sites == null || snap.sites.isEmpty()) {
            refreshAll(AudioGuideItem.Type.THEME, canonicalLang);
            snap = cache.get(tk);
        }
        if (snap == null || snap.sites.isEmpty()) {
            return null;
        }
        String trimmed = themeId.trim();
        return snap.sites.stream()
                .filter(t -> themeIdMatches(t.getId(), trimmed))
                .findFirst()
                .orElse(null);
    }

    /** 좌표 근처 KO THEME 의 tid 를 후보 집합에 더한다 (언어별 테마 tid 불일치 보완). */
    private void appendKoThemeIdsNearCoordinates(double lat, double lng, double radiusKm, Set<String> out) {
        String kk = allKey(AudioGuideItem.Type.THEME, "ko");
        CacheSnapshot snap = cache.get(kk);
        if (snap == null || snap.partial || snap.sites == null || snap.sites.isEmpty()) {
            refreshAll(AudioGuideItem.Type.THEME, "ko");
            snap = cache.get(kk);
        }
        if (snap == null || snap.sites.isEmpty()) {
            return;
        }
        for (AudioGuideItem t : snap.sites) {
            String tid = nullIfBlank(t.getId());
            if (tid == null || t.getLatitude() == null || t.getLongitude() == null) {
                continue;
            }
            if (haversineKm(lat, lng, t.getLatitude(), t.getLongitude()) <= radiusKm) {
                out.add(tid.trim());
            }
        }
    }

    private static boolean storyThemeMatchesAnyCandidate(String storyThemeId, Collection<String> candidateThemeIds) {
        if (storyThemeId == null || candidateThemeIds == null || candidateThemeIds.isEmpty()) {
            return false;
        }
        for (String tid : candidateThemeIds) {
            if (themeIdMatches(storyThemeId, tid)) {
                return true;
            }
        }
        return false;
    }

    /**
     * KO STORY 캐시에서 후보 themeId 들 중 하나라도 상위 tid 와 맞는 스토리 id 순서를 유지한 채,
     * 대상 언어 STORY 캐시에서 같은 id 레코드를 붙인다.
     */
    private List<AudioGuideItem> storiesByThemeBridgedViaKoIds(Collection<String> candidateThemeIds, String targetLang, int limit) {
        if (candidateThemeIds == null || candidateThemeIds.isEmpty()) {
            return List.of();
        }
        ensureFullStoryCacheForJoin("ko");
        CacheSnapshot koSnap = cache.get(allKey(AudioGuideItem.Type.STORY, "ko"));
        if (koSnap == null || koSnap.sites.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> seen = new LinkedHashSet<>();
        List<String> orderedStoryIds = new ArrayList<>();
        for (AudioGuideItem s : koSnap.sites) {
            if (s.getThemeId() == null || s.getThemeId().isBlank()) {
                continue;
            }
            if (!storyThemeMatchesAnyCandidate(s.getThemeId(), candidateThemeIds)) {
                continue;
            }
            String sid = s.getId();
            if (sid == null || sid.isBlank()) {
                continue;
            }
            if (seen.add(sid)) {
                orderedStoryIds.add(sid);
            }
        }
        if (orderedStoryIds.isEmpty()) {
            return List.of();
        }
        return bridgeKoOrderedStoryIdsToTargetLang(koSnap, orderedStoryIds, targetLang, limit);
    }

    /** KO 브리지에서 만든 id 순서대로 KO STORY 레코드만 반환한다 (zh/ja 레코드 부재 시 폴백). */
    private List<AudioGuideItem> koStoriesByOrderedIds(CacheSnapshot koSnap, List<String> orderedStoryIds, int limit) {
        if (koSnap == null || koSnap.sites == null || orderedStoryIds == null || orderedStoryIds.isEmpty()) {
            return List.of();
        }
        Map<String, AudioGuideItem> koById = koSnap.sites.stream()
                .collect(Collectors.toMap(AudioGuideItem::getId, s -> s, (a, b) -> a));
        List<AudioGuideItem> out = new ArrayList<>();
        for (String sid : orderedStoryIds) {
            if (sid == null || sid.isBlank()) {
                continue;
            }
            AudioGuideItem k = koById.get(sid);
            if (k != null) {
                out.add(k);
            }
        }
        return take(out, limit);
    }

    /**
     * THEME 제목 힌트를 storySearchList 용 키워드 후보로 쪼갠다.
     * "A → B → C" 코스 명, 쉼표 구분, 공백 단어 등 Odii 검색·부분 일치에 쓴다.
     */
    private static List<String> deriveStoryTitleHints(String themeTitleHint) {
        if (themeTitleHint == null || themeTitleHint.isBlank()) {
            return List.of();
        }
        String h = themeTitleHint.trim().replace('\u00A0', ' ');
        LinkedHashSet<String> acc = new LinkedHashSet<>();
        acc.add(h);
        for (String segment : h.split("\\s*[→➝＞>]\\s*")) {
            String s = segment.trim();
            if (s.length() >= 2) {
                acc.add(s);
            }
        }
        for (String segment : h.split("[,，]+")) {
            String s = segment.trim();
            if (s.length() >= 2) {
                acc.add(s);
            }
        }
        for (String segment : h.split("\\s+")) {
            String s = segment.trim();
            if (s.length() >= 3) {
                acc.add(s);
            }
        }
        List<String> out = new ArrayList<>(acc);
        out.sort((a, b) -> Integer.compare(b.length(), a.length()));
        return out;
    }

    private static boolean storyItemTextContains(AudioGuideItem s, String fragment) {
        if (fragment == null || fragment.length() < 2) {
            return false;
        }
        String t = (s.getTitle() != null ? s.getTitle() : "")
                + " "
                + (s.getAudioTitle() != null ? s.getAudioTitle() : "");
        return t.contains(fragment);
    }

    /**
     * THEME↔STORY 조인은 전체 STORY 목록이 필요하다. partial 캐시(첫 페이지만)에서는 조인이 틀어진다.
     */
    private void ensureFullStoryCacheForJoin(String lang) {
        String l = normalize(lang);
        String cacheKey = allKey(AudioGuideItem.Type.STORY, l);
        CacheSnapshot snap = cache.get(cacheKey);
        if (snap != null && !snap.partial && !snap.sites.isEmpty()) {
            return;
        }
        if (snap != null && snap.partial) {
            log.info("[ODII] STORY 캐시 partial ({}건) — stories-by-theme 위해 전체 동기 적재", snap.sites.size());
        } else if (snap == null) {
            log.info("[ODII] STORY 캐시 없음 — stories-by-theme 위해 전체 동기 적재");
        } else {
            log.info("[ODII] STORY 캐시 비어 있음 — stories-by-theme 위해 전체 동기 적재 재시도");
        }
        refreshAll(AudioGuideItem.Type.STORY, l);
        /*
         * langCode 프로브가 한 번 잘못 캐시되면 STORY 풀이 영구 0건이 될 수 있다.
         * 비한국어에서 전체 적재 후에도 0건이면 프로브 캐시를 지우고 한 번 더 받는다.
         */
        if (!"ko".equals(l)) {
            CacheSnapshot after = cache.get(cacheKey);
            if (after != null && !after.partial && after.sites.isEmpty()) {
                String lk = langResolvedCacheKey(AudioGuideItem.Type.STORY, l);
                resolvedOdiiQueryLangByCanonical.remove(lk);
                log.info("[ODII] STORY:{} 전체 0건 — langCode 프로브 캐시 제거 후 재적재", l);
                refreshAll(AudioGuideItem.Type.STORY, l);
            }
        }
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

    private void refreshAll(AudioGuideItem.Type type, String lang) {
        String cacheKey = allKey(type, lang);
        synchronized (monitorFor(cacheKey)) {
            CacheSnapshot existing = cache.get(cacheKey);
            if (existing != null && !existing.partial && !isStale(existing)) {
                return;
            }
            List<AudioGuideItem> sites = requestAllPages(basedUrl(type), Map.of(), type, lang, MAX_PAGES_ALL);
            if (sites == null) {
                log.warn("[ODII] type={} lang={} 전체 로드 실패 - 캐시 유지", type, lang);
                return;
            }
            if (sites.isEmpty()) {
                log.warn("[ODII] type={} lang={} 전체 0건 — Odii 오류·키·할당량 가능성. 빈 목록은 캐시하지 않음(다음 요청에서 재시도).",
                        type, lang);
                return;
            }
            cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
            log.info("[ODII] type={} lang={} 전체 캐시 갱신 - {} 건", type, lang, sites.size());
        }
    }

    private void refreshByKeyword(AudioGuideItem.Type type, String lang, String keyword, String cacheKey) {
        synchronized (monitorFor(cacheKey)) {
            CacheSnapshot existing = cache.get(cacheKey);
            if (existing != null && !existing.partial && !isStale(existing)) {
                return;
            }
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

        int extraPages = totalPages - 1;
        if (extraPages <= 0) {
            return Collections.unmodifiableList(acc);
        }

        @SuppressWarnings("unchecked")
        CompletableFuture<PageResult>[] futures = new CompletableFuture[extraPages];
        for (int i = 0; i < extraPages; i++) {
            final int pageNo = i + 2;
            futures[i] = CompletableFuture.supplyAsync(
                    () -> requestPage(baseUrl, extraParams, type, lang, pageNo),
                    ODII_PAGE_FETCH_POOL);
        }
        CompletableFuture.allOf(futures).join();

        for (int i = 0; i < extraPages; i++) {
            PageResult pr = futures[i].join();
            if (pr == null || pr.items.isEmpty()) {
                log.warn("[ODII] type={} lang={} page={} 빈/실패 - 지금까지 {}건으로 마감",
                        type, lang, i + 2, acc.size());
                break;
            }
            acc.addAll(pr.items);
        }
        log.info("[ODII] type={} lang={} 페이지 순회 완료 - totalCount={} 로드={} (maxPages={})",
                type, lang, totalCount, acc.size(), maxPages);
        return Collections.unmodifiableList(acc);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams,
                                   AudioGuideItem.Type type, String canonicalLang, int pageNo) {
        return requestPage(baseUrl, extraParams, type, canonicalLang, pageNo, MAX_PAGE_SIZE, null);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams,
                                   AudioGuideItem.Type type, String canonicalLang, int pageNo, int rows) {
        return requestPage(baseUrl, extraParams, type, canonicalLang, pageNo, rows, null);
    }

    /**
     * @param explicitLangCode 프로브용 고정 langCode. null 이면 {@link #resolveOdiiQueryLangForRequest}.
     */
    private PageResult requestPage(String baseUrl, Map<String, String> extraParams,
                                   AudioGuideItem.Type type, String canonicalLang, int pageNo, int rows,
                                   String explicitLangCode) {
        String qLang = explicitLangCode != null ? explicitLangCode : resolveOdiiQueryLangForRequest(type, canonicalLang);
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json");
        sb.append("&MobileOS=ETC");
        sb.append("&MobileApp=touraz-dvdholic");
        sb.append("&numOfRows=").append(rows);
        sb.append("&pageNo=").append(pageNo);
        sb.append("&langCode=").append(qLang);
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

        if (parsed == null || parsed.getResponse() == null) {
            return new PageResult(List.of(), 0);
        }
        VisitKoreaOdiiResponse.Header apiHeader = parsed.getResponse().getHeader();
        if (apiHeader != null && apiHeader.getResultCode() != null
                && !"0000".equals(apiHeader.getResultCode().trim())) {
            log.warn("[ODII] resultCode={} resultMsg={} type={} page={} lang={} langCode={}",
                    apiHeader.getResultCode(), apiHeader.getResultMsg(),
                    type, pageNo, canonicalLang, qLang);
        }
        if (parsed.getResponse().getBody() == null) {
            log.warn("[ODII] response.body=null type={} page={} lang={} langCode={}",
                    type, pageNo, canonicalLang, qLang);
            return new PageResult(List.of(), 0);
        }

        VisitKoreaOdiiResponse.Body body = parsed.getResponse().getBody();
        int totalCount = body.getTotalCount() != null ? body.getTotalCount() : 0;

        if (body.getItems() == null || body.getItems().getItem() == null) {
            return new PageResult(List.of(), totalCount);
        }

        List<AudioGuideItem> list = body.getItems().getItem().stream()
                .map(item -> toDomain(item, type))
                .filter(VisitKoreaOdiiHttpClient::isRenderableOdiiItem)
                .collect(Collectors.toList());
        return new PageResult(list, totalCount);
    }

    /**
     * 공공 GW 가 허용하는 {@code langCode} 표기가 엔드포인트·버전별로 달라질 수 있어,
     * ko 는 고정이고 en/zh/ja 는 목록 1페이지로 프로브한다.
     * 프로브가 전부 실패한 값은 캐시하지 않는다(실패 시 기본 chs/jpn/eng 만 요청에 사용).
     */
    private String resolveOdiiQueryLangForRequest(AudioGuideItem.Type type, String canonicalLang) {
        if (canonicalLang == null || canonicalLang.isBlank()) {
            return "ko";
        }
        String canon = normalize(canonicalLang);
        return switch (canon) {
            case "ko" -> "ko";
            case "en", "zh", "ja" -> {
                String cacheKey = langResolvedCacheKey(type, canon);
                String cached = resolvedOdiiQueryLangByCanonical.get(cacheKey);
                if (cached != null && !cached.isBlank()) {
                    yield cached;
                }
                String probed = probeOdiiLangCodeSuccessful(type, canon);
                if (probed != null) {
                    resolvedOdiiQueryLangByCanonical.put(cacheKey, probed);
                    yield probed;
                }
                yield switch (canon) {
                    case "zh" -> "chs";
                    case "ja" -> "jpn";
                    case "en" -> "eng";
                    default -> "ko";
                };
            }
            default -> "ko";
        };
    }

    private static String langResolvedCacheKey(AudioGuideItem.Type type, String canonicalLang) {
        return type.name() + ":" + canonicalLang;
    }

    /**
     * 공공데이터포털 Odii GW 가 허용하는 langCode 표기(예: eng, jpn, chs, cht)를 우선 시도한다.
     * 후보가 모두 실패하면 {@code null} — 호출부에서 명세 기본값만 쓰고 캐시하지 않는다.
     */
    private String probeOdiiLangCodeSuccessful(AudioGuideItem.Type type, String canonical) {
        String base = basedUrl(type);
        String[] candidates = switch (canonical) {
            case "en" -> new String[]{"eng", "en"};
            case "zh" -> new String[]{"chs", "cht", "zh", "cn", "cn1"};
            case "ja" -> new String[]{"jpn", "jp", "ja"};
            default -> new String[]{"ko"};
        };
        for (String code : candidates) {
            PageResult pr = requestPage(base, Map.of(), type, canonical, 1, MAX_PAGE_SIZE, code);
            if (pr != null && (pr.totalCount > 0 || !pr.items.isEmpty())) {
                log.info("[ODII] GW langCode 선택 canonical={} → {} (type={} totalCount={})",
                        canonical, code, type, pr.totalCount);
                return code;
            }
        }
        log.warn("[ODII] GW langCode 프로브 실패(캐시 안 함) canonical={} candidates={} type={}",
                canonical, Arrays.toString(candidates), type);
        return null;
    }

    // =========================================================================
    // Mapping
    // =========================================================================

    /** THEME 카드 id 와 STORY 의 tid/linkTid 정규 비교 (공백·대소문자·선행 0). */
    private static boolean themeIdMatches(String storyThemeId, String requestedThemeId) {
        if (storyThemeId == null || requestedThemeId == null) return false;
        String a = storyThemeId.trim();
        String b = requestedThemeId.trim();
        if (a.isEmpty() || b.isEmpty()) return false;
        if (a.equals(b)) return true;
        if (a.equalsIgnoreCase(b)) return true;
        try {
            if (a.matches("\\d+") && b.matches("\\d+") && Long.parseLong(a) == Long.parseLong(b)) {
                return true;
            }
        } catch (NumberFormatException ignored) {
            /* noop */
        }
        return false;
    }

    private static boolean isRenderableOdiiItem(AudioGuideItem s) {
        return s != null
                && nullIfBlank(s.getId()) != null
                && nullIfBlank(s.getTitle()) != null;
    }

    /**
     * THEME: 자기 {@code tid}.
     * STORY(Odii storyBasedList 명세): 보통 {@code tid}=상위 관광지(THEME) id, {@code stid}=이야기 id.
     * {@code linkTid} 는 분리 필드로만 오는 경우 보조로 사용한다(link 를 무조건 우선하면 GW 버전에 따라 조인이 깨질 수 있음).
     */
    private static String resolveThemeIdForDomain(VisitKoreaOdiiResponse.Item i, AudioGuideItem.Type type) {
        if (type == AudioGuideItem.Type.THEME) {
            return nullIfBlank(i.getTid());
        }
        String stid = nullIfBlank(i.getStid());
        String tid = nullIfBlank(i.getTid());
        String link = nullIfBlank(i.getLinkTid());
        if (stid != null && tid != null && !themeIdMatches(stid, tid)) {
            return tid;
        }
        if (link != null) {
            return link;
        }
        return tid;
    }

    private static AudioGuideItem toDomain(VisitKoreaOdiiResponse.Item i, AudioGuideItem.Type type) {
        Double lat = parseDouble(i.getMapY());
        Double lng = parseDouble(i.getMapX());
        String id = (type == AudioGuideItem.Type.STORY)
                ? (nullIfBlank(i.getStid()) != null ? i.getStid() : i.getTid())
                : (nullIfBlank(i.getTid()) != null ? i.getTid() : i.getStid());
        String themeRef = resolveThemeIdForDomain(i, type);
        String title = resolveOdiiItemTitle(i, id);
        return AudioGuideItem.builder()
                .id(id)
                .themeId(themeRef)
                .type(type)
                .title(title)
                .audioTitle(nullIfBlank(i.getAudioTitle()))
                .audioUrl(nullIfBlank(i.getAudioUrl()))
                .playTimeText(nullIfBlank(i.getPlayTimeText()))
                .description(nullIfBlank(i.getDescription()))
                .imageUrl(nullIfBlank(i.getImageUrl()))
                .address(combineAddress(i.getBaseAddr(), i.getDetailAddr()))
                .latitude(lat)
                .longitude(lng)
                .themeCategory(nullIfBlank(i.getThemeCategory()))
                .language(canonicalOdiiLang(nullIfBlank(i.getLangCode())))
                .build();
    }

    /**
     * 중·일 응답에서 {@code title} 대신 다른 필드만 채워지는 경우가 있어 카드·필터에서 전부 걸러지지 않게 한다.
     */
    private static String resolveOdiiItemTitle(VisitKoreaOdiiResponse.Item i, String id) {
        String t = firstNonBlankText(
                nullIfBlank(i.getTitle()),
                nullIfBlank(i.getAudioTitle()),
                nullIfBlank(i.getThemeCategory()));
        if (t != null) {
            return t;
        }
        String d = nullIfBlank(i.getDescription());
        if (d != null) {
            int nl = d.indexOf('\n');
            String line = (nl >= 0 ? d.substring(0, nl) : d).trim();
            if (!line.isBlank()) {
                return line.length() <= 100 ? line : line.substring(0, 97) + "…";
            }
        }
        if (nullIfBlank(id) != null) {
            return "(#" + id + ")";
        }
        return null;
    }

    private static String firstNonBlankText(String... parts) {
        for (String p : parts) {
            if (p != null && !p.isBlank()) {
                return p;
            }
        }
        return null;
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
        // 흔한 별칭 (포털·클라이언트 호환)
        n = switch (n) {
            case "cn", "chs", "cht", "zho" -> "zh";
            case "jp", "jpn" -> "ja";
            default -> n;
        };
        return SUPPORTED_LANGS.contains(n) ? n : "ko";
    }

    /** 응답 item 의 langCode 를 프런트·TTS 용 zh|ja|ko|en 으로 맞춤. */
    private static String canonicalOdiiLang(String code) {
        if (code == null || code.isBlank()) return null;
        String c = code.trim().toLowerCase(Locale.ROOT);
        if (c.equals("chs") || c.equals("cht") || c.equals("cn") || c.startsWith("zh")) return "zh";
        if (c.equals("jpn") || c.equals("jp") || c.startsWith("ja")) return "ja";
        if (c.equals("kor") || c.equals("ko")) return "ko";
        if (c.equals("eng") || c.equals("en")) return "en";
        return c;
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
