package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.DurunubiCourse;
import fast.campus.netplix.tour.DurunubiPort;
import fast.campus.netplix.tour.DurunubiRoute;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) HTTP 어댑터.
 *
 * <p>지원 오퍼레이션 (TourAPI Guide v4.1):
 * <ul>
 *   <li>{@code /courseList} — 코스 목록 정보 조회</li>
 *   <li>{@code /routeList}  — 길 목록 정보 조회</li>
 * </ul>
 *
 * <p>특징:
 * <ul>
 *   <li>(brdDiv|routeIdx|keyword) 키 단위로 in-memory TTL 캐시 (기본 6h)</li>
 *   <li>routeList 는 전국 단일 키로 캐시</li>
 *   <li>totalCount=0 시 {@code items:""} 응답을 {@code null} 로 치환해 파싱 실패 방지</li>
 *   <li>serviceKey 미설정 또는 URL 미설정 시 모든 조회가 빈 리스트 반환 (기동 계속)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaDurunubiHttpClient implements DurunubiPort {

    private static final int MAX_PAGE_SIZE = 100;

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.durunubi.course-list:}")
    private String courseListUrl;

    @Value("${visitkorea.durunubi.route-list:}")
    private String routeListUrl;

    @Value("${visitkorea.durunubi.cache-minutes:360}")
    private long cacheMinutes;

    private final Map<String, CacheEntry<DurunubiCourse>> courseCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry<DurunubiRoute>> routeCache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && courseListUrl != null && !courseListUrl.isBlank()
                && routeListUrl != null && !routeListUrl.isBlank();
    }

    @Override
    public List<DurunubiCourse> fetchCourses(String brdDiv, String routeIdx, String keyword, int limit) {
        if (!isConfigured()) return List.of();
        String key = nullSafe(brdDiv) + "|" + nullSafe(routeIdx) + "|" + nullSafe(keyword);
        long now = Instant.now().toEpochMilli();
        CacheEntry<DurunubiCourse> cached = courseCache.get(key);
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            return take(cached.items, limit);
        }
        List<DurunubiCourse> items = callCourseListApi(brdDiv, routeIdx, keyword);
        courseCache.put(key, new CacheEntry<>(items, now));
        return take(items, limit);
    }

    @Override
    public List<DurunubiRoute> fetchRoutes(int limit) {
        if (!isConfigured()) return List.of();
        long now = Instant.now().toEpochMilli();
        CacheEntry<DurunubiRoute> cached = routeCache.get("all");
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            return take(cached.items, limit);
        }
        List<DurunubiRoute> items = callRouteListApi();
        routeCache.put("all", new CacheEntry<>(items, now));
        return take(items, limit);
    }

    // -----------------------------
    // internal
    // -----------------------------

    private List<DurunubiCourse> callCourseListApi(String brdDiv, String routeIdx, String keyword) {
        Map<String, String> extras = Map.of(
                "brdDiv", nullSafe(brdDiv),
                "routeIdx", nullSafe(routeIdx),
                "crsKorNm", nullSafe(keyword)
        );
        VisitKoreaDurunubiResponse parsed = callApi(courseListUrl, extras);
        if (parsed == null) return List.of();

        List<DurunubiCourse> result = new ArrayList<>();
        for (VisitKoreaDurunubiResponse.Item i : safeItems(parsed)) {
            result.add(toCourse(i));
        }
        return Collections.unmodifiableList(result);
    }

    private List<DurunubiRoute> callRouteListApi() {
        VisitKoreaDurunubiResponse parsed = callApi(routeListUrl, Map.of());
        if (parsed == null) return List.of();

        List<DurunubiRoute> result = new ArrayList<>();
        for (VisitKoreaDurunubiResponse.Item i : safeItems(parsed)) {
            result.add(toRoute(i));
        }
        return Collections.unmodifiableList(result);
    }

    private VisitKoreaDurunubiResponse callApi(String baseUrl, Map<String, String> extraParams) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(baseUrl.contains("?") ? "&" : "?")
                .append("serviceKey=").append(serviceKey)
                .append("&_type=json")
                .append("&MobileOS=ETC")
                .append("&MobileApp=touraz-dvdholic")
                .append("&numOfRows=").append(MAX_PAGE_SIZE)
                .append("&pageNo=1");
        for (Map.Entry<String, String> e : extraParams.entrySet()) {
            if (e.getValue() == null || e.getValue().isBlank()) continue;
            url.append("&").append(e.getKey()).append("=")
                    .append(URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8));
        }

        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            raw = httpClient.request(url.toString(), HttpMethod.GET, headers, Map.of());
        } catch (Exception ex) {
            log.warn("[DURUNUBI] 호출 실패 url={} err={}", baseUrl, ex.getMessage());
            return null;
        }
        if (raw == null || raw.isBlank()) return null;

        try {
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            return ObjectMapperUtil.toObject(safe, VisitKoreaDurunubiResponse.class);
        } catch (Exception ex) {
            log.warn("[DURUNUBI] 파싱 실패 url={} err={} sample={}", baseUrl, ex.getMessage(),
                    raw.length() > 200 ? raw.substring(0, 200) : raw);
            return null;
        }
    }

    private static List<VisitKoreaDurunubiResponse.Item> safeItems(VisitKoreaDurunubiResponse parsed) {
        if (parsed.getResponse() == null) return List.of();
        if (parsed.getResponse().getBody() == null) return List.of();
        if (parsed.getResponse().getBody().getItems() == null) return List.of();
        List<VisitKoreaDurunubiResponse.Item> item = parsed.getResponse().getBody().getItems().getItem();
        return item == null ? List.of() : item;
    }

    private static DurunubiCourse toCourse(VisitKoreaDurunubiResponse.Item i) {
        return DurunubiCourse.builder()
                .crsIdx(i.getCrsIdx())
                .routeIdx(i.getRouteIdx())
                .crsKorNm(i.getCrsKorNm())
                .crsDstnc(i.getCrsDstnc())
                .crsLevel(i.getCrsLevel())
                .crsTotlRqrmHour(i.getCrsTotlRqrmHour())
                .crsCycle(i.getCrsCycle())
                .crsContents(i.getCrsContents())
                .crsTourInfo(i.getCrsTourInfo())
                .crsTravelerinfo(i.getCrsTravelerinfo())
                .sigun(i.getSigun())
                .cpnBgng(i.getCpnBgng())
                .cpnEnd(i.getCpnEnd())
                .gpxpath(i.getGpxpath())
                .brdDiv(i.getBrdDiv())
                .brdNm(i.getBrdNm())
                .build();
    }

    private static DurunubiRoute toRoute(VisitKoreaDurunubiResponse.Item i) {
        return DurunubiRoute.builder()
                .routeIdx(i.getRouteIdx())
                .brdDiv(i.getBrdDiv())
                .brdNm(i.getBrdNm())
                .themeNm(i.getThemeNm())
                .lnm(i.getLnm())
                .lnkgCourse(i.getLnkgCourse())
                .cpnBgng(i.getCpnBgng())
                .cpnEnd(i.getCpnEnd())
                .build();
    }

    private static String nullSafe(String v) { return v == null ? "" : v; }

    private static <T> List<T> take(List<T> list, int limit) {
        if (list == null || list.isEmpty()) return List.of();
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private record CacheEntry<T>(List<T> items, long loadedAtMs) {}
}
