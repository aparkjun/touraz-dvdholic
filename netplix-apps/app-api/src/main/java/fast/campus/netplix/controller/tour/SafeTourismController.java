package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetSafeTourismSpotsUseCase;
import fast.campus.netplix.tour.SafeTourismPage;
import fast.campus.netplix.tour.SafeTourismPort;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 한국관광공사 비대면 안심관광지 목록(api.odcloud.kr) 프록시 API.
 *
 * <p>GET /api/v1/tour/safe-tourism-spots?page=1&perPage=20&area=강원&q=숲
 */
@RestController
@RequestMapping("/api/v1/tour/safe-tourism-spots")
@RequiredArgsConstructor
public class SafeTourismController {

    private final GetSafeTourismSpotsUseCase getSafeTourismSpotsUseCase;
    private final SafeTourismPort safeTourismPort;

    @GetMapping
    public NetplixApiResponse<SafeTourismListResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int perPage,
            @RequestParam(required = false) String area,
            @RequestParam(required = false) String q) {
        SafeTourismPage result = getSafeTourismSpotsUseCase.list(page, perPage, area, q);
        return NetplixApiResponse.ok(
                SafeTourismListResponse.from(result, safeTourismPort.isConfigured()));
    }
}
