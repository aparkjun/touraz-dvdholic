package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.RelatedTouristSpot;
import fast.campus.netplix.tour.RelatedTouristSpotPort;
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
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 한국관광공사 "관광지별 연관 관광지 정보"(TarRlteTarService1) 어댑터.
 *
 * <p>Base URL: {@code apis.data.go.kr/B551011/TarRlteTarService1}
 *
 * <p>중요: 이 API 의 두 오퍼레이션은 모두 {@code (baseYm, areaCd, signguCd)} 를 필수로 요구한다.
 * /searchKeyword1 도 마찬가지 — 키워드만으로는 호출 불가. 사용자가 단순 지명("여수")만 입력했을 때를
 * 위해 {@link KoreanPlaceCodes} 가 키워드를 BJD 코드 쌍으로 매핑한다.
 *
 * <p>baseYm 은 KTO 가 월 단위로 집계해 후행 공개하므로 호출 시점에 가용한 가장 최근 월을 자동
 * 탐색한다(현재 월 → 12 개월 전까지 단계적 폴백). 일일 트래픽 1,000 회 / 오퍼레이션 한도 보호용으로
 * (모드, 키) 단위 in-memory TTL 캐시를 유지한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaRelatedSpotHttpClient implements RelatedTouristSpotPort {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int BASE_YM_LOOKBACK_MONTHS = 12;
    private static final DateTimeFormatter YM = DateTimeFormatter.ofPattern("yyyyMM");

    private final HttpClient httpClient;

    @Value("${visitkorea.related.service-key:${visitkorea.auth.service-key:}}")
    private String serviceKey;

    @Value("${visitkorea.related.area-based:}")
    private String areaBasedUrl;

    @Value("${visitkorea.related.search-keyword:}")
    private String searchKeywordUrl;

    @Value("${visitkorea.related.cache-minutes:360}")
    private long cacheMinutes;

    /** key = mode|param1|param2|baseYm, value = (loadedAt, list). */
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && (notBlank(areaBasedUrl) || notBlank(searchKeywordUrl));
    }

    /**
     * 키워드 검색.
     *
     * <p>구현: 키워드를 {@link KoreanPlaceCodes} 로 해석해 (areaCd, signguCd) 를 얻은 뒤
     * /searchKeyword1 호출. 사전 미등록 키워드는 빈 결과를 반환한다(사용자가 지역을 직접 고르도록 유도).
     */
    @Override
    public List<RelatedTouristSpot> fetchByKeyword(String keyword, int limit) {
        if (!isConfigured() || keyword == null || keyword.isBlank()) return List.of();
        if (!notBlank(searchKeywordUrl)) return List.of();

        Optional<KoreanPlaceCodes.KoreanPlace> place = KoreanPlaceCodes.findByKeyword(keyword);
        if (place.isEmpty()) {
            log.debug("[KOR-RLT] 인기 지명 사전 미등록 keyword={}", keyword);
            return List.of();
        }

        KoreanPlaceCodes.KoreanPlace p = place.get();
        return fetchWithBaseYmFallback(
                "kw|" + keyword.trim() + "|" + p.areaCd() + "|" + p.signguCd(),
                ym -> {
                    Map<String, String> params = new LinkedHashMap<>();
                    params.put("baseYm", ym);
                    params.put("areaCd", p.areaCd());
                    params.put("signguCd", p.signguCd());
                    params.put("keyword", keyword.trim());
                    return callListApi(searchKeywordUrl, params);
                },
                limit
        );
    }

    /**
     * 광역 + 시군구 BJD 코드 기반 조회. signguCd 가 비어있으면 호출 불가(KTO 필수).
     */
    @Override
    public List<RelatedTouristSpot> fetchByArea(String areaCode, String signguCode, int limit) {
        if (!isConfigured()) return List.of();
        if (!notBlank(areaBasedUrl)) return List.of();
        if (areaCode == null || areaCode.isBlank()) return List.of();
        if (signguCode == null || signguCode.isBlank()) {
            log.debug("[KOR-RLT] signguCd 누락 — KTO areaBasedList1 은 시군구가 필수");
            return List.of();
        }

        return fetchWithBaseYmFallback(
                "area|" + areaCode.trim() + "|" + signguCode.trim(),
                ym -> {
                    Map<String, String> params = new LinkedHashMap<>();
                    params.put("baseYm", ym);
                    params.put("areaCd", areaCode.trim());
                    params.put("signguCd", signguCode.trim());
                    return callListApi(areaBasedUrl, params);
                },
                limit
        );
    }

    // -------------------- internal --------------------

    private List<RelatedTouristSpot> fetchWithBaseYmFallback(
            String cacheKeyPrefix,
            java.util.function.Function<String, List<RelatedTouristSpot>> caller,
            int limit
    ) {
        List<RelatedTouristSpot> cached = readCache(cacheKeyPrefix + "|*");
        if (cached != null) return take(cached, limit);

        YearMonth ym = YearMonth.now();
        List<RelatedTouristSpot> last = List.of();
        for (int i = 0; i < BASE_YM_LOOKBACK_MONTHS; i++) {
            String baseYm = ym.minusMonths(i).format(YM);
            List<RelatedTouristSpot> result = caller.apply(baseYm);
            if (result != null && !result.isEmpty()) {
                writeCache(cacheKeyPrefix + "|*", result);
                return take(result, limit);
            }
            last = result == null ? List.of() : result;
        }

        // 12개월 전까지 모두 비어있으면 빈 결과를 캐시(캐시 폭주 방지). TTL 후 재시도.
        writeCache(cacheKeyPrefix + "|*", last);
        return take(last, limit);
    }

    private List<RelatedTouristSpot> callListApi(String baseUrl, Map<String, String> extraParams) {
        String url = buildUrl(baseUrl, extraParams, MAX_PAGE_SIZE, 1);
        VisitKoreaRelatedSpotResponse parsed = fetchAndParse(url, baseUrl);
        if (parsed == null) return List.of();

        VisitKoreaRelatedSpotResponse.Items items = parsed.getResponse().getBody().getItems();
        if (items == null || items.getItem() == null) return List.of();

        List<RelatedTouristSpot> result = new ArrayList<>();
        for (VisitKoreaRelatedSpotResponse.Item i : items.getItem()) {
            result.add(toDomain(i));
        }
        return Collections.unmodifiableList(result);
    }

    private String buildUrl(String baseUrl, Map<String, String> extraParams, int numOfRows, int pageNo) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(baseUrl.contains("?") ? "&" : "?")
                .append("serviceKey=").append(serviceKey)
                .append("&_type=json")
                .append("&MobileOS=ETC")
                .append("&MobileApp=touraz-dvdholic")
                .append("&numOfRows=").append(numOfRows)
                .append("&pageNo=").append(Math.max(1, pageNo));
        for (Map.Entry<String, String> e : extraParams.entrySet()) {
            if (e.getValue() == null || e.getValue().isBlank()) continue;
            url.append("&").append(e.getKey()).append("=")
                    .append(URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8));
        }
        return url.toString();
    }

    private VisitKoreaRelatedSpotResponse fetchAndParse(String url, String baseUrl) {
        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            raw = httpClient.request(url, HttpMethod.GET, headers, Map.of());
        } catch (Exception ex) {
            log.warn("[KOR-RLT] 호출 실패 url={} err={}", baseUrl, ex.getMessage());
            return null;
        }
        if (raw == null || raw.isBlank()) return null;

        VisitKoreaRelatedSpotResponse parsed;
        try {
            // KTO 는 totalCount=0 일 때 items 를 빈 문자열("")로 내려준다 → null 로 사전 치환.
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaRelatedSpotResponse.class);
        } catch (Exception ex) {
            log.warn("[KOR-RLT] 파싱 실패 url={} err={} sample={}", baseUrl, ex.getMessage(),
                    raw.length() > 200 ? raw.substring(0, 200) : raw);
            return null;
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null) {
            return null;
        }
        return parsed;
    }

    private static RelatedTouristSpot toDomain(VisitKoreaRelatedSpotResponse.Item i) {
        return RelatedTouristSpot.builder()
                .areaCode(i.getAreaCd())
                .areaName(i.getAreaNm())
                .signguCode(i.getSignguCd())
                .signguName(i.getSignguNm())
                .tAtsNm(i.getTAtsNm())
                .rlteTatsNm(i.getRlteTatsNm())
                .rlteRegnCd(i.getRlteRegnCd())
                .rlteRegnNm(i.getRlteRegnNm())
                .rlteSignguCd(i.getRlteSignguCd())
                .rlteSignguNm(i.getRlteSignguNm())
                .rlteCtgryLclsNm(i.getRlteCtgryLclsNm())
                .rlteCtgryMclsNm(i.getRlteCtgryMclsNm())
                .rlteCtgrySclsNm(i.getRlteCtgrySclsNm())
                .rlteRank(parseInt(i.getRlteRank()))
                .hashtags(i.getHashtags())
                .build();
    }

    private static Integer parseInt(String s) {
        if (s == null || s.isBlank()) return null;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return null; }
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private List<RelatedTouristSpot> readCache(String key) {
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;
        long now = Instant.now().toEpochMilli();
        if (now - entry.loadedAtMs > Duration.ofMinutes(cacheMinutes).toMillis()) {
            cache.remove(key);
            return null;
        }
        return entry.items;
    }

    private void writeCache(String key, List<RelatedTouristSpot> items) {
        cache.put(key, new CacheEntry(items, Instant.now().toEpochMilli()));
    }

    private static <T> List<T> take(List<T> list, int limit) {
        if (list == null || list.isEmpty()) return List.of();
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private record CacheEntry(List<RelatedTouristSpot> items, long loadedAtMs) {}
}
