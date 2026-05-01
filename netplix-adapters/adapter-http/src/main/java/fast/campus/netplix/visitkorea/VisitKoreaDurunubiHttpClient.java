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
import java.util.Locale;
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
 *   <li>courseList / routeList 는 {@code totalCount} 기준 전 페이지 누적 수집 (단일 페이지 100건 제한 제거)</li>
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
    /** courseList 전 페이지 순회 시 안전 상한 (100페이지 × 100건). */
    private static final int MAX_COURSE_LIST_PAGES = 100;
    /** 코스 누적 상한 — 비정상 응답 루프 방지. */
    private static final int HARD_COURSE_CAP = 10_000;
    /** routeList 순회 상한. */
    private static final int MAX_ROUTE_LIST_PAGES = 30;
    private static final int HARD_ROUTE_CAP = 3_000;

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
    public List<DurunubiCourse> fetchCourses(String brdDiv, String routeIdx, String keyword, String areaCode, int limit) {
        if (!isConfigured()) return List.of();
        // areaCode 는 캐시 키에 포함하지 않는다: 업스트림 호출은 (brdDiv|routeIdx|keyword) 단위로만 하고
        // areaCode 는 메모리 내 후필터 — 호출량을 늘리지 않으면서 지역 브릿지 기능을 제공한다.
        String key = nullSafe(brdDiv) + "|" + nullSafe(routeIdx) + "|" + nullSafe(keyword);
        long now = Instant.now().toEpochMilli();
        CacheEntry<DurunubiCourse> cached = courseCache.get(key);
        List<DurunubiCourse> source;
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            source = cached.items;
        } else {
            source = fetchAllCourseListPages(brdDiv, routeIdx, keyword);
            courseCache.put(key, new CacheEntry<>(source, now));
            log.info("[DURUNUBI] courseList 캐시 갱신 key={} courses={}", key, source.size());
        }
        return take(filterByAreaCode(source, areaCode), limit);
    }

    @Override
    public List<DurunubiRoute> fetchRoutes(int limit) {
        if (!isConfigured()) return List.of();
        long now = Instant.now().toEpochMilli();
        CacheEntry<DurunubiRoute> cached = routeCache.get("all");
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            return take(cached.items, limit);
        }
        List<DurunubiRoute> items = fetchAllRouteListPages();
        routeCache.put("all", new CacheEntry<>(items, now));
        log.info("[DURUNUBI] routeList 캐시 갱신 routes={}", items.size());
        return take(items, limit);
    }

    // -----------------------------
    // internal
    // -----------------------------

    private List<DurunubiCourse> fetchAllCourseListPages(String brdDiv, String routeIdx, String keyword) {
        Map<String, String> extras = Map.of(
                "brdDiv", nullSafe(brdDiv),
                "routeIdx", nullSafe(routeIdx),
                "crsKorNm", nullSafe(keyword)
        );
        List<DurunubiCourse> all = new ArrayList<>();
        int pageNo = 1;
        int totalCount = -1;
        while (pageNo <= MAX_COURSE_LIST_PAGES) {
            VisitKoreaDurunubiResponse parsed = callApi(courseListUrl, extras, pageNo);
            if (parsed == null) break;
            VisitKoreaDurunubiResponse.Body body = parsed.getResponse() != null ? parsed.getResponse().getBody() : null;
            if (body == null) break;
            if (totalCount < 0 && body.getTotalCount() != null) {
                totalCount = body.getTotalCount();
            }
            List<VisitKoreaDurunubiResponse.Item> page = body.getItems() != null ? body.getItems().getItem() : null;
            if (page == null || page.isEmpty()) break;
            for (VisitKoreaDurunubiResponse.Item i : page) {
                all.add(toCourse(i));
                if (all.size() >= HARD_COURSE_CAP) break;
            }
            if (all.size() >= HARD_COURSE_CAP) break;
            if (page.size() < MAX_PAGE_SIZE) break;
            if (totalCount >= 0 && all.size() >= totalCount) break;
            pageNo++;
        }
        return Collections.unmodifiableList(all);
    }

    private List<DurunubiRoute> fetchAllRouteListPages() {
        List<DurunubiRoute> all = new ArrayList<>();
        int pageNo = 1;
        int totalCount = -1;
        while (pageNo <= MAX_ROUTE_LIST_PAGES) {
            VisitKoreaDurunubiResponse parsed = callApi(routeListUrl, Map.of(), pageNo);
            if (parsed == null) break;
            VisitKoreaDurunubiResponse.Body body = parsed.getResponse() != null ? parsed.getResponse().getBody() : null;
            if (body == null) break;
            if (totalCount < 0 && body.getTotalCount() != null) {
                totalCount = body.getTotalCount();
            }
            List<VisitKoreaDurunubiResponse.Item> page = body.getItems() != null ? body.getItems().getItem() : null;
            if (page == null || page.isEmpty()) break;
            for (VisitKoreaDurunubiResponse.Item i : page) {
                all.add(toRoute(i));
                if (all.size() >= HARD_ROUTE_CAP) break;
            }
            if (all.size() >= HARD_ROUTE_CAP) break;
            if (page.size() < MAX_PAGE_SIZE) break;
            if (totalCount >= 0 && all.size() >= totalCount) break;
            pageNo++;
        }
        return Collections.unmodifiableList(all);
    }

    private VisitKoreaDurunubiResponse callApi(String baseUrl, Map<String, String> extraParams, int pageNo) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(baseUrl.contains("?") ? "&" : "?")
                .append("serviceKey=").append(serviceKey)
                .append("&_type=json")
                .append("&MobileOS=ETC")
                .append("&MobileApp=touraz-dvdholic")
                .append("&numOfRows=").append(MAX_PAGE_SIZE)
                .append("&pageNo=").append(Math.max(1, pageNo));
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

    /**
     * 한국관광공사 광역시도 areaCode(1~39) 를 두루누비 {@code sigun} 필드의 광역 접두어로 매핑.
     * 두루누비 응답의 {@code sigun} 은 "부산 남구", "경남 창원시" 와 같이 "광역 약칭 + 공백 + 시군구"
     * 형태이므로 접두어(또는 contains) 매칭만으로 99% 정확한 광역 필터가 가능하다.
     */
    private static final Map<String, String[]> AREA_CODE_TO_SIGUN_PREFIX = Map.ofEntries(
            Map.entry("1",  new String[]{"서울"}),
            Map.entry("2",  new String[]{"인천"}),
            Map.entry("3",  new String[]{"대전"}),
            Map.entry("4",  new String[]{"대구"}),
            Map.entry("5",  new String[]{"광주"}),
            Map.entry("6",  new String[]{"부산"}),
            Map.entry("7",  new String[]{"울산"}),
            Map.entry("8",  new String[]{"세종"}),
            Map.entry("31", new String[]{"경기"}),
            Map.entry("32", new String[]{"강원"}),
            Map.entry("33", new String[]{"충북", "충청북도"}),
            Map.entry("34", new String[]{"충남", "충청남도"}),
            Map.entry("35", new String[]{"전북", "전라북도"}),
            Map.entry("36", new String[]{"전남", "전라남도"}),
            Map.entry("37", new String[]{"경북", "경상북도"}),
            Map.entry("38", new String[]{"경남", "경상남도"}),
            Map.entry("39", new String[]{"제주"})
    );

    private static List<DurunubiCourse> filterByAreaCode(List<DurunubiCourse> src, String areaCode) {
        if (src == null || src.isEmpty()) return List.of();
        if (areaCode == null || areaCode.isBlank()) return src;
        String[] prefixes = AREA_CODE_TO_SIGUN_PREFIX.get(areaCode.trim());
        if (prefixes == null || prefixes.length == 0) return src;
        List<DurunubiCourse> out = new ArrayList<>();
        for (DurunubiCourse c : src) {
            String sigun = c.getSigun();
            if (sigun == null || sigun.isBlank()) continue;
            String norm = sigun.trim().toLowerCase(Locale.ROOT);
            for (String p : prefixes) {
                if (norm.startsWith(p.toLowerCase(Locale.ROOT)) || norm.contains(p.toLowerCase(Locale.ROOT))) {
                    out.add(c);
                    break;
                }
            }
        }
        return out;
    }

    private static <T> List<T> take(List<T> list, int limit) {
        if (list == null || list.isEmpty()) return List.of();
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private record CacheEntry<T>(List<T> items, long loadedAtMs) {}
}
