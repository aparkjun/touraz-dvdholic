package fast.campus.netplix.camping;

import java.util.List;
import java.util.Optional;

/**
 * 고캠핑 조회 유스케이스.
 * 컨트롤러 → 서비스 → 포트 계층 분리를 유지하기 위한 얇은 래퍼.
 */
public interface GetCampingSitesUseCase {

    List<CampingSite> all(int limit);

    List<CampingSite> nearby(double latitude, double longitude, int radiusM, int limit);

    List<CampingSite> byKeyword(String keyword, int limit);

    /** 단일 야영장 상세(contentId). 미존재 시 Optional.empty(). */
    Optional<CampingSite> byId(String contentId);

    /** 야영장 이미지 갤러리(URL 리스트). 등록 이미지 없으면 빈 리스트. */
    List<String> images(String contentId);
}
