package fast.campus.netplix.controller.camping;

import fast.campus.netplix.camping.GetCampingSitesUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 고캠핑(GoCamping) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트 (비로그인 노출 가능):
 * <ul>
 *   <li>GET /api/v1/camping?limit=0 - 전국 전체 목록 (limit 0 → 전체, 기본 24)</li>
 *   <li>GET /api/v1/camping/nearby?lat=..&lon=..&radius=10000&limit=50 - 좌표 기반 주변</li>
 *   <li>GET /api/v1/camping/search?q=제주&limit=24 - 키워드 검색</li>
 *   <li>GET /api/v1/camping/{id} - 단일 야영장 상세 (캐시 우선, 미스 시 동기 1페이지 적재)</li>
 *   <li>GET /api/v1/camping/{id}/images - 야영장 이미지 갤러리 (GoCamping /imageList)</li>
 * </ul>
 *
 * <p>키 미승인/쿼터 초과 시 어댑터가 빈 리스트 반환 → 프론트에서 섹션 자동 숨김.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/camping")
@RequiredArgsConstructor
public class CampingController {

    private final GetCampingSitesUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<CampingSiteResponse>> list(
            @RequestParam(defaultValue = "24") int limit) {
        List<CampingSiteResponse> body = useCase.all(limit).stream()
                .map(CampingSiteResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<CampingSiteResponse>> nearby(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10000") int radius,
            @RequestParam(defaultValue = "50") int limit) {
        List<CampingSiteResponse> body = useCase.nearby(lat, lon, radius, limit).stream()
                .map(CampingSiteResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<CampingSiteResponse>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "24") int limit) {
        List<CampingSiteResponse> body = useCase.byKeyword(q, limit).stream()
                .map(CampingSiteResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    /**
     * 단일 야영장 상세. contentId 미존재 또는 어댑터 미설정 시 404 반환 → 프런트가 not-found 페이지로 폴백.
     */
    @GetMapping("/{id}")
    public ResponseEntity<NetplixApiResponse<CampingSiteResponse>> detail(@PathVariable String id) {
        return useCase.byId(id)
                .map(CampingSiteResponse::from)
                .map(NetplixApiResponse::ok)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    /**
     * 야영장 이미지 갤러리 (GoCamping /imageList). 등록 이미지 없으면 빈 리스트.
     * 어댑터 미설정/실패 시에도 빈 리스트로 폴백 → 프런트에서 갤러리 섹션 자연 숨김.
     */
    @GetMapping("/{id}/images")
    public NetplixApiResponse<List<String>> images(@PathVariable String id) {
        return NetplixApiResponse.ok(useCase.images(id));
    }
}
