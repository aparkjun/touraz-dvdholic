package fast.campus.netplix.controller.admin;

import fast.campus.netplix.admin.*;
import fast.campus.netplix.cinetrip.PendingMappingReview;
import fast.campus.netplix.cinetrip.ReviewPendingMappingUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
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

    public record AdminLoginRequest(String adminId, String password) {}
}
