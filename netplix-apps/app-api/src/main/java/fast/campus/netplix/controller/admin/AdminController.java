package fast.campus.netplix.controller.admin;

import fast.campus.netplix.admin.*;
import fast.campus.netplix.cinetrip.PendingMappingReview;
import fast.campus.netplix.cinetrip.ReviewPendingMappingUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.AccessiblePoi;
import fast.campus.netplix.tour.GetAccessiblePoiUseCase;
import fast.campus.netplix.tour.GetPetFriendlyPoiUseCase;
import fast.campus.netplix.tour.PetFriendlyPoi;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminLoginUseCase adminLoginUseCase;
    private final AdminDashboardUseCase adminDashboardUseCase;
    private final CultureVsTourInsightUseCase cultureVsTourInsightUseCase;
    private final ReviewPendingMappingUseCase reviewPendingMappingUseCase;
    private final GetAccessiblePoiUseCase accessiblePoiUseCase;
    private final GetPetFriendlyPoiUseCase petFriendlyPoiUseCase;

    /** 17개 광역시도 (KorService2 areaCode + 표기명). */
    private static final List<String[]> KTO_REGIONS = List.of(
            new String[]{"1", "서울"}, new String[]{"2", "인천"}, new String[]{"3", "대전"},
            new String[]{"4", "대구"}, new String[]{"5", "광주"}, new String[]{"6", "부산"},
            new String[]{"7", "울산"}, new String[]{"8", "세종"}, new String[]{"31", "경기"},
            new String[]{"32", "강원"}, new String[]{"33", "충북"}, new String[]{"34", "충남"},
            new String[]{"35", "경북"}, new String[]{"36", "경남"}, new String[]{"37", "전북"},
            new String[]{"38", "전남"}, new String[]{"39", "제주"}
    );

    @PostMapping("/login")
    public NetplixApiResponse<Map<String, String>> login(@RequestBody AdminLoginRequest request) {
        AdminLoginResult result = adminLoginUseCase.login(request.adminId(), request.password());
        return NetplixApiResponse.ok(Map.of("token", result.token()));
    }

    @GetMapping("/admins")
    public NetplixApiResponse<List<AdminInfo>> getAdmins() {
        return NetplixApiResponse.ok(adminDashboardUseCase.getAdmins());
    }

    @GetMapping("/users")
    public NetplixApiResponse<List<AdminUserInfo>> getUsers() {
        return NetplixApiResponse.ok(adminDashboardUseCase.getUsers());
    }

    @GetMapping("/access-logs")
    public NetplixApiResponse<List<AccessLogInfo>> getAccessLogs() {
        return NetplixApiResponse.ok(adminDashboardUseCase.getAccessLogs());
    }

    @GetMapping("/daily-stats")
    public NetplixApiResponse<List<DailyStatsInfo>> getDailyStats() {
        return NetplixApiResponse.ok(adminDashboardUseCase.getDailyStats());
    }

    /**
     * "문화×관광 인사이트" (US-5). 지자체별 DVD 매장 통계 + 관광공사 지표 결합.
     */
    @GetMapping("/insights/culture-vs-tour")
    public NetplixApiResponse<List<CultureVsTourRow>> getCultureVsTour() {
        return NetplixApiResponse.ok(cultureVsTourInsightUseCase.getRows());
    }

    /**
     * 동일 데이터를 엑셀 호환 CSV(UTF-8 BOM)로 다운로드.
     */
    @GetMapping(value = "/insights/culture-vs-tour.csv")
    public ResponseEntity<byte[]> downloadCultureVsTourCsv() {
        List<CultureVsTourRow> rows = cultureVsTourInsightUseCase.getRows();
        StringBuilder sb = new StringBuilder();
        sb.append("areaCode,regionName,totalStores,operatingStores,closedStores,closureRate,"
                + "tourDemandIdx,tourCompetitiveness,culturalResourceDemand,searchVolume\n");
        for (CultureVsTourRow r : rows) {
            sb.append(csv(r.getAreaCode())).append(',')
              .append(csv(r.getRegionName())).append(',')
              .append(r.getTotalStores()).append(',')
              .append(r.getOperatingStores()).append(',')
              .append(r.getClosedStores()).append(',')
              .append(fmt(r.getClosureRate())).append(',')
              .append(fmt(r.getTourDemandIdx())).append(',')
              .append(fmt(r.getTourCompetitiveness())).append(',')
              .append(fmt(r.getCulturalResourceDemand())).append(',')
              .append(r.getSearchVolume() == null ? "" : r.getSearchVolume())
              .append('\n');
        }
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
        byte[] body = sb.toString().getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[bom.length + body.length];
        System.arraycopy(bom, 0, out, 0, bom.length);
        System.arraycopy(body, 0, out, bom.length, body.length);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"culture-vs-tour.csv\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(out);
    }

    private static String csv(String v) {
        if (v == null) return "";
        boolean needQuote = v.contains(",") || v.contains("\"") || v.contains("\n");
        String escaped = v.replace("\"", "\"\"");
        return needQuote ? '"' + escaped + '"' : escaped;
    }

    private static String fmt(Double v) {
        if (v == null) return "";
        if (v == Math.floor(v) && !Double.isInfinite(v)) return String.valueOf(v.longValue());
        return String.format(Locale.ROOT, "%.2f", v);
    }

    // --------------------------------------------------------------------
    //  AI 매핑 승인 큐 (AutoTagCineTripMappingBatch)
    // --------------------------------------------------------------------

    @GetMapping("/cine-trip/pending-mappings")
    public NetplixApiResponse<Map<String, Object>> getPendingMappings(
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        List<PendingMappingReview> rows = reviewPendingMappingUseCase.findPending(limit);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", reviewPendingMappingUseCase.countPending());
        out.put("items", rows);
        return NetplixApiResponse.ok(out);
    }

    @PostMapping("/cine-trip/pending-mappings/{id}/approve")
    public NetplixApiResponse<String> approvePendingMapping(@PathVariable("id") Long id) {
        reviewPendingMappingUseCase.approve(id);
        return NetplixApiResponse.ok("approved");
    }

    @PostMapping("/cine-trip/pending-mappings/{id}/reject")
    public NetplixApiResponse<String> rejectPendingMapping(@PathVariable("id") Long id) {
        reviewPendingMappingUseCase.reject(id);
        return NetplixApiResponse.ok("rejected");
    }

    // --------------------------------------------------------------------
    //  무장애 여행 POI 커버리지 (KorWithService2)
    // --------------------------------------------------------------------
    // - 17개 광역 × 1 콘텐츠타입 로딩 (어댑터 6h TTL 캐시 재사용).
    // - 접근성 유형별(physical/visual/hearing/family) 보유 비율을 함께 집계한다.

    /**
     * 지역별 무장애 POI 수 + 접근성 유형별 보유 비율.
     *
     * @param type 콘텐츠타입 ID (12 관광지/14 문화/25 코스/32 숙박/39 음식점). 기본 12.
     */
    @GetMapping("/insights/accessible-coverage")
    public NetplixApiResponse<Map<String, Object>> accessibleCoverage(
            @RequestParam(name = "type", defaultValue = "12") String contentTypeId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("contentTypeId", contentTypeId);
        out.put("configured", accessiblePoiUseCase.isConfigured());
        List<Map<String, Object>> rows = new ArrayList<>();
        int sumTotal = 0, sumPhysical = 0, sumVisual = 0, sumHearing = 0, sumFamily = 0;
        for (String[] r : KTO_REGIONS) {
            String areaCode = r[0];
            String regionName = r[1];
            List<AccessiblePoi> pois = accessiblePoiUseCase.byArea(areaCode, contentTypeId, 30);
            int total = pois.size();
            int physical = (int) pois.stream().filter(AccessiblePoi::hasPhysicalAccess).count();
            int visual = (int) pois.stream().filter(AccessiblePoi::hasVisualAccess).count();
            int hearing = (int) pois.stream().filter(AccessiblePoi::hasHearingAccess).count();
            int family = (int) pois.stream().filter(AccessiblePoi::hasFamilyAccess).count();
            sumTotal += total;
            sumPhysical += physical;
            sumVisual += visual;
            sumHearing += hearing;
            sumFamily += family;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("areaCode", areaCode);
            row.put("regionName", regionName);
            row.put("total", total);
            row.put("physical", physical);
            row.put("visual", visual);
            row.put("hearing", hearing);
            row.put("family", family);
            rows.add(row);
        }
        out.put("rows", rows);
        Map<String, Integer> totals = new LinkedHashMap<>();
        totals.put("total", sumTotal);
        totals.put("physical", sumPhysical);
        totals.put("visual", sumVisual);
        totals.put("hearing", sumHearing);
        totals.put("family", sumFamily);
        out.put("totals", totals);
        return NetplixApiResponse.ok(out);
    }

    // --------------------------------------------------------------------
    //  반려동물 동반여행 POI 커버리지 (KorPetTourService)
    // --------------------------------------------------------------------
    // - 17개 광역 × 1 콘텐츠타입 로딩 (어댑터 6h TTL 캐시 재사용).
    // - 동반 구분(fully/limited/unknown) 분포와 detailPetTour2 보강 여부를 함께 집계.

    /**
     * 지역별 반려동물 친화 POI 수 + 동반 가능 구분 분포.
     *
     * @param type 콘텐츠타입 ID (12/14/28/32/38/39). 기본 12.
     */
    @GetMapping("/insights/pet-friendly-coverage")
    public NetplixApiResponse<Map<String, Object>> petFriendlyCoverage(
            @RequestParam(name = "type", defaultValue = "12") String contentTypeId) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("contentTypeId", contentTypeId);
        out.put("configured", petFriendlyPoiUseCase.isConfigured());
        List<Map<String, Object>> rows = new ArrayList<>();
        int sumTotal = 0, sumFully = 0, sumLimited = 0, sumUnknown = 0;
        for (String[] r : KTO_REGIONS) {
            String areaCode = r[0];
            String regionName = r[1];
            List<PetFriendlyPoi> pois = petFriendlyPoiUseCase.byArea(areaCode, contentTypeId, 30);
            int total = pois.size();
            int fully = (int) pois.stream().filter(PetFriendlyPoi::isFullyAllowed).count();
            int limited = (int) pois.stream().filter(PetFriendlyPoi::isLimitedAllowed).count();
            int unknown = total - fully - limited
                    - (int) pois.stream().filter(PetFriendlyPoi::isNotAllowed).count();
            sumTotal += total;
            sumFully += fully;
            sumLimited += limited;
            sumUnknown += Math.max(0, unknown);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("areaCode", areaCode);
            row.put("regionName", regionName);
            row.put("total", total);
            row.put("fullyAllowed", fully);
            row.put("limitedAllowed", limited);
            row.put("unknownPolicy", Math.max(0, unknown));
            rows.add(row);
        }
        out.put("rows", rows);
        Map<String, Integer> totals = new LinkedHashMap<>();
        totals.put("total", sumTotal);
        totals.put("fullyAllowed", sumFully);
        totals.put("limitedAllowed", sumLimited);
        totals.put("unknownPolicy", sumUnknown);
        out.put("totals", totals);
        return NetplixApiResponse.ok(out);
    }

    public record AdminLoginRequest(String adminId, String password) {}
}
