package fast.campus.netplix.visitkorea;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.TourPhoto;
import fast.campus.netplix.tour.TourPhotoPort;
import fast.campus.netplix.util.ObjectMapperUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * 한국관광공사 관광공모전(사진) 수상작 HTTP 어댑터.
 *
 * <p>전략: KTO PhokoAwrdService 의 totalCount 만큼 모든 페이지를 순회해 메모리에 적재 후 필터링.
 * - 콜드 스타트 시 @PostConstruct 로 프리워밍(실패해도 기동 계속)
 * - {@code cache-minutes}(기본 1440 = 24h) 지나면 다음 호출 시 지연 재조회
 * - serviceKey 미설정 시 {@link #isConfigured()} false, 모든 조회가 빈 리스트 반환
 *
 * <p>과거에는 페이지 1회만 호출하고 numOfRows=200 으로 잘랐다. 그러나 KTO 가
 * 매년 신규 수상작을 추가 적재하면서 200 건을 넘어서기 시작했고, 결과적으로
 * 프런트의 "전국 수상작 포토스팟" 이 항상 같은 36~200 건만 보이는 문제가 발생.
 * 이제 totalCount 를 신뢰해 전 페이지를 누적하되, 안전을 위해 최대 페이지 수
 * 상한을 두어 무한 루프(잘못된 totalCount, 401, 한도 초과)를 차단한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VisitKoreaPhokoHttpClient implements TourPhotoPort {

    // 페이지당 가져올 row 수. KTO 가 numOfRows 상한을 명시하지 않지만 200 정도가 안정 범위.
    private static final int PAGE_SIZE = 200;
    // 안전 상한 — 페이지 50 * 200 = 10,000 건이면 PhokoAwrdService 데이터셋을 충분히 덮는다.
    private static final int MAX_PAGES = 50;

    // KorService2 areaCode → 법정동 광역코드(lDongRegnCd) 매핑.
    // 서비스 전반의 CineTrip UI 가 KorService2 체계(1~8/31~39) 를 쓰는 반면
    // Phoko 는 법정동코드(11/26/27/...) 를 쓰기 때문에 필요.
    private static final Map<String, String> AREA_CODE_TO_LDONG = Map.ofEntries(
            Map.entry("1", "11"),  // 서울
            Map.entry("2", "28"),  // 인천
            Map.entry("3", "30"),  // 대전
            Map.entry("4", "27"),  // 대구
            Map.entry("5", "29"),  // 광주
            Map.entry("6", "26"),  // 부산
            Map.entry("7", "31"),  // 울산
            Map.entry("8", "36"),  // 세종
            Map.entry("31", "41"), // 경기
            Map.entry("32", "51"), // 강원(특별자치도) - 과거 42
            Map.entry("33", "43"), // 충북
            Map.entry("34", "44"), // 충남
            Map.entry("35", "47"), // 경북
            Map.entry("36", "48"), // 경남
            Map.entry("37", "52"), // 전북(특별자치도) - 과거 45
            Map.entry("38", "46"), // 전남
            Map.entry("39", "50")  // 제주
    );

    private final HttpClient httpClient;

    @Value("${visitkorea.auth.service-key:}")
    private String serviceKey;

    @Value("${visitkorea.phoko.award-list:}")
    private String awardListUrl;

    @Value("${visitkorea.phoko.cache-minutes:1440}")
    private long cacheMinutes;

    private final AtomicReference<CacheSnapshot> cache = new AtomicReference<>(CacheSnapshot.empty());

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && awardListUrl != null && !awardListUrl.isBlank();
    }

    @PostConstruct
    void prewarm() {
        if (!isConfigured()) {
            log.info("[PHOKO] serviceKey/URL 미설정 - 프리워밍 생략");
            return;
        }
        try {
            refresh();
            log.info("[PHOKO] 프리워밍 완료 - {} 건 로드", cache.get().photos.size());
        } catch (Exception ex) {
            log.warn("[PHOKO] 프리워밍 실패 (다음 호출에서 재시도): {}", ex.getMessage());
        }
    }

    @Override
    public List<TourPhoto> fetchAll(int limit) {
        List<TourPhoto> all = getCachedOrRefresh();
        return take(all, limit);
    }

    @Override
    public List<TourPhoto> fetchByLDongRegnCd(String lDongRegnCd, int limit) {
        if (lDongRegnCd == null || lDongRegnCd.isBlank()) return fetchAll(limit);
        List<TourPhoto> filtered = getCachedOrRefresh().stream()
                .filter(p -> lDongRegnCd.equals(p.getLDongRegnCd()))
                .collect(Collectors.toList());
        return take(filtered, limit);
    }

    @Override
    public List<TourPhoto> fetchByAreaCode(String areaCode, int limit) {
        if (areaCode == null || areaCode.isBlank()) return fetchAll(limit);
        String ldong = AREA_CODE_TO_LDONG.get(areaCode);
        if (ldong == null) {
            log.warn("[PHOKO] 미매핑 areaCode={} - 전체 반환", areaCode);
            return fetchAll(limit);
        }
        return fetchByLDongRegnCd(ldong, limit);
    }

    @Override
    public List<TourPhoto> fetchByKeyword(String keyword, int limit) {
        if (keyword == null || keyword.isBlank()) return fetchAll(limit);
        String needle = keyword.toLowerCase(Locale.ROOT);
        List<TourPhoto> matched = getCachedOrRefresh().stream()
                .filter(p -> containsCI(p.getTitle(), needle)
                        || containsCI(p.getFilmSite(), needle)
                        || containsCI(p.getKeywords(), needle))
                .collect(Collectors.toList());
        return take(matched, limit);
    }

    private List<TourPhoto> getCachedOrRefresh() {
        CacheSnapshot snap = cache.get();
        long ageMin = (Instant.now().toEpochMilli() - snap.loadedAtEpochMs) / 60_000L;
        if (snap.photos.isEmpty() || ageMin >= cacheMinutes) {
            try {
                refresh();
            } catch (Exception ex) {
                log.warn("[PHOKO] 캐시 갱신 실패 (stale 반환): {}", ex.getMessage());
            }
        }
        return cache.get().photos;
    }

    private synchronized void refresh() {
        if (!isConfigured()) {
            cache.set(CacheSnapshot.empty());
            return;
        }

        List<TourPhoto> accumulated = new ArrayList<>();
        Integer reportedTotal = null;

        for (int pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
            String url = awardListUrl
                    + (awardListUrl.contains("?") ? "&" : "?")
                    + "serviceKey=" + serviceKey
                    + "&_type=json"
                    + "&MobileOS=ETC"
                    + "&MobileApp=touraz-dvdholic"
                    + "&numOfRows=" + PAGE_SIZE
                    + "&pageNo=" + pageNo;

            String raw;
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.add(HttpHeaders.ACCEPT, "application/json");
                raw = httpClient.request(url, HttpMethod.GET, headers, Map.of());
            } catch (Exception ex) {
                log.error("[PHOKO] 호출 실패 page={} err={}", pageNo, ex.getMessage());
                break;
            }

            if (raw == null || raw.isBlank()) {
                log.warn("[PHOKO] 빈 응답 page={}", pageNo);
                break;
            }

            VisitKoreaPhokoResponse parsed;
            try {
                String safe = raw.replace("\"items\":\"\"", "\"items\":null");
                parsed = ObjectMapperUtil.toObject(safe, VisitKoreaPhokoResponse.class);
            } catch (Exception ex) {
                log.error("[PHOKO] 파싱 실패 page={} err={}", pageNo, ex.getMessage());
                break;
            }

            if (parsed == null || parsed.getResponse() == null
                    || parsed.getResponse().getBody() == null
                    || parsed.getResponse().getBody().getItems() == null
                    || parsed.getResponse().getBody().getItems().getItem() == null) {
                if (pageNo == 1) {
                    log.info("[PHOKO] items 없음 - 캐시 비움");
                    cache.set(CacheSnapshot.empty());
                    return;
                }
                break;
            }

            List<TourPhoto> page = parsed.getResponse().getBody().getItems().getItem().stream()
                    .filter(i -> i.getOrgImage() != null || i.getThumbImage() != null)
                    .map(VisitKoreaPhokoHttpClient::toDomain)
                    .collect(Collectors.toList());

            if (page.isEmpty()) break;
            accumulated.addAll(page);

            if (reportedTotal == null) {
                reportedTotal = parsed.getResponse().getBody().getTotalCount();
            }

            // 마지막 페이지 검출: ① totalCount 신뢰, ② 페이지가 PAGE_SIZE 미만이면 종료.
            if (reportedTotal != null && accumulated.size() >= reportedTotal) break;
            if (page.size() < PAGE_SIZE) break;
        }

        cache.set(new CacheSnapshot(Collections.unmodifiableList(accumulated), Instant.now().toEpochMilli()));
        log.info("[PHOKO] 캐시 갱신 - {} 건 (KTO totalCount={})",
                accumulated.size(), reportedTotal == null ? "?" : reportedTotal.toString());
    }

    private static TourPhoto toDomain(VisitKoreaPhokoResponse.Item i) {
        return TourPhoto.builder()
                .contentId(i.getContentId())
                .title(i.getKoTitle())
                .titleEn(i.getEnTitle())
                .lDongRegnCd(i.getLDongRegnCd())
                .filmSite(i.getKoFilmst())
                .filmSiteEn(i.getEnFilmst())
                .filmDay(i.getFilmDay())
                .photographer(i.getKoCmanNm())
                .award(i.getKoWnprzDiz())
                .keywords(i.getKoKeyWord())
                .imageUrl(i.getOrgImage())
                .thumbnailUrl(i.getThumbImage() != null ? i.getThumbImage() : i.getOrgImage())
                .copyrightType(i.getCpyrhtDivCd())
                .build();
    }

    private static <T> List<T> take(List<T> list, int limit) {
        if (limit <= 0 || limit >= list.size()) return list;
        return list.subList(0, limit);
    }

    private static boolean containsCI(String haystack, String needleLower) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needleLower);
    }

    private record CacheSnapshot(List<TourPhoto> photos, long loadedAtEpochMs) {
        static CacheSnapshot empty() {
            return new CacheSnapshot(List.of(), 0L);
        }
    }
}
