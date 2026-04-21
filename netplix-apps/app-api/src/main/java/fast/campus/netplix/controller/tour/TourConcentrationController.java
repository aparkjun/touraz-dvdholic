package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetTourConcentrationUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 관광지 집중률(혼잡도) 7일 예측 조회 API.
 * 출처: 한국관광공사 TatsCnctrRateService / tatsCnctrRatedList (공공데이터 15128555)
 *
 * <p>퍼블릭 엔드포인트:
 * <ul>
 *   <li>GET /api/v1/cine-trip/concentration?areaCode=6
 *       → 서비스가 보유한 광역 대표 시군구 큐레이션으로 조회 (부산 → 중구 대표 관광지)</li>
 *   <li>GET /api/v1/cine-trip/concentration?areaCode=6&signguCode=26350
 *       → 호출자가 시군구 직접 지정 (해운대구)</li>
 *   <li>GET /api/v1/cine-trip/concentration?areaCode=1&signguCode=11110&spotName=경복궁
 *       → 특정 관광지 필터</li>
 * </ul>
 *
 * <p>응답은 오늘 포함 향후 N일(보통 7일) 예측. 프론트에서는 주간 히트맵으로 시각화.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cine-trip/concentration")
@RequiredArgsConstructor
public class TourConcentrationController {

    private final GetTourConcentrationUseCase getTourConcentrationUseCase;

    @GetMapping
    public NetplixApiResponse<List<TourConcentrationResponse>> concentration(
            @RequestParam String areaCode,
            @RequestParam(required = false) String signguCode,
            @RequestParam(required = false) String spotName) {

        final List<TourConcentrationResponse> body;
        if (signguCode != null && !signguCode.isBlank()) {
            body = getTourConcentrationUseCase.bySignguCode(areaCode, signguCode, spotName)
                    .stream().map(TourConcentrationResponse::from).toList();
        } else {
            body = getTourConcentrationUseCase.byAreaCode(areaCode)
                    .stream().map(TourConcentrationResponse::from).toList();
        }
        return NetplixApiResponse.ok(body);
    }
}
