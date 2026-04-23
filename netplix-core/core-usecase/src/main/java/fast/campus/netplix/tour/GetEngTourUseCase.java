package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 영문 관광정보(EngService2) 조회 유스케이스.
 *
 * <p>REST 컨트롤러에서 사용. 어댑터 포트를 직접 노출하지 않고 얇은 래퍼로 두어 추후
 * 영문 전용 필터(예: 인바운드 추천 스폿 가중치) 를 캡슐화할 수 있게 한다.
 */
public interface GetEngTourUseCase {

    List<EngTourPoi> byArea(String areaCode, String contentTypeId, int limit);

    List<EngTourPoi> byLocation(double mapX, double mapY, int radius,
                                String contentTypeId, int limit);

    List<EngTourPoi> byKeyword(String keyword, String contentTypeId, int limit);

    Optional<EngTourPoi> detail(String contentId, String contentTypeId);

    boolean isConfigured();
}
