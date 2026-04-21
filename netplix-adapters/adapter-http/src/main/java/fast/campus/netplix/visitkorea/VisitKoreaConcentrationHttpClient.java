package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.TourConcentrationPort;
import fast.campus.netplix.tour.TourConcentrationPrediction;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 한국관광공사 관광지 집중률 방문자 추이 예측 HTTP 어댑터.
 * (TatsCnctrRateService / tatsCnctrRatedList, 공공데이터 15128555)
 *
 * <p>특성상 "오늘 + 향후 N일" 예측이라 동일 (areaCd, signguCd, spotName) 쿼리는 일 단위로만
 * 새로운 값이 나온다. 따라서 어댑터 레벨에서 (key → CacheEntry) 로 6h TTL 캐싱.
 *
 * <p>KorService2 areaCode (1~8, 31~39) ↔ KTO lDongRegnCd (11, 26, ...) 변환은
 * {@link VisitKoreaPhokoHttpClient} 와 동일한 매핑 표를 공유하도록 별도 상수로 복제.
 * (공통 유틸로 추출해도 되지만 두 곳 외에 수요가 없어 중복 허용.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaConcentrationHttpClient implements TourConcentrationPort {

    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final long CACHE_TTL_MS = 6L * 60 * 60 * 1000; // 6시간

    // KorService2 areaCode → 법정동 광역코드(lDongRegnCd).
    private static final Map<String, String> AREA_CODE_TO_LDONG = Map.ofEntries(
            Map.entry("1", "11"),
            Map.entry("2", "28"),
            Map.entry("3", "30"),
            Map.entry("4", "27"),
            Map.entry("5", "29"),
            Map.entry("6", "26"),
            Map.entry("7", "31"),
            Map.entry("8", "36"),
            Map.entry("31", "41"),
            Map.entry("32", "51"),
            Map.entry("33", "43"),
            Map.entry("34", "44"),
            Map.entry("35", "47"),
            Map.entry("36", "48"),
            Map.entry("37", "52"),
            Map.entry("38", "46"),
            Map.entry("39", "50")
    );

    // 역방향 매핑. 응답의 areaCd(lDong) → KorService2 로 돌려줄 때 사용.
    private static final Map<String, String> LDONG_TO_AREA_CODE = Map.ofEntries(
            Map.entry("11", "1"),
            Map.entry("26", "6"),
            Map.entry("27", "4"),
            Map.entry("28", "2"),
            Map.entry("29", "5"),
            Map.entry("30", "3"),
            Map.entry("31", "7"),
            Map.entry("36", "8"),
            Map.entry("41", "31"),
            Map.entry("42", "32"),
            Map.entry("43", "33"),
            Map.entry("44", "34"),
            Map.entry("45", "37"),
            Map.entry("46", "38"),
            Map.entry("47", "35"),
            Map.entry("48", "36"),
            Map.entry("50", "39"),
            Map.entry("51", "32"),
            Map.entry("52", "37")
    );

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.concentration.concentration-rate:}")
    private String concentrationUrl;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && concentrationUrl != null && !concentrationUrl.isBlank();
    }

    @Override
    public List<TourConcentrationPrediction> fetchPredictions(String areaCode, String signguCode, String spotName) {
        if (!isConfigured()) {
            log.debug("[CNCTR] 미설정 - 빈 결과 반환");
            return List.of();
        }
        if (signguCode == null || signguCode.isBlank()) {
            log.warn("[CNCTR] signguCode 누락 - 빈 결과 반환 (areaCode={})", areaCode);
            return List.of();
        }
        String ldong = AREA_CODE_TO_LDONG.get(areaCode);
        if (ldong == null) {
            log.warn("[CNCTR] 미매핑 areaCode={} - 빈 결과", areaCode);
            return List.of();
        }
        String key = ldong + "|" + signguCode + "|" + (spotName == null ? "" : spotName);
        CacheEntry entry = cache.get(key);
        long now = Instant.now().toEpochMilli();
        if (entry != null && now - entry.loadedAtEpochMs < CACHE_TTL_MS) {
            return entry.items;
        }
        List<TourConcentrationPrediction> fetched = callApi(ldong, signguCode, spotName);
        cache.put(key, new CacheEntry(fetched, now));
        return fetched;
    }

    private List<TourConcentrationPrediction> callApi(String ldongAreaCd, String signguCd, String spotName) {
        StringBuilder url = new StringBuilder(concentrationUrl)
                .append(concentrationUrl.contains("?") ? "&" : "?")
                .append("serviceKey=").append(serviceKey)
                .append("&_type=json")
                .append("&MobileOS=ETC")
                .append("&MobileApp=touraz-dvdholic")
                .append("&numOfRows=30")
                .append("&pageNo=1")
                .append("&areaCd=").append(ldongAreaCd)
                .append("&signguCd=").append(signguCd);
        if (spotName != null && !spotName.isBlank()) {
            url.append("&tAtsNm=").append(java.net.URLEncoder.encode(spotName, java.nio.charset.StandardCharsets.UTF_8));
        }

        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            raw = httpClient.request(url.toString(), HttpMethod.GET, headers, Map.of());
        } catch (Exception ex) {
            log.error("[CNCTR] 호출 실패 areaCd={} signguCd={} err={}", ldongAreaCd, signguCd, ex.getMessage());
            return List.of();
        }

        if (raw == null || raw.isBlank()) {
            log.warn("[CNCTR] 빈 응답 areaCd={} signguCd={}", ldongAreaCd, signguCd);
            return List.of();
        }

        VisitKoreaConcentrationResponse parsed;
        try {
            String safe = raw.replace("\"items\":\"\"", "\"items\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaConcentrationResponse.class);
        } catch (Exception ex) {
            log.error("[CNCTR] 파싱 실패 err={}", ex.getMessage());
            return List.of();
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null
                || parsed.getResponse().getBody().getItems() == null
                || parsed.getResponse().getBody().getItems().getItem() == null) {
            log.info("[CNCTR] items 없음 areaCd={} signguCd={}", ldongAreaCd, signguCd);
            return List.of();
        }

        List<TourConcentrationPrediction> list = parsed.getResponse().getBody().getItems().getItem().stream()
                .map(VisitKoreaConcentrationHttpClient::toDomain)
                .filter(p -> p.getBaseDate() != null && p.getConcentrationRate() != null)
                .sorted(Comparator.comparing(TourConcentrationPrediction::getBaseDate))
                .collect(Collectors.toList());

        log.info("[CNCTR] 캐시 갱신 areaCd={} signguCd={} tAts={} -> {} 건",
                ldongAreaCd, signguCd, spotName, list.size());
        return Collections.unmodifiableList(list);
    }

    private static TourConcentrationPrediction toDomain(VisitKoreaConcentrationResponse.Item i) {
        LocalDate date = null;
        if (i.getBaseYmd() != null && i.getBaseYmd().length() == 8) {
            try {
                date = LocalDate.parse(i.getBaseYmd(), YMD);
            } catch (Exception ignore) {
                // 비정상 날짜는 무시 (baseDate=null 로 두어 상위 필터에서 배제)
            }
        }
        Double rate = null;
        if (i.getCnctrRate() != null) {
            try {
                rate = Double.parseDouble(i.getCnctrRate().trim());
            } catch (NumberFormatException ignore) {
                // 파싱 실패는 null 유지
            }
        }
        String areaCd = i.getAreaCd();
        String korAreaCode = (areaCd != null) ? LDONG_TO_AREA_CODE.getOrDefault(areaCd, areaCd) : null;
        return TourConcentrationPrediction.builder()
                .baseDate(date)
                .areaCode(korAreaCode)
                .areaName(i.getAreaNm())
                .signguCode(i.getSignguCd())
                .signguName(i.getSignguNm())
                .spotName(i.getTAtsNm())
                .concentrationRate(rate)
                .build();
    }

    private record CacheEntry(List<TourConcentrationPrediction> items, long loadedAtEpochMs) {
    }
}
