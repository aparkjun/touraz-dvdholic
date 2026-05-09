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
 * 한국관광공사 데이터랩 Operation 들을 호출해 지자체 지표 스냅샷을 조립한다.
 * - 호출량 제어를 위해 배치(매일 03:30) 에서만 호출되는 것을 전제한다.
 * - serviceKey 미설정 시 {@link #isConfigured()} 가 false 를 반환하며 배치는 no-op.
 *
 * 확인된 오퍼레이션 (Base: DataLabService)
 *   - metcoRegnVisitrDDList : 광역 지자체 일별 방문자수 (필수: startYmd, endYmd) — 활성
 *   - locgoRegnVisitrDDList : 기초 지자체 일별 방문자수 (필수: startYmd, endYmd) — 비활성
 * 참고: 아래 오퍼레이션은 Base URL 확인됐으나 현 시점 데이터셋 적재가 끝나지 않아(totalCount=0) 통합 보류.
 *   - AreaTarResDemService/{areaTarSvcDemList, areaCulResDemList}  : 지역별 관광 자원 수요
 *   - AreaTarDivService/{areaIntlDivList, …}                       : 지역별 관광 다양성
 *   - TatsCnctrRateService                                         : 관광지 집중률 방문자 추이 예측 (op 미확정)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaDataLabHttpClient implements VisitKoreaDataLabPort {

    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

    // 외지인(관광객) 구분 코드. 1=현지인, 2=외지인, 3=외국인. "진짜 관광객" 신호로 2 만 사용.
    private static final String TOURIST_DIV_OUTSIDER = "2";

    /**
     * KTO DataLab 이 내려주는 areaCode 는 법정동 광역코드(lDongRegnCd / 앞 2자리) 이다.
     * 반면 CineTrip 매핑 테이블(movie_region_mappings.area_code) 과 프론트 필터는
     * KorService2 areaCode(1~8, 31~39) 를 사용한다. 서로 다른 두 체계로 인해 조인이
     * 실패하면 {@code regionIndices} 가 항상 빈 배열로 응답돼 큐레이션 품질이 떨어진다.
     *
     * <p>아래 표는 <code>lDongRegnCd → KorService2 areaCode</code> 방향. 강원/전북은
     * 구 코드(42, 45)와 특별자치도 코드(51, 52) 모두 대응한다. 누락 시 원본 코드를
     * 그대로 저장 (후속 시각화에서 식별 가능).
     */
    private static final Map<String, String> LDONG_TO_AREA_CODE = Map.ofEntries(
            Map.entry("11", "1"),   // 서울
            Map.entry("26", "6"),   // 부산
            Map.entry("27", "4"),   // 대구
            Map.entry("28", "2"),   // 인천
            Map.entry("29", "5"),   // 광주
            Map.entry("30", "3"),   // 대전
            Map.entry("31", "7"),   // 울산
            Map.entry("36", "8"),   // 세종
            Map.entry("41", "31"),  // 경기
            Map.entry("42", "32"),  // 강원 (구 코드)
            Map.entry("43", "33"),  // 충북
            Map.entry("44", "34"),  // 충남
            Map.entry("45", "35"),  // 전북 (구 코드)
            Map.entry("46", "36"),  // 전남
            Map.entry("47", "37"),  // 경북
            Map.entry("48", "38"),  // 경남
            Map.entry("50", "39"),  // 제주
            Map.entry("51", "32"),  // 강원특별자치도
            Map.entry("52", "35")   // 전북특별자치도
    );

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
        log.info("[VISITKOREA] fetchIndicesForDate startYmd={} endYmd={}", ymd, ymd);

        // 지자체 단위로 병합용 맵. key = signguCode(없으면 areaCode).
        Map<String, TourIndex.TourIndexBuilder> merged = new HashMap<>();

        // 의미: tour-demand-index = METCO(광역) 방문자수 — 확인됨
        mergeOperation(merged, tourDemandIndexUrl, ymd, ymd, "METCO_VISITORS");
        // 의미: tour-competitiveness = LOCGO(기초) 방문자수 — 확인됨
        mergeOperation(merged, tourCompetitivenessUrl, ymd, ymd, "LOCGO_VISITORS");
        // Base URL 미확정 — 설정에 URL 비어 있으면 자동 스킵
        mergeOperation(merged, culturalResourceDemandUrl, ymd, ymd, "CULTURAL_RESOURCE_DEMAND");
        mergeOperation(merged, tourSearchVolumeUrl, ymd, ymd, "TOUR_SERVICE_DEMAND");

        List<TourIndex> result = new ArrayList<>(merged.size());
        for (Map.Entry<String, TourIndex.TourIndexBuilder> e : merged.entrySet()) {
            result.add(e.getValue().snapshotDate(baseDate).build());
        }
        log.info("[VISITKOREA] 병합 완료 - {} 개 지자체 스냅샷 생성", result.size());
        return result;
    }

    private void mergeOperation(Map<String, TourIndex.TourIndexBuilder> merged,
                                 String baseUrl,
                                 String startYmd,
                                 String endYmd,
                                 String operation) {
        if (baseUrl == null || baseUrl.isBlank()) {
            log.warn("[VISITKOREA] {} URL 미설정 - 건너뜀", operation);
            return;
        }

        int pageNo = 1;
        while (true) {
            String url = buildUrl(baseUrl, startYmd, endYmd, pageNo);
            String rawResponse = safeRequest(url, operation);
            if (rawResponse == null) return;

            VisitKoreaDataLabResponse parsed;
            try {
                // KTO API 는 "데이터 없음" 응답에서 items 를 객체가 아닌 빈 문자열("")로 내려보내
                // Jackson 이 실패한다. 객체로 역직렬화 가능하도록 사전 치환.
                String safe = rawResponse == null ? null
                        : rawResponse.replace("\"items\":\"\"", "\"items\":null");
                parsed = ObjectMapperUtil.toObject(safe, VisitKoreaDataLabResponse.class);
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
            case "METCO_VISITORS", "LOCGO_VISITORS" -> {
                // touDivCd=2(외지인) 행만 반영해 "관광객 규모" 프록시로 사용.
                // searchVolume(원시 방문자수) 과 tourDemandIdx(수요지수 프록시) 양쪽에 채워
                // CineTripService / 프론트 시각화 모두에서 비어있지 않도록 한다.
                if (TOURIST_DIV_OUTSIDER.equals(item.getTouristDivCode()) && item.getTouristCount() != null) {
                    int visitors = item.getTouristCount().intValue();
                    builder.searchVolume(visitors);
                    builder.tourDemandIdx((double) visitors);
                }
            }
            case "TOUR_SERVICE_DEMAND" -> {
                if (item.getTourServiceDemand() != null) builder.tourServiceDemand(item.getTourServiceDemand());
                if (item.getTourCompetitiveness() != null) builder.tourCompetitiveness(item.getTourCompetitiveness());
            }
            case "CULTURAL_RESOURCE_DEMAND" -> {
                if (item.getCulturalResourceDemand() != null) builder.culturalResourceDemand(item.getCulturalResourceDemand());
            }
            default -> { /* no-op */ }
        }
    }

    private static String regionKey(VisitKoreaDataLabResponse.Item item) {
        // signguCode(5자리 기초지자체) 는 광역 기준 조인과 맞지 않아 현재 단계에서는 사용하지 않는다.
        // locgoRegnVisitrDDList 를 재활성화할 때는 앞 2자리 추출 후 광역으로 집계하는 로직 추가 필요.
        if (item.getAreaCode() != null && !item.getAreaCode().isBlank()) {
            String raw = item.getAreaCode().trim();
            // KTO → KorService2 변환. 매핑 없는 코드는 원본 유지 (예: 향후 새 지역 추가 대비).
            return LDONG_TO_AREA_CODE.getOrDefault(raw, raw);
        }
        if (item.getSignguCode() != null && !item.getSignguCode().isBlank()) {
            String sig = item.getSignguCode().trim();
            if (sig.length() >= 2) {
                String prefix = sig.substring(0, 2);
                return LDONG_TO_AREA_CODE.getOrDefault(prefix, prefix);
            }
            return sig;
        }
        return null;
    }

    private static String composeRegionName(VisitKoreaDataLabResponse.Item item) {
        String area = item.getAreaName() == null ? "" : item.getAreaName();
        String signgu = item.getSignguName() == null ? "" : item.getSignguName();
        String combined = (area + " " + signgu).trim();
        return combined.isBlank() ? item.getDaesoName() : combined;
    }

    private String buildUrl(String base, String startYmd, String endYmd, int pageNo) {
        // 한국관광공사 DataLabService 규약: serviceKey + MobileOS + MobileApp + startYmd + endYmd + 페이징.
        // baseYmd 는 받지 않으며 startYmd == endYmd 로 당일 단일 스냅샷 조회.
        char joiner = base.contains("?") ? '&' : '?';
        return base + joiner
                + "serviceKey=" + serviceKey
                + "&_type=json"
                + "&MobileOS=ETC"
                + "&MobileApp=touraz-dvdholic"
                + "&numOfRows=" + pageSize
                + "&pageNo=" + pageNo
                + "&startYmd=" + startYmd
                + "&endYmd=" + endYmd;
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
