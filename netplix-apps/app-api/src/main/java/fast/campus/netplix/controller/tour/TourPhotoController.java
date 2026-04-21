package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetTourPhotosUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 관광공모전(사진) 수상작 조회 API.
 *
 * <p>퍼블릭 엔드포인트 (비로그인 노출 가능):
 * <ul>
 *   <li>GET /api/v1/cine-trip/photos?limit=12 - 전체</li>
 *   <li>GET /api/v1/cine-trip/photos?areaCode=6 - KorService2 areaCode 필터</li>
 *   <li>GET /api/v1/cine-trip/photos?lDongRegnCd=26 - 법정동 광역코드 필터</li>
 *   <li>GET /api/v1/cine-trip/photos?q=가야산 - 키워드 검색</li>
 * </ul>
 *
 * <p>우선순위: q > lDongRegnCd > areaCode > 전체
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cine-trip/photos")
@RequiredArgsConstructor
public class TourPhotoController {

    private final GetTourPhotosUseCase getTourPhotosUseCase;

    @GetMapping
    public NetplixApiResponse<List<TourPhotoResponse>> photos(
            @RequestParam(required = false) String areaCode,
            @RequestParam(required = false) String lDongRegnCd,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "12") int limit) {

        final List<TourPhotoResponse> body;
        if (q != null && !q.isBlank()) {
            body = getTourPhotosUseCase.byKeyword(q, limit).stream().map(TourPhotoResponse::from).toList();
        } else if (lDongRegnCd != null && !lDongRegnCd.isBlank()) {
            body = getTourPhotosUseCase.byLDongRegnCd(lDongRegnCd, limit).stream().map(TourPhotoResponse::from).toList();
        } else if (areaCode != null && !areaCode.isBlank()) {
            body = getTourPhotosUseCase.byAreaCode(areaCode, limit).stream().map(TourPhotoResponse::from).toList();
        } else {
            body = getTourPhotosUseCase.all(limit).stream().map(TourPhotoResponse::from).toList();
        }
        return NetplixApiResponse.ok(body);
    }
}
