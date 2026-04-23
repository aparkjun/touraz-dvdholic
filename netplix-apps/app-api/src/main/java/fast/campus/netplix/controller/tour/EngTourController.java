package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetEngTourUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 영문 관광정보 서비스(EngService2) 공개 API.
 *
 * <p>사용 시나리오:
 * <ul>
 *   <li>프론트엔드가 i18n locale = 'en' 일 때, 국문 특화 스트립(무장애/반려동물/수상작 사진) 대신
 *       이 엔드포인트로 조회한 영문 POI 를 "Travel Spots Around This Film" 스트립에 렌더링.</li>
 *   <li>/cine-trip 페이지의 지역별 K-Content Pilgrimage 섹션은 해당 areaCode 의 영문 대표 관광지를 큐레이션.</li>
 * </ul>
 *
 * <p>엔드포인트:
 * <ul>
 *   <li>GET /api/v1/tour/eng?areaCode=1&type=12&limit=12</li>
 *   <li>GET /api/v1/tour/eng/location?mapX=126.97&mapY=37.57&radius=2000&type=12</li>
 *   <li>GET /api/v1/tour/eng/search?q=Gyeongbokgung&type=12</li>
 *   <li>GET /api/v1/tour/eng/{contentId}?type=12</li>
 *   <li>GET /api/v1/tour/eng/status — serviceKey 설정 여부</li>
 * </ul>
 *
 * <p>contentTypeId(type): 12 Attractions / 14 Cultural / 15 Festivals / 25 Courses /
 * 28 Leisure / 32 Accommodations / 38 Shopping / 39 Restaurants.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/eng")
@RequiredArgsConstructor
public class EngTourController {

    private final GetEngTourUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<EngTourResponse>> byArea(
            @RequestParam(required = false) String areaCode,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<EngTourResponse> body = useCase.byArea(areaCode, contentTypeId, limit)
                .stream().map(EngTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/location")
    public NetplixApiResponse<List<EngTourResponse>> byLocation(
            @RequestParam double mapX,
            @RequestParam double mapY,
            @RequestParam(defaultValue = "3000") int radius,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<EngTourResponse> body = useCase.byLocation(mapX, mapY, radius, contentTypeId, limit)
                .stream().map(EngTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<EngTourResponse>> byKeyword(
            @RequestParam String q,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<EngTourResponse> body = useCase.byKeyword(q, contentTypeId, limit)
                .stream().map(EngTourResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    @GetMapping("/{contentId}")
    public NetplixApiResponse<EngTourResponse> detail(
            @PathVariable String contentId,
            @RequestParam(name = "type", required = false) String contentTypeId) {
        EngTourResponse body = useCase.detail(contentId, contentTypeId)
                .map(EngTourResponse::from)
                .orElse(null);
        return NetplixApiResponse.ok(body);
    }

    public record StatusResponse(boolean configured) {}
}
