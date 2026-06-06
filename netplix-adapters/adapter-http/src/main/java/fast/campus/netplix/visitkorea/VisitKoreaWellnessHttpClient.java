package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.util.ObjectMapperUtil;
import fast.campus.netplix.wellness.WellnessSpot;
import fast.campus.netplix.wellness.WellnessSpotDetail;
import fast.campus.netplix.wellness.WellnessSpotPort;
import jakarta.annotation.PostConstruct;
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
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) HTTP 어댑터.
 *
 * <p>GoCamping / PhotoGalleryService1 에서 학습한 교훈 적용:
 * <ul>
 *   <li>RestTemplate 이중 인코딩 방지를 위해 {@link HttpClient#requestUri(URI, HttpMethod, HttpHeaders)} 사용</li>
 *   <li>items 가 빈 문자열("")로 내려오는 0건 응답을 JSON 파싱 전에 null 로 치환</li>
 *   <li>전체 목록은 1페이지 동기 + 백그라운드 풀 적재 (Heroku 30s 타임아웃 회피)</li>
 *   <li>serviceKey 미설정 / 403 / 비-JSON 응답 시 빈 리스트 반환 → UI 자연 숨김</li>
 * </ul>
 *
 * <p>캐시 정책:
 * <ul>
 *   <li>__ALL__ : 전국 전체 (24h TTL). 프리워밍 시도(실패해도 서비스 기동은 계속).</li>
 *   <li>키워드 : 키워드별 개별 캐시 (최대 64개, LRU 근사치)</li>
 *   <li>위치기반(lat,lng,radius): 캐시하지 않음. 매 호출 1페이지만 동기 조회.</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaWellnessHttpClient implements WellnessSpotPort {

    private static final int MAX_PAGE_SIZE = 200;
    /**
     * 웰니스 목록(areaBasedList/searchKeyword)은 대표이미지를 응답에 포함하지 않으며,
     * 이미지 필수 정렬(O/P/Q/R)을 주면 0건이 반환된다(데이터셋에 목록 대표이미지 미등록).
     * 따라서 목록은 수정일순(C)으로 받고, 사진은 detailImage 로 별도 보강한다.
     */
    private static final String IMAGE_ARRANGE = "C";
    /** detailImage 로 이미지를 보강할 때 동기 경로에서의 최대 보강 개수(첫 화면 분량). */
    private static final int SYNC_ENRICH_LIMIT = 40;
    /** 백그라운드(전체/지역/키워드 풀 적재) 경로에서의 최대 보강 개수. */
    private static final int BG_ENRICH_LIMIT = 400;
    /** 이미지 보강 전체 대기 한도(ms). 초과분은 다음 캐시 갱신에서 채워진다. */
    private static final long ENRICH_TIMEOUT_MS = 12_000L;

    /** 상세 응답(단일 item 이 객체로 오는 경우 포함) 파싱용 매퍼. */
    private static final ObjectMapper DETAIL_MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true);

    /**
     * detailIntro 필드 → 화면 라벨. contentTypeId(관광지/문화/레포츠/숙박/쇼핑/음식점) 별 변형 키를 모두 포함.
     * 선언 순서대로 모달에 노출된다(LinkedHashMap).
     */
    private static final Map<String, String> INTRO_LABELS = new LinkedHashMap<>();
    static {
        // 이용/영업 시간
        INTRO_LABELS.put("usetime", "이용시간");
        INTRO_LABELS.put("usetimeculture", "이용시간");
        INTRO_LABELS.put("usetimeleports", "이용시간");
        INTRO_LABELS.put("opentime", "영업시간");
        INTRO_LABELS.put("opentimefood", "영업시간");
        INTRO_LABELS.put("opendate", "개장일");
        INTRO_LABELS.put("opendateshopping", "영업시간");
        INTRO_LABELS.put("checkintime", "입실 시간");
        INTRO_LABELS.put("checkouttime", "퇴실 시간");
        // 휴무
        INTRO_LABELS.put("restdate", "휴무일");
        INTRO_LABELS.put("restdateculture", "휴무일");
        INTRO_LABELS.put("restdatefood", "휴무일");
        INTRO_LABELS.put("restdateleports", "휴무일");
        INTRO_LABELS.put("restdateshopping", "휴무일");
        // 요금/메뉴
        INTRO_LABELS.put("usefee", "이용요금");
        INTRO_LABELS.put("usetimefestival", "이용요금");
        INTRO_LABELS.put("firstmenu", "대표 메뉴");
        INTRO_LABELS.put("treatmenu", "취급 메뉴");
        // 체험/이용 안내
        INTRO_LABELS.put("expguide", "체험 안내");
        INTRO_LABELS.put("useseason", "이용 시기");
        INTRO_LABELS.put("scaleleports", "규모");
        INTRO_LABELS.put("accomcountleports", "수용 인원");
        INTRO_LABELS.put("accomcountculture", "수용 인원");
        // 주차
        INTRO_LABELS.put("parking", "주차");
        INTRO_LABELS.put("parkingculture", "주차");
        INTRO_LABELS.put("parkingfood", "주차");
        INTRO_LABELS.put("parkingleports", "주차");
        INTRO_LABELS.put("parkinglodging", "주차");
        INTRO_LABELS.put("parkingshopping", "주차");
        // 편의/정책
        INTRO_LABELS.put("chkcreditcard", "신용카드");
        INTRO_LABELS.put("chkcreditcardculture", "신용카드");
        INTRO_LABELS.put("chkcreditcardfood", "신용카드");
        INTRO_LABELS.put("chkbabycarriage", "유모차 대여");
        INTRO_LABELS.put("chkpet", "반려동물 동반");
        INTRO_LABELS.put("chkpetculture", "반려동물 동반");
        INTRO_LABELS.put("reservation", "예약");
        INTRO_LABELS.put("reservationlodging", "예약");
        INTRO_LABELS.put("reservationfood", "예약");
        INTRO_LABELS.put("kidsfacility", "어린이 놀이방");
        INTRO_LABELS.put("smoking", "흡연");
        // 문의·안내
        INTRO_LABELS.put("infocenter", "문의 · 안내");
        INTRO_LABELS.put("infocenterculture", "문의 · 안내");
        INTRO_LABELS.put("infocenterfood", "문의 · 안내");
        INTRO_LABELS.put("infocenterleports", "문의 · 안내");
        INTRO_LABELS.put("infocenterlodging", "문의 · 안내");
        INTRO_LABELS.put("infocentershopping", "문의 · 안내");
    }
    private static final String ALL_KEY = "__ALL__";
    private static final int MAX_KEYWORD_CACHE = 64;
    /** 전국 웰니스관광지 ~700-900개. 넉넉히 10 페이지(= 2,000개) 가드. */
    private static final int MAX_PAGES_ALL = 10;
    /** 키워드 검색도 보통 수백 개 이내. 10 페이지(= 2,000개) 가드. */
    private static final int MAX_PAGES_KEYWORD = 10;
    /** 위치기반은 단일 페이지로 충분. 반경 20km 면 수십 개 수준. */
    private static final int LOCATION_PAGE_ROWS = 100;

    private final HttpClient httpClient;

    @Value("${visitkorea.wellness.api-key:}")
    private String serviceKey;

    @Value("${visitkorea.wellness.area-url:https://apis.data.go.kr/B551011/WellnessTursmService/areaBasedList}")
    private String areaUrl;

    @Value("${visitkorea.wellness.location-url:https://apis.data.go.kr/B551011/WellnessTursmService/locationBasedList}")
    private String locationUrl;

    @Value("${visitkorea.wellness.search-url:https://apis.data.go.kr/B551011/WellnessTursmService/searchKeyword}")
    private String searchUrl;

    @Value("${visitkorea.wellness.detail-image-url:https://apis.data.go.kr/B551011/WellnessTursmService/detailImage}")
    private String detailImageUrl;

    @Value("${visitkorea.wellness.detail-common-url:https://apis.data.go.kr/B551011/WellnessTursmService/detailCommon}")
    private String detailCommonUrl;

    @Value("${visitkorea.wellness.detail-intro-url:https://apis.data.go.kr/B551011/WellnessTursmService/detailIntro}")
    private String detailIntroUrl;

    /** contentId 별 상세 캐시(개요·이용정보·갤러리). 24h TTL 공유. */
    private final Map<String, DetailSnapshot> detailCache = new ConcurrentHashMap<>();

    /** detailImage 병렬 보강용 소형 풀(외부 KTO 호출 → I/O 바운드). */
    private final ExecutorService enrichPool = Executors.newFixedThreadPool(12, r -> {
        Thread t = new Thread(r, "wellness-img-enrich");
        t.setDaemon(true);
        return t;
    });

    @Value("${visitkorea.wellness.cache-minutes:1440}")
    private long cacheMinutes;

    private final Map<String, CacheSnapshot> cache = new ConcurrentHashMap<>();

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && areaUrl != null && !areaUrl.isBlank();
    }

    @PostConstruct
    void prewarm() {
        if (!isConfigured()) {
            log.info("[WELLNESS] serviceKey/URL 미설정 - 프리워밍 생략");
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                refreshAll();
                log.info("[WELLNESS] 프리워밍 완료 - {} 건 로드",
                        getSnapshot(ALL_KEY).sites.size());
            } catch (Exception ex) {
                log.warn("[WELLNESS] 프리워밍 실패 (다음 호출에서 재시도): {}", ex.getMessage());
            }
        });
    }

    @Override
    public List<WellnessSpot> fetchAll(int limit) {
        if (!isConfigured()) return List.of();
        CacheSnapshot snap = cache.get(ALL_KEY);

        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(areaUrl, Map.of("arrange", IMAGE_ARRANGE), 1);
            if (first == null) return List.of();
            List<WellnessSpot> partial = Collections.unmodifiableList(
                    new ArrayList<>(enrichImages(first.items, SYNC_ENRICH_LIMIT)));
            boolean needMore = first.totalCount > partial.size();
            cache.put(ALL_KEY, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleAllRefresh();
            return take(partial, limit);
        }

        scheduleAllRefresh();
        return take(snap.sites, limit);
    }

    @Override
    public List<WellnessSpot> fetchNearby(double latitude, double longitude, int radiusM, int limit) {
        if (!isConfigured()) return List.of();
        Map<String, String> params = Map.of(
                "mapX", String.valueOf(longitude),
                "mapY", String.valueOf(latitude),
                "radius", String.valueOf(Math.max(1, radiusM)),
                "arrange", "E"  // 거리순
        );
        PageResult pr = requestPage(locationUrl, params, 1, LOCATION_PAGE_ROWS);
        if (pr == null) return List.of();
        List<WellnessSpot> sorted = pr.items.stream()
                .map(s -> withDistance(s, latitude, longitude))
                .sorted((a, b) -> Double.compare(
                        a.getDistanceKm() == null ? Double.MAX_VALUE : a.getDistanceKm(),
                        b.getDistanceKm() == null ? Double.MAX_VALUE : b.getDistanceKm()))
                .collect(Collectors.toList());
        return take(enrichImages(sorted, SYNC_ENRICH_LIMIT), limit);
    }

    @Override
    public List<WellnessSpot> fetchByKeyword(String keyword, int limit) {
        if (!isConfigured()) return List.of();
        if (keyword == null || keyword.isBlank()) return fetchAll(limit);
        String key = keyword.trim().toLowerCase(Locale.ROOT);

        CacheSnapshot snap = cache.get(key);
        if (snap != null && !snap.partial && !isStale(snap)) {
            return take(snap.sites, limit);
        }

        if (snap == null) {
            PageResult first = requestPage(searchUrl, Map.of("keyword", keyword.trim(), "arrange", IMAGE_ARRANGE), 1);
            if (first == null) return List.of();
            List<WellnessSpot> partial = Collections.unmodifiableList(
                    new ArrayList<>(enrichImages(first.items, SYNC_ENRICH_LIMIT)));
            boolean needMore = first.totalCount > partial.size();
            cache.put(key, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) scheduleKeywordRefresh(keyword.trim(), key);
            return take(partial, limit);
        }

        scheduleKeywordRefresh(keyword.trim(), key);
        return take(snap.sites, limit);
    }

    @Override
    public List<WellnessSpot> fetchByKorAdministrativeArea(String korAreaCode, String signguCodeOrNull, int limit) {
        if (!isConfigured()) return List.of();
        String ldong = KorServiceToLdong.ldongRegnForWellnessAreaParam(korAreaCode).orElse(null);
        if (ldong == null) {
            log.warn("[WELLNESS] 알 수 없는 korAreaCode={}", korAreaCode);
            return List.of();
        }
        String cacheKey = "__KOR__|" + ldong + "|" + (signguCodeOrNull == null ? "" : signguCodeOrNull.trim());
        CacheSnapshot snap = cache.get(cacheKey);
        if (snap != null && !snap.partial && !isStale(snap)) {
            if (!snap.sites.isEmpty()) {
                return take(snap.sites, limit);
            }
            return filterAllByAdministrative(ldong, signguCodeOrNull, limit, "kor 캐시 0건");
        }
        Map<String, String> extras = new LinkedHashMap<>();
        extras.put("arrange", IMAGE_ARRANGE);
        extras.put("lDongRegnCd", ldong);
        if (signguCodeOrNull != null && !signguCodeOrNull.isBlank()) {
            extras.put("lDongSignguCd", signguCodeOrNull.trim());
        }
        PageResult first = requestPage(areaUrl, extras, 1);
        List<WellnessSpot> partial = List.of();
        boolean needMore = false;
        if (first != null) {
            // 지역 목록은 보통 수십 건 → 첫 페이지 전체를 보강.
            partial = Collections.unmodifiableList(new ArrayList<>(enrichImages(first.items, BG_ENRICH_LIMIT)));
            needMore = first.totalCount > partial.size();
            cache.put(cacheKey, new CacheSnapshot(partial, Instant.now().toEpochMilli(), needMore));
            if (needMore) {
                String finalKey = cacheKey;
                CompletableFuture.runAsync(() -> {
                    try {
                        refreshKorArea(ldong, signguCodeOrNull, finalKey);
                    } catch (Exception ex) {
                        log.warn("[WELLNESS] korArea 백그라운드 갱신 실패 ldong={} err={}", ldong, ex.getMessage());
                    }
                });
            }
        }
        List<WellnessSpot> primary = take(partial, limit);
        if (!primary.isEmpty()) {
            return primary;
        }
        return filterAllByAdministrative(ldong, signguCodeOrNull, limit, first == null ? "areaBasedList 실패(null)" : "areaBasedList 0건");
    }

    @Override
    public WellnessSpotDetail fetchDetail(String contentId, String contentTypeId) {
        if (!isConfigured() || contentId == null || contentId.isBlank()) {
            return WellnessSpotDetail.empty(contentId);
        }
        String key = contentId.trim();
        DetailSnapshot snap = detailCache.get(key);
        if (snap != null && (Instant.now().toEpochMilli() - snap.loadedAtEpochMs) < cacheMinutes * 60_000L) {
            return snap.detail;
        }
        WellnessSpotDetail detail = loadDetail(key, contentTypeId);
        detailCache.put(key, new DetailSnapshot(detail, Instant.now().toEpochMilli()));
        return detail;
    }

    /** detailCommon(개요·홈페이지·전화) + detailImage(갤러리) + detailIntro(이용정보) 를 합친다. */
    private WellnessSpotDetail loadDetail(String contentId, String contentTypeId) {
        String overview = null, homepage = null, tel = null;
        VisitKoreaWellnessResponse.Item common = fetchDetailCommon(contentId);
        if (common != null) {
            overview = cleanHtml(nullIfBlank(common.getOverview()));
            homepage = normalizeHomepage(nullIfBlank(common.getHomepage()));
            tel = nullIfBlank(common.getTel());
        }
        List<String> images = fetchAllDetailImages(contentId);
        List<WellnessSpotDetail.Fact> facts = fetchDetailIntroFacts(contentId, contentTypeId);
        return new WellnessSpotDetail(contentId, overview, homepage, tel, images, facts);
    }

    private VisitKoreaWellnessResponse.Item fetchDetailCommon(String contentId) {
        StringBuilder sb = detailUrlBase(detailCommonUrl, contentId);
        sb.append("&defaultYN=Y&overviewYN=Y&firstImageYN=Y&addrinfoYN=Y&mapinfoYN=Y");
        String json = requestRawJson(sb);
        if (json == null) return null;
        try {
            VisitKoreaWellnessResponse p = DETAIL_MAPPER.readValue(json, VisitKoreaWellnessResponse.class);
            if (p == null || p.getResponse() == null || p.getResponse().getBody() == null
                    || p.getResponse().getBody().getItems() == null
                    || p.getResponse().getBody().getItems().getItem() == null
                    || p.getResponse().getBody().getItems().getItem().isEmpty()) {
                return null;
            }
            return p.getResponse().getBody().getItems().getItem().get(0);
        } catch (Exception ex) {
            return null;
        }
    }

    private List<String> fetchAllDetailImages(String contentId) {
        StringBuilder sb = detailUrlBase(detailImageUrl, contentId);
        sb.append("&imageYN=Y");
        String json = requestRawJson(sb);
        if (json == null) return List.of();
        try {
            VisitKoreaWellnessResponse p = DETAIL_MAPPER.readValue(json, VisitKoreaWellnessResponse.class);
            if (p == null || p.getResponse() == null || p.getResponse().getBody() == null
                    || p.getResponse().getBody().getItems() == null
                    || p.getResponse().getBody().getItems().getItem() == null) {
                return List.of();
            }
            List<String> out = new ArrayList<>();
            for (VisitKoreaWellnessResponse.Item it : p.getResponse().getBody().getItems().getItem()) {
                String u = nullIfBlank(it.getOrgImage());
                if (u == null) u = nullIfBlank(it.getThumbImage());
                if (u == null) u = nullIfBlank(it.getAnyImage());
                if (u != null && !out.contains(u)) out.add(u);
            }
            return out;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<WellnessSpotDetail.Fact> fetchDetailIntroFacts(String contentId, String contentTypeId) {
        if (contentTypeId == null || contentTypeId.isBlank()) return List.of();
        StringBuilder sb = detailUrlBase(detailIntroUrl, contentId);
        sb.append("&contentTypeId=").append(URLEncoder.encode(contentTypeId, StandardCharsets.UTF_8));
        String json = requestRawJson(sb);
        if (json == null) return List.of();
        try {
            VisitKoreaWellnessIntroResponse p = DETAIL_MAPPER.readValue(json, VisitKoreaWellnessIntroResponse.class);
            if (p == null || p.getResponse() == null || p.getResponse().getBody() == null
                    || p.getResponse().getBody().getItems() == null
                    || p.getResponse().getBody().getItems().getItem() == null
                    || p.getResponse().getBody().getItems().getItem().isEmpty()) {
                return List.of();
            }
            Map<String, Object> m = p.getResponse().getBody().getItems().getItem().get(0);
            List<WellnessSpotDetail.Fact> facts = new ArrayList<>();
            for (Map.Entry<String, String> label : INTRO_LABELS.entrySet()) {
                Object raw = m.get(label.getKey());
                String val = raw == null ? null : cleanHtml(String.valueOf(raw).trim());
                if (val != null && !val.isEmpty() && !"0".equals(val)) {
                    facts.add(new WellnessSpotDetail.Fact(label.getValue(), val));
                }
            }
            return facts;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private StringBuilder detailUrlBase(String url, String contentId) {
        StringBuilder sb = new StringBuilder(url);
        sb.append(url.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json&MobileOS=ETC&MobileApp=touraz-dvdholic&langDivCd=ko");
        sb.append("&numOfRows=30&pageNo=1");
        sb.append("&contentId=").append(URLEncoder.encode(contentId, StandardCharsets.UTF_8));
        return sb;
    }

    private String requestRawJson(StringBuilder sb) {
        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            raw = httpClient.requestUri(URI.create(sb.toString()), HttpMethod.GET, headers);
        } catch (Exception ex) {
            return null;
        }
        if (raw == null) return null;
        String t = raw.trim();
        if (!t.startsWith("{") && !t.startsWith("[")) return null;
        return t.replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
    }

    /** KTO 본문 값에 섞인 HTML 태그/엔티티 제거(<br> → 줄바꿈). */
    private static String cleanHtml(String s) {
        if (s == null) return null;
        String r = s
                .replaceAll("(?i)<br\\s*/?>", "\n")
                .replaceAll("<[^>]+>", "")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&nbsp;", " ")
                .replaceAll("[ \\t]+\\n", "\n")
                .trim();
        return r.isEmpty() ? null : r;
    }

    /** KTO 행정 필터가 0건·실패할 때 전국 캐시에서 lDongRegnCd 로 맞춘다.
     *
     * <p>집중률 CTA 등은 「대표 시군구」코드(KTO 관광지 API)와 동일하게 넘기지만,
     * 웰니스 목록에는 {@code sigunguCode}가 비어 있는 항목이 많아 시군구까지 걸면 0건이 되는 경우가 있다.
     * 그럴 때는 같은 광역(lDong) 전체를 보여 준다.
     */
    private List<WellnessSpot> filterAllByAdministrative(
            String ldongRegn, String signguOrNull, int limit, String reason) {
        List<WellnessSpot> byLdong = fetchAll(0).stream()
                .filter(s -> ldongRegn.equals(s.getAreaCode()))
                .collect(Collectors.toList());

        List<WellnessSpot> filtered;
        if (signguOrNull == null || signguOrNull.isBlank()) {
            filtered = byLdong;
        } else {
            filtered = byLdong.stream()
                    .filter(s -> matchesSigungu(s.getSigunguCode(), signguOrNull))
                    .collect(Collectors.toList());
            if (filtered.isEmpty() && !byLdong.isEmpty()) {
                log.info("[WELLNESS] 시군구={} 로 웰니스 POI 매칭 0건 → 광역 lDong={} 만으로 완화 ({}건)",
                        signguOrNull.trim(), ldongRegn, byLdong.size());
                filtered = byLdong;
            }
        }

        if (!filtered.isEmpty()) {
            log.info("[WELLNESS] {} → 전국 캐시 필터 폴백 ldong={} sigungu={} → {}건",
                    reason, ldongRegn, signguOrNull, filtered.size());
            filtered = enrichImages(filtered, BG_ENRICH_LIMIT);
        }
        return take(filtered, limit);
    }

    private static boolean matchesSigungu(String spotSigungu, String requestedOrNull) {
        if (requestedOrNull == null || requestedOrNull.isBlank()) return true;
        if (spotSigungu == null || spotSigungu.isBlank()) return false;
        String req = requestedOrNull.trim();
        String sc = spotSigungu.trim();
        if (req.equals(sc)) return true;
        try {
            return Long.parseLong(req) == Long.parseLong(sc);
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private void refreshKorArea(String ldong, String signguCodeOrNull, String cacheKey) {
        Map<String, String> extras = new LinkedHashMap<>();
        extras.put("arrange", IMAGE_ARRANGE);
        extras.put("lDongRegnCd", ldong);
        if (signguCodeOrNull != null && !signguCodeOrNull.isBlank()) {
            extras.put("lDongSignguCd", signguCodeOrNull.trim());
        }
        List<WellnessSpot> sites = requestAllPages(areaUrl, extras, MAX_PAGES_ALL);
        if (sites == null) {
            log.warn("[WELLNESS] korArea 전체 페이지 로드 실패 ldong={}", ldong);
            return;
        }
        sites = enrichImages(sites, BG_ENRICH_LIMIT);
        cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[WELLNESS] korArea 캐시 갱신 key={} 건={}", cacheKey, sites.size());
    }

    private void scheduleAllRefresh() {
        CompletableFuture.runAsync(() -> {
            try { refreshAll(); }
            catch (Exception ex) {
                log.warn("[WELLNESS] 백그라운드 전체 갱신 실패: {}", ex.getMessage());
            }
        });
    }

    private void scheduleKeywordRefresh(String keyword, String cacheKey) {
        CompletableFuture.runAsync(() -> {
            try { refreshByKeyword(keyword, cacheKey); }
            catch (Exception ex) {
                log.warn("[WELLNESS] 백그라운드 키워드 갱신 실패 keyword={} err={}",
                        keyword, ex.getMessage());
            }
        });
    }

    private synchronized void refreshAll() {
        List<WellnessSpot> sites = requestAllPages(areaUrl, Map.of("arrange", IMAGE_ARRANGE), MAX_PAGES_ALL);
        if (sites == null) {
            log.warn("[WELLNESS] 전체 로드 실패 - 캐시 유지");
            return;
        }
        sites = enrichImages(sites, BG_ENRICH_LIMIT);
        cache.put(ALL_KEY, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[WELLNESS] 전체 캐시 갱신 - {} 건", sites.size());
    }

    private synchronized void refreshByKeyword(String keyword, String cacheKey) {
        List<WellnessSpot> sites = requestAllPages(searchUrl, Map.of("keyword", keyword, "arrange", IMAGE_ARRANGE), MAX_PAGES_KEYWORD);
        if (sites == null) {
            log.warn("[WELLNESS] 키워드={} 로드 실패 - 캐시 저장 스킵", keyword);
            return;
        }
        sites = enrichImages(sites, BG_ENRICH_LIMIT);
        if (cache.size() >= MAX_KEYWORD_CACHE) {
            cache.entrySet().stream()
                    .filter(e -> !e.getKey().equals(ALL_KEY))
                    .min((a, b) -> Long.compare(a.getValue().loadedAtEpochMs, b.getValue().loadedAtEpochMs))
                    .ifPresent(e -> cache.remove(e.getKey()));
        }
        cache.put(cacheKey, new CacheSnapshot(sites, Instant.now().toEpochMilli(), false));
        log.info("[WELLNESS] 키워드={} 캐시 갱신 - {} 건", keyword, sites.size());
    }

    private List<WellnessSpot> requestAllPages(String baseUrl, Map<String, String> extraParams, int maxPages) {
        PageResult first = requestPage(baseUrl, extraParams, 1);
        if (first == null) return null;

        List<WellnessSpot> acc = new ArrayList<>(first.items);
        int totalCount = first.totalCount;
        if (totalCount <= first.items.size()) {
            return Collections.unmodifiableList(acc);
        }

        int totalPages = (int) Math.min(
                maxPages,
                (long) Math.ceil(totalCount / (double) MAX_PAGE_SIZE));

        for (int page = 2; page <= totalPages; page++) {
            PageResult pr = requestPage(baseUrl, extraParams, page);
            if (pr == null || pr.items.isEmpty()) {
                log.warn("[WELLNESS] page={} 빈/실패 - 지금까지 {}건으로 마감", page, acc.size());
                break;
            }
            acc.addAll(pr.items);
        }
        log.info("[WELLNESS] 페이지 순회 완료 - totalCount={} 로드={} (maxPages={})",
                totalCount, acc.size(), maxPages);
        return Collections.unmodifiableList(acc);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, int pageNo) {
        return requestPage(baseUrl, extraParams, pageNo, MAX_PAGE_SIZE);
    }

    private PageResult requestPage(String baseUrl, Map<String, String> extraParams, int pageNo, int rows) {
        StringBuilder sb = new StringBuilder(baseUrl);
        sb.append(baseUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json");
        sb.append("&MobileOS=ETC");
        sb.append("&MobileApp=touraz-dvdholic");
        sb.append("&numOfRows=").append(rows);
        sb.append("&pageNo=").append(pageNo);
        // 웰니스 API 전용 필수 파라미터(누락 시 NO_MANDATORY_REQUEST_PARAMETERS_ERROR1(langDivCd))
        sb.append("&langDivCd=ko");
        extraParams.forEach((k, v) -> sb.append('&').append(k).append('=')
                .append(URLEncoder.encode(v, StandardCharsets.UTF_8)));

        String raw;
        String urlForLog = sb.toString().replaceAll("serviceKey=[^&]+", "serviceKey=***");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            URI uri = URI.create(sb.toString());
            raw = httpClient.requestUri(uri, HttpMethod.GET, headers);
        } catch (Exception ex) {
            log.error("[WELLNESS] 호출 실패 page={} url={} err={}", pageNo, urlForLog, ex.getMessage());
            return null;
        }

        if (raw == null || raw.isBlank()) {
            log.warn("[WELLNESS] 빈 응답 page={}", pageNo);
            return null;
        }

        String trimmed = raw.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            log.warn("[WELLNESS] 비-JSON 응답 (미승인/쿼터 초과 가능) page={} prefix={}",
                    pageNo, trimmed.substring(0, Math.min(80, trimmed.length())));
            return null;
        }

        VisitKoreaWellnessResponse parsed;
        try {
            String safe = trimmed
                    .replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                    .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
            parsed = ObjectMapperUtil.toObject(safe, VisitKoreaWellnessResponse.class);
        } catch (Exception ex) {
            log.error("[WELLNESS] 파싱 실패 page={} err={}", pageNo, ex.getMessage());
            return null;
        }

        if (parsed == null || parsed.getResponse() == null
                || parsed.getResponse().getBody() == null) {
            return new PageResult(List.of(), 0);
        }

        VisitKoreaWellnessResponse.Body body = parsed.getResponse().getBody();
        int totalCount = body.getTotalCount() != null ? body.getTotalCount() : 0;

        if (body.getItems() == null || body.getItems().getItem() == null) {
            return new PageResult(List.of(), totalCount);
        }

        List<WellnessSpot> list = body.getItems().getItem().stream()
                .map(VisitKoreaWellnessHttpClient::toDomain)
                .filter(s -> s.getName() != null && !s.getName().isBlank())
                .collect(Collectors.toList());
        return new PageResult(list, totalCount);
    }

    private static WellnessSpot toDomain(VisitKoreaWellnessResponse.Item i) {
        Double lat = parseDouble(i.getMapY());
        Double lng = parseDouble(i.getMapX());
        String addr = joinAddr(i.getBaseAddr(), i.getDetailAddr());
        String image = nullIfBlank(i.getOrgImage());
        if (image == null) image = nullIfBlank(i.getThumbImage());
        if (image == null) image = nullIfBlank(i.getAnyImage());
        // 웰니스 API 는 테마 코드(wellnessThemaCd) 단일 분류를 사용하므로 cat3 슬롯에 매핑하여
        // 프런트 배지 표시에 재활용한다.
        return WellnessSpot.builder()
                .id(i.getContentId())
                .name(i.getTitle())
                .address(addr)
                .zipcode(nullIfBlank(i.getZipCd()))
                .latitude(lat)
                .longitude(lng)
                .imageUrl(image)
                .tel(nullIfBlank(i.getTel()))
                .cat1(null)
                .cat2(null)
                .cat3(nullIfBlank(i.getWellnessThemaCd()))
                .areaCode(nullIfBlank(i.getLDongRegnCd()))
                .sigunguCode(nullIfBlank(i.getLDongSignguCd()))
                .contentTypeId(nullIfBlank(i.getContentTypeId()))
                .homepage(normalizeHomepage(nullIfBlank(i.getHomepage())))
                .build();
    }

    private static WellnessSpot withDistance(WellnessSpot s, double lat, double lng) {
        if (s.getLatitude() == null || s.getLongitude() == null) return s;
        double d = haversineKm(lat, lng, s.getLatitude(), s.getLongitude());
        return WellnessSpot.builder()
                .id(s.getId())
                .name(s.getName())
                .address(s.getAddress())
                .zipcode(s.getZipcode())
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .imageUrl(s.getImageUrl())
                .tel(s.getTel())
                .cat1(s.getCat1())
                .cat2(s.getCat2())
                .cat3(s.getCat3())
                .areaCode(s.getAreaCode())
                .sigunguCode(s.getSigunguCode())
                .contentTypeId(s.getContentTypeId())
                .homepage(s.getHomepage())
                .distanceKm(Math.round(d * 100.0) / 100.0)
                .build();
    }

    /**
     * 웰니스 목록 API 는 대표이미지를 주지 않으므로, 이미지가 비어 있는 스팟에 한해
     * detailImage(상세 이미지) 를 병렬 조회해 대표 1장을 채운다. maxToEnrich 로 호출량을 제한한다.
     */
    private List<WellnessSpot> enrichImages(List<WellnessSpot> spots, int maxToEnrich) {
        if (spots == null || spots.isEmpty() || detailImageUrl == null || detailImageUrl.isBlank()) {
            return spots;
        }
        List<WellnessSpot> out = new ArrayList<>(spots);
        List<Integer> targets = new ArrayList<>();
        for (int i = 0; i < out.size() && targets.size() < maxToEnrich; i++) {
            WellnessSpot s = out.get(i);
            if ((s.getImageUrl() == null || s.getImageUrl().isBlank()) && s.getId() != null && !s.getId().isBlank()) {
                targets.add(i);
            }
        }
        if (targets.isEmpty()) return out;

        List<CompletableFuture<Void>> futures = new ArrayList<>(targets.size());
        for (int idx : targets) {
            final int i = idx;
            final WellnessSpot s = out.get(i);
            futures.add(CompletableFuture.runAsync(() -> {
                String img = fetchFirstDetailImage(s.getId());
                if (img != null) out.set(i, withImage(s, img));
            }, enrichPool));
        }
        try {
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
                    .get(ENRICH_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        } catch (Exception ex) {
            log.warn("[WELLNESS] 이미지 보강 시간초과/일부 실패(다음 갱신에서 보완): {}", ex.getMessage());
        }
        return out;
    }

    /** detailImage 응답에서 대표 이미지 1장(orgImage>thumbImage) URL 을 반환. 실패 시 null. */
    private String fetchFirstDetailImage(String contentId) {
        if (contentId == null || contentId.isBlank()) return null;
        StringBuilder sb = new StringBuilder(detailImageUrl);
        sb.append(detailImageUrl.contains("?") ? "&" : "?");
        sb.append("serviceKey=").append(serviceKey);
        sb.append("&_type=json&MobileOS=ETC&MobileApp=touraz-dvdholic&langDivCd=ko");
        sb.append("&imageYN=Y&numOfRows=5&pageNo=1");
        sb.append("&contentId=").append(URLEncoder.encode(contentId, StandardCharsets.UTF_8));

        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/json");
            raw = httpClient.requestUri(URI.create(sb.toString()), HttpMethod.GET, headers);
        } catch (Exception ex) {
            return null;
        }
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

        try {
            String safe = trimmed
                    .replaceAll("\"items\"\\s*:\\s*\"\\s*\"", "\"items\":null")
                    .replaceAll("\"item\"\\s*:\\s*\"\\s*\"", "\"item\":null");
            VisitKoreaWellnessResponse parsed = ObjectMapperUtil.toObject(safe, VisitKoreaWellnessResponse.class);
            if (parsed == null || parsed.getResponse() == null
                    || parsed.getResponse().getBody() == null
                    || parsed.getResponse().getBody().getItems() == null
                    || parsed.getResponse().getBody().getItems().getItem() == null) {
                return null;
            }
            for (VisitKoreaWellnessResponse.Item it : parsed.getResponse().getBody().getItems().getItem()) {
                String u = nullIfBlank(it.getOrgImage());
                if (u == null) u = nullIfBlank(it.getThumbImage());
                if (u == null) u = nullIfBlank(it.getAnyImage());
                if (u != null) return u;
            }
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    private static WellnessSpot withImage(WellnessSpot s, String url) {
        return WellnessSpot.builder()
                .id(s.getId())
                .name(s.getName())
                .address(s.getAddress())
                .zipcode(s.getZipcode())
                .latitude(s.getLatitude())
                .longitude(s.getLongitude())
                .imageUrl(url)
                .tel(s.getTel())
                .cat1(s.getCat1())
                .cat2(s.getCat2())
                .cat3(s.getCat3())
                .areaCode(s.getAreaCode())
                .sigunguCode(s.getSigunguCode())
                .contentTypeId(s.getContentTypeId())
                .homepage(s.getHomepage())
                .distanceKm(s.getDistanceKm())
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

    /** 공공 API 홈페이지 값이 스킴 없이 도메인만 오는 경우가 많아 브라우저 안전 URL 로 보정. */
    private static String normalizeHomepage(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String t = raw.trim();
        if (t.startsWith("//")) return "https:" + t;
        if (t.toLowerCase(Locale.ROOT).startsWith("http://") || t.toLowerCase(Locale.ROOT).startsWith("https://")) {
            return t;
        }
        return "https://" + t;
    }

    private static String joinAddr(String a1, String a2) {
        if ((a1 == null || a1.isBlank()) && (a2 == null || a2.isBlank())) return null;
        StringBuilder sb = new StringBuilder();
        if (a1 != null && !a1.isBlank()) sb.append(a1.trim());
        if (a2 != null && !a2.isBlank()) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(a2.trim());
        }
        return sb.toString();
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

    private record CacheSnapshot(List<WellnessSpot> sites, long loadedAtEpochMs, boolean partial) {
        static CacheSnapshot empty() { return new CacheSnapshot(List.of(), 0L, false); }
    }

    private record PageResult(List<WellnessSpot> items, int totalCount) {}

    private record DetailSnapshot(WellnessSpotDetail detail, long loadedAtEpochMs) {}
}
