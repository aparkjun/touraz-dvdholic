package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetPetFriendlyPoiUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 한국관광공사 반려동물 동반여행(KorPetTourService) 공개 API.
 *
 * <p>엔드포인트 (비로그인 노출 가능):
 * <ul>
 *   <li>GET /api/v1/tour/pet-friendly?areaCode=1&type=12&limit=12</li>
 *   <li>GET /api/v1/tour/pet-friendly/location?mapX=126.97&mapY=37.57&radius=2000&type=39</li>
 *   <li>GET /api/v1/tour/pet-friendly/search?q=해운대&type=32</li>
 *   <li>GET /api/v1/tour/pet-friendly/{contentId}?type=12 — detailCommon2 + detailPetTour2 병합</li>
 *   <li>GET /api/v1/tour/pet-friendly/status — serviceKey 설정 여부</li>
 * </ul>
 *
 * <p>contentTypeId(type 파라미터):
 * <ul>
 *   <li>12 관광지 / 14 문화시설 / 28 레포츠</li>
 *   <li>32 숙박 / 38 쇼핑 / 39 음식점</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/pet-friendly")
@RequiredArgsConstructor
public class PetFriendlyPoiController {

    private final GetPetFriendlyPoiUseCase useCase;

    @GetMapping
    public NetplixApiResponse<List<PetFriendlyPoiResponse>> byArea(
            @RequestParam(required = false) String areaCode,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<PetFriendlyPoiResponse> body = useCase.byArea(areaCode, contentTypeId, limit)
                .stream().map(PetFriendlyPoiResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/location")
    public NetplixApiResponse<List<PetFriendlyPoiResponse>> byLocation(
            @RequestParam double mapX,
            @RequestParam double mapY,
            @RequestParam(defaultValue = "3000") int radius,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<PetFriendlyPoiResponse> body = useCase.byLocation(mapX, mapY, radius, contentTypeId, limit)
                .stream().map(PetFriendlyPoiResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<PetFriendlyPoiResponse>> byKeyword(
            @RequestParam String q,
            @RequestParam(name = "type", required = false) String contentTypeId,
            @RequestParam(defaultValue = "12") int limit) {
        List<PetFriendlyPoiResponse> body = useCase.byKeyword(q, contentTypeId, limit)
                .stream().map(PetFriendlyPoiResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    @GetMapping("/{contentId}")
    public NetplixApiResponse<PetFriendlyPoiResponse> detail(
            @PathVariable String contentId,
            @RequestParam(name = "type", required = false) String contentTypeId) {
        PetFriendlyPoiResponse body = useCase.detail(contentId, contentTypeId)
                .map(PetFriendlyPoiResponse::from)
                .orElse(null);
        return NetplixApiResponse.ok(body);
    }

    public record StatusResponse(boolean configured) {}
}
