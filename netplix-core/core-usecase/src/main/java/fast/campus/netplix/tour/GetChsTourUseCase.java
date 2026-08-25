package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 중문(간체) 관광정보(ChsService2) 조회 유스케이스.
 *
 * <p>{@link GetEngTourUseCase}/{@link GetJpnTourUseCase} 의 중국어 대응. REST 컨트롤러에서
 * 사용하며, 어댑터 포트를 직접 노출하지 않고 얇은 래퍼로 두어 추후 중문 전용 필터를 캡슐화할 수 있게 한다.
 */
public interface GetChsTourUseCase {

    List<ChsTourPoi> byArea(String areaCode, String contentTypeId, int limit);

    List<ChsTourPoi> byLocation(double mapX, double mapY, int radius,
                                String contentTypeId, int limit);

    List<ChsTourPoi> byKeyword(String keyword, String contentTypeId, int limit);

    Optional<ChsTourPoi> detail(String contentId, String contentTypeId);

    boolean isConfigured();
}
