package fast.campus.netplix.controller.wellness;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.wellness.GetWellnessSpotsUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트 (비로그인 노출 가능):
 * <ul>
 *   <li>GET /api/v1/wellness?limit=0 - 전국 전체 목록 (limit 0 → 전체, 기본 24)</li>
 *   <li>GET /api/v1/wellness?korArea=34&amp;korSigungu=110&amp;limit=0 - KorService 광역코드+시군구 기반 지역 목록</li>
 *   <li>GET /api/v1/wellness/nearby?lat=..&lon=..&radius=10000&limit=50 - 좌표 기반 주변</li>
 *   <li>GET /api/v1/wellness/search?q=온천&limit=24 - 키워드 검색</li>
 * </ul>
 *
 * <p>키 미승인/쿼터 초과 시 어댑터가 빈 리스트 반환 → 프론트에서 섹션 자동 숨김.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/wellness")
@RequiredArgsConstructor
public class WellnessController {

    private final GetWellnessSpotsUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<WellnessSpotResponse>> list(
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(required = false) String korArea,
            @RequestParam(required = false) String korSigungu) {
        List<WellnessSpotResponse> body;
        if (korArea != null && !korArea.isBlank()) {
            body = useCase.byKorAdministrativeArea(
                    korArea.trim(),
                    korSigungu != null ? korSigungu.trim() : null,
                    limit
            ).stream().map(WellnessSpotResponse::from).toList();
        } else {
            body = useCase.all(limit).stream().map(WellnessSpotResponse::from).toList();
        }
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<WellnessSpotResponse>> nearby(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10000") int radius,
            @RequestParam(defaultValue = "50") int limit) {
        List<WellnessSpotResponse> body = useCase.nearby(lat, lon, radius, limit).stream()
                .map(WellnessSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<WellnessSpotResponse>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "24") int limit) {
        List<WellnessSpotResponse> body = useCase.byKeyword(q, limit).stream()
                .map(WellnessSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }
}
