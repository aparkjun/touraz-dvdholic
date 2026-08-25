package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.ChsTourPoi;
import fast.campus.netplix.tour.ChsTourPort;
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
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국관광공사 중문(간체) 관광정보(ChsService2) HTTP 어댑터.
 *
 * <p>{@link VisitKoreaEngHttpClient}/{@link VisitKoreaJpnHttpClient} 와 동일한 구조/캐시 전략을
 * 의도적으로 따른다. 응답 포맷 또한 KTO 다국어 서비스가 공유하는 envelope 이므로
 * {@link VisitKoreaEngResponse} 를 그대로 재사용한다.
 *
 * <ul>
 *   <li>(areaCode + contentTypeId) 키로 in-memory TTL 캐시 (기본 6h).</li>
 *   <li>totalCount=0 케이스의 {@code items:""} 응답을 사전 치환하여 Jackson 파싱 실패를 방지.</li>
 *   <li>serviceKey/URL 미설정 시 모든 조회가 빈 리스트를 반환 (로컬 개발 환경에서도 기동 유지).</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaChsHttpClient implements ChsTourPort {

    private static final int MAX_PAGE_SIZE = 50;

    private final HttpClient httpClient;

    @Value("${visitkorea.chs.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.chs.area-based:}")
    private String areaBasedUrl;

    @Value("${visitkorea.chs.location-based:}")
    private String locationBasedUrl;

    @Value("${visitkorea.chs.search-keyword:}")
    private String searchKeywordUrl;

    @Value("${visitkorea.chs.detail-common:}")
    private String detailCommonUrl;

    @Value("${visitkorea.chs.cache-minutes:360}")
    private long cacheMinutes;

    /** key = areaCode|contentTypeId, value = (loadedAt, list) */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    /**
     * KorService2 → ChsService2 contentTypeId 치환 테이블.
     *
     * <p>KTO 다국어 서비스(Eng/Jpn/Chs…)는 국문과 별도의 공통 타입 체계를 쓴다. 프론트엔드가 locale
     * 토글만으로 같은 파라미터(type=12 등)를 재사용할 수 있도록, 국문 코드가 들어오면 다국어 코드로
     * 선제 변환한다. 값이 이미 다국어 코드(또는 알 수 없는 코드)면 그대로 전달한다.
     */
    private static final Map<String, String> KOR_TO_CHS_CONTENT_TYPE = Map.of(
            "12", "76", // 观光地
            "14", "78", // 文化设施
            "15", "85", // 庆典/活动
            "25", "75", // 旅行路线
            "28", "77", // 休闲运动
            "32", "80", // 住宿
            "38", "79", // 购物
            "39", "82"  // 美食
    );

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && areaBasedUrl != null && !areaBasedUrl.isBlank();
    }

    @Override
    public List<ChsTourPoi> fetchByArea(String areaCode, String contentTypeId, int limit) {
        if (!isConfigured()) return List.of();
        String chsType = toChsContentType(contentTypeId);
        String key = (areaCode == null ? "_" : areaCode) + "|" + (chsType == null ? "_" : chsType);
        CacheEntry cached = cache.get(key);
        long now = Instant.now().toEpochMilli();
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            return take(cached.items, limit);
        }
        List<ChsTourPoi> items = callListApi(areaBasedUrl, Map.of(
                "areaCode", nullSafe(areaCode),
                "contentTypeId", nullSafe(chsType),
                "arrange", "Q" // 이미지가 있는 데이터 우선
        ));
        cache.put(key, new CacheEntry(items, now));
        return take(items, limit);
    }

    @Override
    public List<ChsTourPoi> fetchByLocation(double mapX, double mapY, int radius,
                                            String contentTypeId, int limit) {
        if (!isConfigured()) return List.of();
        if (locationBasedUrl == null || locationBasedUrl.isBlank()) return List.of();
        List<ChsTourPoi> items = callListApi(locationBasedUrl, Map.of(
                "mapX", String.valueOf(mapX),
                "mapY", String.valueOf(mapY),
                "radius", String.valueOf(Math.max(100, Math.min(radius, 20000))),
                "contentTypeId", nullSafe(toChsContentType(contentTypeId)),
                "arrange", "E" // 거리순
        ));
        return take(items, limit);
    }

    @Override
    public List<ChsTourPoi> fetchByKeyword(String keyword, String contentTypeId, int limit) {
        if (!isConfigured() || keyword == null || keyword.isBlank()) return List.of();
        if (searchKeywordUrl == null || searchKeywordUrl.isBlank()) return List.of();
        List<ChsTourPoi> items = callListApi(searchKeywordUrl, Map.of(
                "keyword", keyword,
                "contentTypeId", nullSafe(toChsContentType(contentTypeId))
        ));
        return take(items, limit);
    }

    @Override
    public Optional<ChsTourPoi> fetchDetail(String contentId, String contentTypeId) {
        if (!isConfigured() || contentId == null || contentId.isBlank()) return Optional.empty();
        if (detailCommonUrl == null || detailCommonUrl.isBlank()) return Optional.empty();
        List<ChsTourPoi> items = callListApi(detailCommonUrl, Map.of(
                "contentId", contentId,
                "contentTypeId", nullSafe(toChsContentType(contentTypeId))
        ));
        return items.stream().findFirst();
    }

    /**
     * 국문 KorService2 의 contentTypeId 가 들어오면 ChsService2 체계로 변환.
     * 이미 다국어 체계 값이거나 매핑되지 않는 값은 원문 그대로 반환.
     */
    private static String toChsContentType(String korOrForeign) {
        if (korOrForeign == null || korOrForeign.isBlank()) return korOrForeign;
        String trimmed = korOrForeign.trim();
        return KOR_TO_CHS_CONTENT_TYPE.getOrDefault(trimmed, trimmed);
    }

    // -----------------------------
    // internal
    // -----------------------------

    private List<ChsTourPoi> callListApi(String baseUrl, Map<String, String> extraParams) {
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
            log.warn("[CHS-TOUR] 호출 실패 url={} err={}", baseUrl, ex.getMessage());
            return List.of();
        }
        if (raw == null || raw.isBlank()) return List.of();

        VisitKoreaEngResponse parsed;
        try {
            // items 가 빈 문자열로 내려오는 KTO 관례 대응
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaEngResponse.class);
        } catch (Exception ex) {
            log.warn("[CHS-TOUR] 파싱 실패 url={} err={} sample={}", baseUrl, ex.getMessage(),
                    raw.length() > 200 ? raw.substring(0, 200) : raw);
            return List.of();
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null
                || parsed.getResponse().getBody().getItems() == null
                || parsed.getResponse().getBody().getItems().getItem() == null) {
            return List.of();
        }

        List<ChsTourPoi> result = new ArrayList<>();
        for (VisitKoreaEngResponse.Item i : parsed.getResponse().getBody().getItems().getItem()) {
            result.add(toDomain(i));
        }
        return Collections.unmodifiableList(result);
    }

    private static ChsTourPoi toDomain(VisitKoreaEngResponse.Item i) {
        return ChsTourPoi.builder()
                .contentId(i.getContentid())
                .contentTypeId(i.getContenttypeid())
                .title(i.getTitle())
                .addr1(i.getAddr1())
                .addr2(i.getAddr2())
                .areaCode(i.getAreacode())
                .sigunguCode(i.getSigungucode())
                .firstImage(i.getFirstimage())
                .firstImageThumb(i.getFirstimage2() != null ? i.getFirstimage2() : i.getFirstimage())
                .tel(i.getTel())
                .mapX(parseD(i.getMapx()))
                .mapY(parseD(i.getMapy()))
                .overview(i.getOverview())
                .homepage(i.getHomepage())
                .distance(i.getDist())
                .build();
    }

    private static Double parseD(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Double.parseDouble(s); } catch (NumberFormatException e) { return null; }
    }

    private static String nullSafe(String v) { return v == null ? "" : v; }

    private static <T> List<T> take(List<T> list, int limit) {
        if (list == null || list.isEmpty()) return List.of();
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private record CacheEntry(List<ChsTourPoi> items, long loadedAtMs) {}
}
