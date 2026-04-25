package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.TouristSpotBrief;
import fast.campus.netplix.tour.TouristSpotBriefPort;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 관광지 단건 "간단 상세" 어댑터. KTO {@code searchKeyword2} 를 가용한 3개 서비스에서 순차 호출해
 * 가장 먼저 매칭되는 결과를 채운다.
 *
 * <p>호출 순서: KorWithService2 (무장애) → KorPetTourService2 (반려동물) → EngService2 (영문).
 * 일반 KorService2 는 우리 키에서 {@code Forbidden} 으로 막혀 별도 활용신청이 필요하므로 제외했다.
 *
 * <p>TarRlteTarService1 응답에는 좌표/이미지가 없어 본 어댑터가 보완 역할을 한다. 결과는
 * (keyword + bjdAreaCode) 단위로 6h TTL in-memory 캐시. 일일 트래픽 1,000회/오퍼레이션
 * 한도 보호.
 *
 * <p>BJD 광역 코드(11/46/...) 가 들어오면 KorXxxService2 의 areaCode(KTO 코드, 1~8/31~39) 로
 * 사전 변환 후 호출한다. {@link #BJD_TO_KTO_AREA} 가 매핑.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaSpotBriefHttpClient implements TouristSpotBriefPort {

    /** 행정안전부 BJD 광역코드(앞 2자리) → KTO KorService2 areaCode 매핑. */
    private static final Map<String, String> BJD_TO_KTO_AREA = Map.ofEntries(
            Map.entry("11", "1"),   // 서울
            Map.entry("26", "6"),   // 부산
            Map.entry("27", "4"),   // 대구
            Map.entry("28", "2"),   // 인천
            Map.entry("29", "5"),   // 광주
            Map.entry("30", "3"),   // 대전
            Map.entry("31", "7"),   // 울산
            Map.entry("36", "8"),   // 세종
            Map.entry("41", "31"),  // 경기
            Map.entry("42", "32"),  // 강원 (구)
            Map.entry("43", "33"),  // 충북
            Map.entry("44", "34"),  // 충남
            Map.entry("45", "37"),  // 전북 (구)
            Map.entry("46", "38"),  // 전남
            Map.entry("47", "35"),  // 경북
            Map.entry("48", "36"),  // 경남
            Map.entry("50", "39"),  // 제주
            Map.entry("51", "32"),  // 강원특별자치도
            Map.entry("52", "37")   // 전북특별자치도
    );

    private static final int PAGE_SIZE = 5;

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.access.search-keyword:}")
    private String withSearchUrl;

    @Value("${visitkorea.pet.search-keyword:}")
    private String petSearchUrl;

    @Value("${visitkorea.eng.search-keyword:}")
    private String engSearchUrl;

    @Value("${visitkorea.access.cache-minutes:360}")
    private long cacheMinutes;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        if (serviceKey == null || serviceKey.isBlank()) return false;
        return notBlank(withSearchUrl) || notBlank(petSearchUrl) || notBlank(engSearchUrl);
    }

    @Override
    public Optional<TouristSpotBrief> findFirstByKeyword(String keyword, String bjdAreaCode) {
        if (!isConfigured() || keyword == null || keyword.isBlank()) return Optional.empty();

        String norm = keyword.trim();
        String ktoArea = bjdAreaCode == null ? null : BJD_TO_KTO_AREA.get(bjdAreaCode.trim());
        String cacheKey = norm + "|" + (ktoArea == null ? "" : ktoArea);

        CacheEntry cached = cache.get(cacheKey);
        if (cached != null) {
            if (Instant.now().toEpochMilli() - cached.loadedAtMs <= Duration.ofMinutes(cacheMinutes).toMillis()) {
                return Optional.ofNullable(cached.brief);
            }
            cache.remove(cacheKey);
        }

        Optional<TouristSpotBrief> result = tryService(withSearchUrl, "with", norm, ktoArea)
                .or(() -> tryService(petSearchUrl, "pet", norm, ktoArea))
                .or(() -> tryService(engSearchUrl, "eng", norm, ktoArea));

        cache.put(cacheKey, new CacheEntry(result.orElse(null), Instant.now().toEpochMilli()));
        return result;
    }

    // -------------------- internal --------------------

    private Optional<TouristSpotBrief> tryService(String baseUrl, String source, String keyword, String ktoAreaCode) {
        if (!notBlank(baseUrl)) return Optional.empty();
        try {
            String url = buildUrl(baseUrl, keyword, ktoAreaCode);
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            // RestTemplate#exchange(String, ...) 가 URI 템플릿으로 해석해 %-인코딩된 한글이 이중 인코딩되는
            // 이슈를 피하려면 URI 객체로 감싸 호출해야 한다.
            String raw = httpClient.requestUri(URI.create(url), HttpMethod.GET, headers);
            if (raw == null || raw.isBlank()) return Optional.empty();

            // totalCount=0 인 경우 KTO 가 items 를 빈 문자열("") 로 내려줌 → null 치환.
            String safe = raw.replaceAll("\"items\"\\s*:\\s*\"\"", "\"items\":null");
            VisitKoreaSpotBriefResponse parsed =
                    ObjectMapperUtil.toObject(safe, VisitKoreaSpotBriefResponse.class);

            if (parsed == null || parsed.getResponse() == null
                    || parsed.getResponse().getBody() == null) return Optional.empty();
            VisitKoreaSpotBriefResponse.Items items = parsed.getResponse().getBody().getItems();
            if (items == null || items.getItem() == null || items.getItem().isEmpty()) return Optional.empty();

            VisitKoreaSpotBriefResponse.Item top = pickBest(items.getItem(), keyword);
            return Optional.of(toBrief(top, source));
        } catch (Exception ex) {
            log.warn("[KOR-BRIEF] {} 호출/파싱 실패 keyword={} err={}", source, keyword, ex.getMessage());
            return Optional.empty();
        }
    }

    private String buildUrl(String baseUrl, String keyword, String ktoAreaCode) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(baseUrl.contains("?") ? "&" : "?")
                .append("serviceKey=").append(serviceKey)
                .append("&_type=json")
                .append("&MobileOS=ETC")
                .append("&MobileApp=touraz-dvdholic")
                .append("&numOfRows=").append(PAGE_SIZE)
                .append("&pageNo=1")
                .append("&arrange=A")
                .append("&keyword=").append(URLEncoder.encode(keyword, StandardCharsets.UTF_8));
        if (notBlank(ktoAreaCode)) {
            url.append("&areaCode=").append(URLEncoder.encode(ktoAreaCode, StandardCharsets.UTF_8));
        }
        return url.toString();
    }

    /**
     * 여러 결과 중 가장 적합한 1건 선택.
     *
     * <p>점수: title 정확 일치(+10) > 이미지 보유(+3) > 주소 보유(+1) > 키워드 부분포함(+2).
     * 단순하지만 모달 노출용으로 충분한 휴리스틱.
     */
    private VisitKoreaSpotBriefResponse.Item pickBest(List<VisitKoreaSpotBriefResponse.Item> list, String keyword) {
        VisitKoreaSpotBriefResponse.Item best = list.get(0);
        int bestScore = score(best, keyword);
        for (int i = 1; i < list.size(); i++) {
            int s = score(list.get(i), keyword);
            if (s > bestScore) {
                best = list.get(i);
                bestScore = s;
            }
        }
        return best;
    }

    private int score(VisitKoreaSpotBriefResponse.Item it, String kw) {
        int s = 0;
        String t = it.getTitle();
        if (t != null) {
            String tt = t.replaceAll("\\s+", "");
            String kk = kw.replaceAll("\\s+", "");
            if (tt.equalsIgnoreCase(kk)) s += 10;
            else if (tt.contains(kk) || kk.contains(tt)) s += 2;
        }
        if (notBlank(it.getFirstimage())) s += 3;
        if (notBlank(it.getAddr1())) s += 1;
        return s;
    }

    private static TouristSpotBrief toBrief(VisitKoreaSpotBriefResponse.Item i, String source) {
        return TouristSpotBrief.builder()
                .title(i.getTitle())
                .address(i.getAddr1())
                .addressSub(i.getAddr2())
                .firstImage(i.getFirstimage())
                .firstImage2(i.getFirstimage2())
                .mapX(i.getMapx())
                .mapY(i.getMapy())
                .tel(i.getTel())
                .contentId(i.getContentid())
                .contentTypeId(i.getContenttypeid())
                .areaCode(i.getAreacode())
                .signguCode(i.getSigungucode())
                .source(source)
                .build();
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private record CacheEntry(TouristSpotBrief brief, long loadedAtMs) {}
}
