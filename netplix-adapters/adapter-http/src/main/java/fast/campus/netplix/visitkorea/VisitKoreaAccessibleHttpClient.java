package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.AccessiblePoi;
import fast.campus.netplix.tour.AccessiblePoiPort;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국관광공사 무장애 여행정보(KorWithService2) HTTP 어댑터.
 *
 * <p>특징:
 * <ul>
 *   <li>areaBased/locationBased/searchKeyword 3종 + detailWithTour 1종 호출 지원</li>
 *   <li>(areaCode + contentTypeId) 키 단위로 in-memory TTL 캐시 (기본 6h)</li>
 *   <li>totalCount=0 케이스의 {@code items:""} 응답을 사전 치환하여 파싱 실패 방지</li>
 *   <li>serviceKey 미설정 또는 URL 미설정 시 모든 조회가 빈 리스트를 반환 (기동 계속)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaAccessibleHttpClient implements AccessiblePoiPort {

    private static final int MAX_PAGE_SIZE = 50;

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.access.area-based:}")
    private String areaBasedUrl;

    @Value("${visitkorea.access.location-based:}")
    private String locationBasedUrl;

    @Value("${visitkorea.access.search-keyword:}")
    private String searchKeywordUrl;

    @Value("${visitkorea.access.detail-common:}")
    private String detailCommonUrl;

    @Value("${visitkorea.access.detail-info:}")
    private String detailInfoUrl;

    /** Legacy(v1) 호환 — 필요 시 fallback 용도. 기본값은 비어있다. */
    @Value("${visitkorea.access.detail-with-tour:}")
    private String detailWithTourUrl;

    @Value("${visitkorea.access.cache-minutes:360}")
    private long cacheMinutes;

    /** key = areaCode|contentTypeId, value = (loadedAt, list) */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && areaBasedUrl != null && !areaBasedUrl.isBlank();
    }

    @Override
    public List<AccessiblePoi> fetchByArea(String areaCode, String contentTypeId, int limit) {
        if (!isConfigured()) return List.of();
        String key = (areaCode == null ? "_" : areaCode) + "|" + (contentTypeId == null ? "_" : contentTypeId);
        CacheEntry cached = cache.get(key);
        long now = Instant.now().toEpochMilli();
        if (cached != null && (now - cached.loadedAtMs) < Duration.ofMinutes(cacheMinutes).toMillis()) {
            return take(cached.items, limit);
        }
        List<AccessiblePoi> items = callListApi(areaBasedUrl, Map.of(
                "areaCode", nullSafe(areaCode),
                "contentTypeId", nullSafe(contentTypeId),
                "arrange", "Q" // 이미지가 있는 데이터 우선
        ));
        cache.put(key, new CacheEntry(items, now));
        return take(items, limit);
    }

    /**
     * KorWithService2 상세 조회.
     * <ol>
     *   <li>{@code detailCommon2} 로 overview/홈페이지 등 공통 정보를 얻고,</li>
     *   <li>{@code detailInfo2} 로 장애유형별 편의시설(반복정보)을 병합한다.</li>
     * </ol>
     * v1 레거시인 {@code detailWithTour2} 는 KTO 가 더 이상 서비스하지 않으므로
     * 명시적 설정이 없으면 건너뛴다.
     */
    @Override
    public Optional<AccessiblePoi> fetchDetail(String contentId, String contentTypeId) {
        if (!isConfigured() || contentId == null || contentId.isBlank()) return Optional.empty();

        Optional<AccessiblePoi> common = Optional.empty();
        if (detailCommonUrl != null && !detailCommonUrl.isBlank()) {
            List<AccessiblePoi> items = callListApi(detailCommonUrl, Map.of(
                    "contentId", contentId,
                    "contentTypeId", nullSafe(contentTypeId)
            ));
            common = items.stream().findFirst();
        }

        Map<String, String> infoMap = Collections.emptyMap();
        if (detailInfoUrl != null && !detailInfoUrl.isBlank()) {
            infoMap = callInfoApi(detailInfoUrl, Map.of(
                    "contentId", contentId,
                    "contentTypeId", nullSafe(contentTypeId)
            ));
        }

        if (common.isEmpty() && infoMap.isEmpty()) {
            if (detailWithTourUrl != null && !detailWithTourUrl.isBlank()) {
                return callListApi(detailWithTourUrl, Map.of(
                        "contentId", contentId,
                        "contentTypeId", nullSafe(contentTypeId)
                )).stream().findFirst();
            }
            return Optional.empty();
        }

        AccessiblePoi base = common.orElseGet(() -> AccessiblePoi.builder()
                .contentId(contentId)
                .contentTypeId(contentTypeId)
                .build());
        if (infoMap.isEmpty()) return Optional.of(base);
        return Optional.of(base.toBuilder().accessibilityDetail(infoMap).build());
    }

    @Override
    public List<AccessiblePoi> fetchByLocation(double mapX, double mapY, int radius,
                                               String contentTypeId, int limit) {
        if (!isConfigured()) return List.of();
        if (locationBasedUrl == null || locationBasedUrl.isBlank()) return List.of();
        List<AccessiblePoi> items = callListApi(locationBasedUrl, Map.of(
                "mapX", String.valueOf(mapX),
                "mapY", String.valueOf(mapY),
                "radius", String.valueOf(Math.max(100, Math.min(radius, 20000))),
                "contentTypeId", nullSafe(contentTypeId),
                "arrange", "E" // 거리순
        ));
        return take(items, limit);
    }

    @Override
    public List<AccessiblePoi> fetchByKeyword(String keyword, String contentTypeId, int limit) {
        if (!isConfigured() || keyword == null || keyword.isBlank()) return List.of();
        if (searchKeywordUrl == null || searchKeywordUrl.isBlank()) return List.of();
        List<AccessiblePoi> items = callListApi(searchKeywordUrl, Map.of(
                "keyword", keyword,
                "contentTypeId", nullSafe(contentTypeId)
        ));
        return take(items, limit);
    }

    // -----------------------------
    // internal
    // -----------------------------

    private List<AccessiblePoi> callListApi(String baseUrl, Map<String, String> extraParams) {
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
            log.warn("[KOR-WITH] 호출 실패 url={} err={}", baseUrl, ex.getMessage());
            return List.of();
        }
        if (raw == null || raw.isBlank()) return List.of();

        VisitKoreaAccessibleResponse parsed;
        try {
            // items 가 빈 문자열로 내려오는 KTO 관례 대응
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaAccessibleResponse.class);
        } catch (Exception ex) {
            log.warn("[KOR-WITH] 파싱 실패 url={} err={} sample={}", baseUrl, ex.getMessage(),
                    raw.length() > 200 ? raw.substring(0, 200) : raw);
            return List.of();
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null
                || parsed.getResponse().getBody().getItems() == null
                || parsed.getResponse().getBody().getItems().getItem() == null) {
            return List.of();
        }

        List<AccessiblePoi> result = new ArrayList<>();
        for (VisitKoreaAccessibleResponse.Item i : parsed.getResponse().getBody().getItems().getItem()) {
            result.add(toDomain(i));
        }
        return Collections.unmodifiableList(result);
    }

    /**
     * {@code detailInfo2} 응답을 infoname → infotext 맵으로 변환한다.
     * KTO 가 편의시설 항목을 계속 확장하더라도 UI 가 그대로 렌더링할 수 있도록
     * 필드 매핑을 하지 않고 원문을 보존한다.
     */
    private Map<String, String> callInfoApi(String baseUrl, Map<String, String> extraParams) {
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
            log.warn("[KOR-WITH] detailInfo 호출 실패 url={} err={}", baseUrl, ex.getMessage());
            return Collections.emptyMap();
        }
        if (raw == null || raw.isBlank()) return Collections.emptyMap();

        VisitKoreaAccessibleResponse parsed;
        try {
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaAccessibleResponse.class);
        } catch (Exception ex) {
            log.warn("[KOR-WITH] detailInfo 파싱 실패 err={}", ex.getMessage());
            return Collections.emptyMap();
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null
                || parsed.getResponse().getBody().getItems() == null
                || parsed.getResponse().getBody().getItems().getItem() == null) {
            return Collections.emptyMap();
        }

        Map<String, String> result = new LinkedHashMap<>();
        for (VisitKoreaAccessibleResponse.Item i : parsed.getResponse().getBody().getItems().getItem()) {
            String k = i.getInfoname();
            String v = i.getInfotext();
            if (k == null || k.isBlank()) continue;
            if (v == null) v = "";
            result.merge(k.trim(), v.trim(), (a, b) -> a.isBlank() ? b : (b.isBlank() ? a : a + " / " + b));
        }
        return result;
    }

    private static AccessiblePoi toDomain(VisitKoreaAccessibleResponse.Item i) {
        return AccessiblePoi.builder()
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
                .parkingAccessible(i.getParkingleisure())
                .restroomAccessible(i.getRestroom())
                .wheelchairRental(i.getWheelchair())
                .elevatorAccessible(i.getElevator())
                .blindHandicapEtc(i.getBlindhandicapetc())
                .hearingHandicapEtc(i.getHearinghandicapetc())
                .auditoriumAccessible(i.getAuditorium())
                .publicTransport(i.getPublictransport())
                .signGuide(i.getSignguide())
                .videoGuide(i.getVideoguide())
                .brailleBlock(i.getBraileblock())
                .helpDog(i.getHelpdog())
                .strollerRental(i.getStroller())
                .lactationRoom(i.getLactationroom())
                .babySparechair(i.getBabysparechair())
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

    private record CacheEntry(List<AccessiblePoi> items, long loadedAtMs) {}
}
