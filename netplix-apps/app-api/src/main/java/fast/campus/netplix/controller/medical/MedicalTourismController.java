package fast.campus.netplix.controller.medical;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.medical.GetMedicalTourismSpotsUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트:
 * <ul>
 *   <li>GET /api/v1/medical-tourism?lang=ko&limit=0              - 전국 전체</li>
 *   <li>GET /api/v1/medical-tourism/nearby?lang=en&lat=&lon=&radius=&limit= - 좌표 주변</li>
 *   <li>GET /api/v1/medical-tourism/search?lang=ko&q=K-의료&limit= - 키워드 검색</li>
 * </ul>
 *
 * <p>lang 파라미터로 ko/en 전환. 미지정 시 ko.
 * 키 미승인/쿼터 초과/403 Forbidden 시 어댑터가 빈 리스트 반환 → 프론트 섹션 자동 숨김.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/medical-tourism")
@RequiredArgsConstructor
public class MedicalTourismController {

    private final GetMedicalTourismSpotsUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<MedicalTourismSpotResponse>> list(
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam(defaultValue = "24") int limit) {
        List<MedicalTourismSpotResponse> body = useCase.all(lang, limit).stream()
                .map(MedicalTourismSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<MedicalTourismSpotResponse>> nearby(
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10000") int radius,
            @RequestParam(defaultValue = "50") int limit) {
        List<MedicalTourismSpotResponse> body = useCase.nearby(lang, lat, lon, radius, limit).stream()
                .map(MedicalTourismSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<MedicalTourismSpotResponse>> search(
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam String q,
            @RequestParam(defaultValue = "24") int limit) {
        List<MedicalTourismSpotResponse> body = useCase.byKeyword(lang, q, limit).stream()
                .map(MedicalTourismSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }
}
