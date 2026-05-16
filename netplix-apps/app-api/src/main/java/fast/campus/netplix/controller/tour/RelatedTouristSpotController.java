package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetRelatedTouristSpotUseCase;
import fast.campus.netplix.tour.RelatedTouristSpot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 한국관광공사 "관광지별 연관 관광지 정보"(TarRlteTarService1) 공개 API.
 *
 * <p>엔드포인트:
 * <ul>
 *   <li>GET /api/v1/tour/related/keyword?q=한라산&limit=20  — 키워드 검색</li>
 *   <li>GET /api/v1/tour/related/area?areaCode=39&signguCode=39010&limit=20 — 지역기반</li>
 *   <li>GET /api/v1/tour/related/grouped/keyword?q=한라산  — 기준 관광지별 그룹화 + 카테고리/순위 정렬</li>
 *   <li>GET /api/v1/tour/related/grouped/area?areaCode=39&signguCode= — 광역(·시군구) 코드로 조회 후 동일 그룹화</li>
 *   <li>GET /api/v1/tour/related/status — 어댑터 설정 상태</li>
 * </ul>
 *
 * <p>"조용한 명소 + 함께 가는 핫플" 추천을 그룹화해 한 번에 그려주기 위해
 * {@code /grouped/keyword} 엔드포인트는 응답을 (기준 관광지) → (연관 관광지 N건)
 * 구조로 재배치한다.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/related")
@RequiredArgsConstructor
public class RelatedTouristSpotController {

    private final GetRelatedTouristSpotUseCase useCase;

    @GetMapping("/keyword")
    public NetplixApiResponse<List<RelatedTouristSpotResponse>> byKeyword(
            @RequestParam String q,
            @RequestParam(defaultValue = "20") int limit) {
        List<RelatedTouristSpotResponse> body = useCase.byKeyword(q, limit)
                .stream().map(RelatedTouristSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/area")
    public NetplixApiResponse<List<RelatedTouristSpotResponse>> byArea(
            @RequestParam String areaCode,
            @RequestParam(required = false) String signguCode,
            @RequestParam(defaultValue = "20") int limit) {
        List<RelatedTouristSpotResponse> body = useCase.byArea(areaCode, signguCode, limit)
                .stream().map(RelatedTouristSpotResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    /**
     * 키워드 검색 결과를 (기준 관광지) → (연관 관광지 리스트) 로 그룹화.
     *
     * <p>UI 가 "한라산 다녀간 사람들이 함께 간 곳: 서귀포 매일올레시장(1위), …" 같은
     * 묶음 카드를 그릴 수 있도록, 그룹 내부는 {@code rlteRank} 오름차순으로 정렬한다.
     */
    @GetMapping("/grouped/keyword")
    public NetplixApiResponse<List<RelatedTouristGroupResponse>> groupedByKeyword(
            @RequestParam String q,
            @RequestParam(defaultValue = "60") int limit) {
        return NetplixApiResponse.ok(groupByBaseSpot(useCase.byKeyword(q, limit)));
    }

    /**
     * 광역·시군구 코드 기반 연관 관광지를 키워드 그룹과 동일한 묶음 구조로 반환.
     * 대시보드 인기 지역(areaCode)에서 바로 동선(연관 명소) 카드까지 이어갈 때 사용.
     */
    @GetMapping("/grouped/area")
    public NetplixApiResponse<List<RelatedTouristGroupResponse>> groupedByArea(
            @RequestParam String areaCode,
            @RequestParam(required = false) String signguCode,
            @RequestParam(defaultValue = "60") int limit) {
        return NetplixApiResponse.ok(groupByBaseSpot(useCase.byArea(areaCode, signguCode, limit)));
    }

    private List<RelatedTouristGroupResponse> groupByBaseSpot(List<RelatedTouristSpot> raw) {
        Map<String, RelatedTouristGroupResponse> bucket = new LinkedHashMap<>();
        for (RelatedTouristSpot s : raw) {
            String key = nullSafe(s.getTAtsNm());
            RelatedTouristGroupResponse g = bucket.computeIfAbsent(key, k -> new RelatedTouristGroupResponse(
                    s.getTAtsNm(), s.getAreaName(), s.getSignguName(), new java.util.ArrayList<>()));
            g.related().add(RelatedTouristSpotResponse.from(s));
        }
        bucket.values().forEach(g -> g.related().sort((a, b) -> {
            Integer ra = a.rank();
            Integer rb = b.rank();
            if (ra == null && rb == null) return 0;
            if (ra == null) return 1;
            if (rb == null) return -1;
            return Integer.compare(ra, rb);
        }));
        return List.copyOf(bucket.values());
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    private static String nullSafe(String v) {
        return v == null ? "" : v;
    }

    public record StatusResponse(boolean configured) {}
}
