package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetTourGalleriesUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 관광사진갤러리(PhotoGalleryService1) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트 (비로그인 노출 가능):
 * <ul>
 *   <li>GET /api/v1/tour-gallery?q=부산&amp;limit=0 - 키워드 검색, limit≤0 이면 캐시 전체(어댑터 상한 내)</li>
 *   <li>GET /api/v1/tour-gallery?limit=0 - 전체 최신(동일)</li>
 * </ul>
 *
 * <p>키 미승인/쿼터 초과 시 어댑터가 빈 리스트 반환 → 프론트에서 섹션 자동 숨김.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour-gallery")
@RequiredArgsConstructor
public class TourGalleryController {

    private final GetTourGalleriesUseCase getTourGalleriesUseCase;

    @GetMapping
    public NetplixApiResponse<List<TourGalleryResponse>> gallery(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int limit) {

        final List<TourGalleryResponse> body;
        if (q != null && !q.isBlank()) {
            body = getTourGalleriesUseCase.byKeyword(q, limit).stream()
                    .map(TourGalleryResponse::from).toList();
        } else {
            body = getTourGalleriesUseCase.all(limit).stream()
                    .map(TourGalleryResponse::from).toList();
        }
        return NetplixApiResponse.ok(body);
    }
}
