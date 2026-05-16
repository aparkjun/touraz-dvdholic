package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetTravelArticlesUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 한국관광공사 여행기사목록(공공데이터 15121757, api.odcloud.kr) 프록시 API.
 *
 * <p>GET /api/v1/tour/travel-articles?page=1&perPage=20&areaCode=32&q=강릉
 */
@RestController
@RequestMapping("/api/v1/tour/travel-articles")
@RequiredArgsConstructor
public class TravelArticleController {

    private final GetTravelArticlesUseCase getTravelArticlesUseCase;

    @GetMapping
    public NetplixApiResponse<TravelArticleListResponse> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int perPage,
            @RequestParam(required = false) String areaCode,
            @RequestParam(required = false) String q) {
        return NetplixApiResponse.ok(
                TravelArticleListResponse.from(
                        getTravelArticlesUseCase.list(page, perPage, areaCode, q)));
    }
}
