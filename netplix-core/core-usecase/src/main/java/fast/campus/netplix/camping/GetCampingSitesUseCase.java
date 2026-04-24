package fast.campus.netplix.camping;

import java.util.List;

/**
 * 고캠핑 조회 유스케이스.
 * 컨트롤러 → 서비스 → 포트 계층 분리를 유지하기 위한 얇은 래퍼.
 */
public interface GetCampingSitesUseCase {

    List<CampingSite> all(int limit);

    List<CampingSite> nearby(double latitude, double longitude, int radiusM, int limit);

    List<CampingSite> byKeyword(String keyword, int limit);
}
