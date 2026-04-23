package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetDurunubiUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) 걷기여행 공개 API.
 *
 * <p>엔드포인트 (비로그인 노출 가능, SecurityConfig 의 {@code /api/v1/tour/**} permitAll 규칙 적용):
 * <ul>
 *   <li>GET /api/v1/tour/trekking/routes?limit=20 — 길(해파랑/남파랑/서해랑/DMZ 등) 목록</li>
 *   <li>GET /api/v1/tour/trekking/courses?brdDiv=DNWW&routeIdx=...&keyword=해운대&limit=30 — 코스 목록</li>
 *   <li>GET /api/v1/tour/trekking/status — serviceKey 및 URL 설정 여부</li>
 * </ul>
 *
 * <p>TourAPI Guide v4.1 기준 공식 오퍼레이션은 2종({@code courseList}, {@code routeList}) 뿐이며,
 * 각 응답에 GPX 경로·지역·난이도·거리·주요 경유지가 포함되어 상세 카드 렌더링까지 커버된다.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/trekking")
@RequiredArgsConstructor
public class TrekkingController {

    private final GetDurunubiUseCase useCase;

    @GetMapping("/routes")
    public NetplixApiResponse<List<DurunubiRouteResponse>> routes(
            @RequestParam(defaultValue = "20") int limit) {
        List<DurunubiRouteResponse> body = useCase.routes(limit).stream()
                .map(DurunubiRouteResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/courses")
    public NetplixApiResponse<List<DurunubiCourseResponse>> courses(
            @RequestParam(required = false) String brdDiv,
            @RequestParam(required = false) String routeIdx,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "24") int limit) {
        List<DurunubiCourseResponse> body = useCase.courses(brdDiv, routeIdx, keyword, limit).stream()
                .map(DurunubiCourseResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    public record StatusResponse(boolean configured) {}
}
