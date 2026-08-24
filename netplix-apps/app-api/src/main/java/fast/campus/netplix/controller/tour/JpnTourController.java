package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetJpnTourUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 일문 관광정보 서비스(JpnService2) 공개 API.
 *
 * <p>{@link EngTourController} 의 일본어 대응. 프론트엔드가 i18n locale = 'ja' 일 때, 국문 특화
 * 스트립(무장애/반려동물/수상작 사진) 대신 이 엔드포인트로 조회한 일문 POI 를
 * "この映画ゆかりの旅行スポット" 스트립에 렌더링한다.
 *
 * <p>엔드포인트:
 * <ul>
 *   <li>GET /api/v1/tour/jpn?areaCode=1&type=12&limit=12</li>
 *   <li>GET /api/v1/tour/jpn/location?mapX=126.97&mapY=37.57&radius=2000&type=12</li>
 *   <li>GET /api/v1/tour/jpn/search?q=景福宮&type=12</li>
 *   <li>GET /api/v1/tour/jpn/{contentId}?type=12</li>
 *   <li>GET /api/v1/tour/jpn/status — serviceKey 설정 여부</li>
 * </ul>
 *
 * <p>contentTypeId(type): 국문 코드(12/14/…)를 그대로 넘기면 어댑터가 JpnService2 체계로 자동 변환.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/jpn")
@RequiredArgsConstructor
public class JpnTourController {

    private final GetJpnTourUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<JpnTourResponse>> byArea(
            @RequestParam(required = false) String areaCode,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<JpnTourResponse> body = useCase.byArea(areaCode, contentTypeId, limit)
                .stream().map(JpnTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/location")
    public NetplixApiResponse<List<JpnTourResponse>> byLocation(
            @RequestParam double mapX,
            @RequestParam double mapY,
            @RequestParam(defaultValue = "3000") int radius,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<JpnTourResponse> body = useCase.byLocation(mapX, mapY, radius, contentTypeId, limit)
                .stream().map(JpnTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<JpnTourResponse>> byKeyword(
            @RequestParam String q,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<JpnTourResponse> body = useCase.byKeyword(q, contentTypeId, limit)
                .stream().map(JpnTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    @GetMapping("/{contentId}")
    public NetplixApiResponse<JpnTourResponse> detail(
            @PathVariable String contentId,
            @RequestParam(name = "type", required = false) String contentTypeId) {
        JpnTourResponse body = useCase.detail(contentId, contentTypeId)
                .map(JpnTourResponse::from)
                .orElse(null);
        return NetplixApiResponse.ok(body);
    }

    public record StatusResponse(boolean configured) {}
}
