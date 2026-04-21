package fast.campus.netplix.controller.cinetrip;

import fast.campus.netplix.cinetrip.CineTripItem;
import fast.campus.netplix.cinetrip.CineTripUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
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

    private String resolveCsv(MultipartFile file, String body) throws Exception {
        if (file != null && !file.isEmpty()) {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        }
        return body;
    }
}
