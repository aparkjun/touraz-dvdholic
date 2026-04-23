package fast.campus.netplix.controller.cinetrip;

import fast.campus.netplix.cinetrip.CineTripItem;
import fast.campus.netplix.cinetrip.CineTripUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.controller.tour.AccessiblePoiResponse;
import fast.campus.netplix.controller.tour.PetFriendlyPoiResponse;
import fast.campus.netplix.tour.GetAccessiblePoiUseCase;
import fast.campus.netplix.tour.GetPetFriendlyPoiUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CineTrip 큐레이션 API.
 * - GET /curate: 전체 트렌딩 기반 큐레이션
 * - GET /region/{areaCode}: 특정 지자체의 영화 큐레이션
 * - GET /movie: 특정 영화의 연결 지역 카드
 * - POST /import (인증): CSV 업로드로 매핑 시드
 * - GET /count: 현재 매핑 수 (디버그/대시보드용)
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cine-trip")
@RequiredArgsConstructor
public class CineTripController {

    private final CineTripUseCase cineTripUseCase;
    private final GetAccessiblePoiUseCase accessiblePoiUseCase;
    private final GetPetFriendlyPoiUseCase petFriendlyPoiUseCase;

    /** CineTrip 상세 모달에서 "이 지역 함께 가볼만한 곳" 섹션에 쓰는 키. */
    /**
     * 탭 표시 순서를 보존하기 위해 {@link java.util.LinkedHashMap} 로 선언.
     *
     * <p>여행코스(contentTypeId=25) 는 KTO 무장애 API (KorWithService2) 에
     * 전국적으로 실제 데이터가 0 건이라 버킷에서 제외한다. 공공데이터포털의 일반
     * KorService2 승인이 추가되면 자체 큐레이션 방식으로 재도입을 검토.
     */
    private static final Map<String, String> ACCESSIBLE_BUCKETS;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("attractions", "12");     // 관광지
        m.put("cultural", "14");        // 문화시설 (박물관/미술관/공연장)
        m.put("restaurants", "39");     // 음식점
        m.put("accommodations", "32");  // 숙박
        ACCESSIBLE_BUCKETS = java.util.Collections.unmodifiableMap(m);
    }

    /**
     * 반려동물 동반여행(KorPetTourService) 버킷.
     * KorPetTourService 는 관광지/문화시설/레포츠/숙박/쇼핑/음식점 6종을 제공.
     */
    private static final Map<String, String> PET_BUCKETS;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("attractions", "12");     // 관광지
        m.put("cultural", "14");        // 문화시설
        m.put("leisure", "28");         // 레포츠
        m.put("accommodations", "32");  // 숙박
        m.put("shopping", "38");        // 쇼핑
        m.put("restaurants", "39");     // 음식점
        PET_BUCKETS = java.util.Collections.unmodifiableMap(m);
    }

    @GetMapping("/curate")
    public NetplixApiResponse<List<CineTripResponse>> curate(
            @RequestParam(defaultValue = "12") int limit) {
        List<CineTripItem> items = cineTripUseCase.curate(limit);
        return NetplixApiResponse.ok(items.stream().map(CineTripResponse::from).toList());
    }

    @GetMapping("/region/{areaCode}")
    public NetplixApiResponse<List<CineTripResponse>> byRegion(
            @PathVariable String areaCode,
            @RequestParam(defaultValue = "12") int limit) {
        List<CineTripItem> items = cineTripUseCase.curateByRegion(areaCode, limit);
        return NetplixApiResponse.ok(items.stream().map(CineTripResponse::from).toList());
    }

    @GetMapping("/movie")
    public NetplixApiResponse<List<CineTripResponse>> byMovie(@RequestParam String name) {
        List<CineTripItem> items = cineTripUseCase.getByMovieName(name);
        return NetplixApiResponse.ok(items.stream().map(CineTripResponse::from).toList());
    }

    @PostMapping(value = "/import", consumes = {"multipart/form-data", "text/plain", "application/octet-stream"})
    public NetplixApiResponse<Map<String, Integer>> importCsv(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestBody(required = false) String body) throws Exception {
        String csv = resolveCsv(file, body);
        if (csv == null || csv.isBlank()) {
            return NetplixApiResponse.ok(Map.of("imported", 0));
        }
        int count = cineTripUseCase.importFromCsv(csv);
        log.info("[CINE-TRIP] CSV 업로드: {}행 반영", count);
        return NetplixApiResponse.ok(Map.of("imported", count));
    }

    @GetMapping("/count")
    public NetplixApiResponse<Long> count() {
        return NetplixApiResponse.ok(cineTripUseCase.count());
    }

    /**
     * TMDB 영화 메타에서 한국 지역명을 regex 매칭해 AUTO 매핑을 일괄 생성한다. (관리자 전용)
     * 기존 MANUAL 매핑은 보존된다(동일 movie-area 조합은 스킵).
     *
     * @param maxPerMovie 한 영화당 상위 매칭 지역 N개까지 저장 (기본 3, 최대 5)
     */
    @PostMapping("/auto-map")
    public NetplixApiResponse<CineTripUseCase.AutoMappingReport> autoMap(
            @RequestParam(defaultValue = "3") int maxPerMovie) {
        CineTripUseCase.AutoMappingReport report = cineTripUseCase.runAutoMapping(maxPerMovie);
        log.info("[CINE-TRIP] /auto-map 트리거 결과: {}", report);
        return NetplixApiResponse.ok(report);
    }

    /**
     * CineTrip 상세 모달용 "이 영화 배경지 근처 무장애 스팟" 묶음 조회.
     * 관광지/음식점/숙박 3종을 각 {@code perBucket} 개씩 반환. KorWithService2 미설정 시 빈 맵.
     */
    @GetMapping("/region/{areaCode}/accessible")
    public NetplixApiResponse<Map<String, List<AccessiblePoiResponse>>> accessibleByRegion(
            @PathVariable String areaCode,
            @RequestParam(defaultValue = "5") int perBucket) {
        Map<String, List<AccessiblePoiResponse>> result = new LinkedHashMap<>();
        if (!accessiblePoiUseCase.isConfigured()) {
            ACCESSIBLE_BUCKETS.keySet().forEach(k -> result.put(k, List.of()));
            return NetplixApiResponse.ok(result);
        }
        ACCESSIBLE_BUCKETS.forEach((bucket, typeId) -> {
            List<AccessiblePoiResponse> pois = accessiblePoiUseCase
                    .byArea(areaCode, typeId, perBucket)
                    .stream()
                    .map(AccessiblePoiResponse::from)
                    .toList();
            result.put(bucket, pois);
        });
        return NetplixApiResponse.ok(result);
    }

    /**
     * CineTrip 상세 모달용 "이 영화 배경지에서 반려동물과 함께 갈 수 있는 곳" 묶음 조회.
     * 관광지/문화시설/레포츠/숙박/쇼핑/음식점 6종을 각 {@code perBucket} 개씩 반환.
     * KorPetTourService 미설정 시 빈 맵.
     */
    @GetMapping("/region/{areaCode}/pet-friendly")
    public NetplixApiResponse<Map<String, List<PetFriendlyPoiResponse>>> petFriendlyByRegion(
            @PathVariable String areaCode,
            @RequestParam(defaultValue = "5") int perBucket) {
        Map<String, List<PetFriendlyPoiResponse>> result = new LinkedHashMap<>();
        if (!petFriendlyPoiUseCase.isConfigured()) {
            PET_BUCKETS.keySet().forEach(k -> result.put(k, List.of()));
            return NetplixApiResponse.ok(result);
        }
        PET_BUCKETS.forEach((bucket, typeId) -> {
            List<PetFriendlyPoiResponse> pois = petFriendlyPoiUseCase
                    .byArea(areaCode, typeId, perBucket)
                    .stream()
                    .map(PetFriendlyPoiResponse::from)
                    .toList();
            result.put(bucket, pois);
        });
        return NetplixApiResponse.ok(result);
    }

    private String resolveCsv(MultipartFile file, String body) throws Exception {
        if (file != null && !file.isEmpty()) {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        }
        return body;
    }
}
