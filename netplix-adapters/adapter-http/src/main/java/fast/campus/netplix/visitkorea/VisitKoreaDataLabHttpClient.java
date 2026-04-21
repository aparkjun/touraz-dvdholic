package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.VisitKoreaDataLabPort;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 한국관광공사 데이터랩 4개 Operation 을 호출해 지자체 지표 스냅샷을 조립한다.
 * - 호출량 제어를 위해 배치(매일 03:30) 에서만 호출되는 것을 전제한다.
 * - serviceKey 미설정 시 {@link #isConfigured()} 가 false 를 반환하며 배치는 no-op.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaDataLabHttpClient implements VisitKoreaDataLabPort {

    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.api.tour-demand-index:}")
    private String tourDemandIndexUrl;

    @Value("${visitkorea.api.tour-competitiveness:}")
    private String tourCompetitivenessUrl;

    @Value("${visitkorea.api.cultural-resource-demand:}")
    private String culturalResourceDemandUrl;

    @Value("${visitkorea.api.tour-search-volume:}")
    private String tourSearchVolumeUrl;

    @Value("${visitkorea.batch.page-size:100}")
    private int pageSize;

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank();
    }

    @Override
    public List<TourIndex> fetchIndicesForDate(LocalDate baseDate) {
        if (!isConfigured()) {
            log.warn("[VISITKOREA] serviceKey 미설정 - API 호출 건너뜀");
            return Collections.emptyList();
        }
        String ymd = baseDate.format(YMD);
        log.info("[VISITKOREA] fetchIndicesForDate baseYmd={}", ymd);

        // 지자체 단위로 병합용 맵. key = signguCode(없으면 areaCode).
        Map<String, TourIndex.TourIndexBuilder> merged = new HashMap<>();

        mergeOperation(merged, tourDemandIndexUrl, ymd, "TOUR_DEMAND");
        mergeOperation(merged, tourCompetitivenessUrl, ymd, "TOUR_COMPETITIVENESS");
        mergeOperation(merged, culturalResourceDemandUrl, ymd, "CULTURAL_RESOURCE_DEMAND");
        mergeOperation(merged, tourSearchVolumeUrl, ymd, "TOUR_SEARCH_VOLUME");

        List<TourIndex> result = new ArrayList<>(merged.size());
        for (Map.Entry<String, TourIndex.TourIndexBuilder> e : merged.entrySet()) {
            result.add(e.getValue().snapshotDate(baseDate).build());
        }
        log.info("[VISITKOREA] 병합 완료 - {} 개 지자체 스냅샷 생성", result.size());
        return result;
    }

    private void mergeOperation(Map<String, TourIndex.TourIndexBuilder> merged,
                                 String baseUrl,
                                 String baseYmd,
                                 String operation) {
        if (baseUrl == null || baseUrl.isBlank()) {
            log.warn("[VISITKOREA] {} URL 미설정 - 건너뜀", operation);
            return;
        }

        int pageNo = 1;
        while (true) {
            String url = buildUrl(baseUrl, baseYmd, pageNo);
            String rawResponse = safeRequest(url, operation);
            if (rawResponse == null) return;

            VisitKoreaDataLabResponse parsed;
            try {
                parsed = ObjectMapperUtil.toObject(rawResponse, VisitKoreaDataLabResponse.class);
            } catch (Exception ex) {
                log.error("[VISITKOREA] {} 파싱 실패 page={} err={}", operation, pageNo, ex.getMessage());
                return;
            }

            if (parsed == null
                    || parsed.getResponse() == null
                    || parsed.getResponse().getBody() == null
                    || parsed.getResponse().getBody().getItems() == null
                    || parsed.getResponse().getBody().getItems().getItem() == null) {
                log.info("[VISITKOREA] {} page={} empty 응답", operation, pageNo);
                return;
            }

            List<VisitKoreaDataLabResponse.Item> items = parsed.getResponse().getBody().getItems().getItem();
            for (VisitKoreaDataLabResponse.Item item : items) {
                String key = regionKey(item);
                if (key == null) continue;
                TourIndex.TourIndexBuilder builder = merged.computeIfAbsent(key, k -> newBuilder(item));
                applyOperationValues(builder, item, operation);
            }

            Integer total = parsed.getResponse().getBody().getTotalCount();
            int fetched = pageNo * pageSize;
            if (total == null || fetched >= total) return;
            pageNo++;
        }
    }

    private TourIndex.TourIndexBuilder newBuilder(VisitKoreaDataLabResponse.Item item) {
        return TourIndex.builder()
                .areaCode(regionKey(item))
                .regionName(composeRegionName(item));
    }

    private void applyOperationValues(TourIndex.TourIndexBuilder builder,
                                      VisitKoreaDataLabResponse.Item item,
                                      String operation) {
        switch (operation) {
            case "TOUR_DEMAND" -> {
                if (item.getTourDemandIdx() != null) builder.tourDemandIdx(item.getTourDemandIdx());
                if (item.getTourServiceDemand() != null) builder.tourServiceDemand(item.getTourServiceDemand());
                if (item.getTourResourceDemand() != null) builder.tourResourceDemand(item.getTourResourceDemand());
            }
            case "TOUR_COMPETITIVENESS" -> {
                if (item.getTourCompetitiveness() != null) builder.tourCompetitiveness(item.getTourCompetitiveness());
            }
            case "CULTURAL_RESOURCE_DEMAND" -> {
                if (item.getCulturalResourceDemand() != null) builder.culturalResourceDemand(item.getCulturalResourceDemand());
            }
            case "TOUR_SEARCH_VOLUME" -> {
                if (item.getSearchVolume() != null) builder.searchVolume(item.getSearchVolume());
            }
            default -> { /* no-op */ }
        }
    }

    private static String regionKey(VisitKoreaDataLabResponse.Item item) {
        if (item.getSignguCode() != null && !item.getSignguCode().isBlank()) return item.getSignguCode();
        if (item.getAreaCode() != null && !item.getAreaCode().isBlank()) return item.getAreaCode();
        return null;
    }

    private static String composeRegionName(VisitKoreaDataLabResponse.Item item) {
        String area = item.getAreaName() == null ? "" : item.getAreaName();
        String signgu = item.getSignguName() == null ? "" : item.getSignguName();
        String combined = (area + " " + signgu).trim();
        return combined.isBlank() ? item.getDaesoName() : combined;
    }

    private String buildUrl(String base, String baseYmd, int pageNo) {
        // 공공데이터포털 규약: 쿼리 스트링에 serviceKey + 공통 파라미터.
        char joiner = base.contains("?") ? '&' : '?';
        return base + joiner
                + "serviceKey=" + serviceKey
                + "&_type=json"
                + "&MobileOS=ETC"
                + "&MobileApp=touraz-dvdholic"
                + "&numOfRows=" + pageSize
                + "&pageNo=" + pageNo
                + "&baseYmd=" + baseYmd;
    }

    private String safeRequest(String url, String operation) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            return httpClient.request(url, HttpMethod.GET, headers, Map.of());
        } catch (Exception ex) {
            log.error("[VISITKOREA] {} 호출 실패 url={} err={}", operation, sanitize(url), ex.getMessage());
            return null;
        }
    }

    private String sanitize(String url) {
        if (url == null) return "";
        return url.replaceAll("serviceKey=[^&]+", "serviceKey=***");
    }
}
