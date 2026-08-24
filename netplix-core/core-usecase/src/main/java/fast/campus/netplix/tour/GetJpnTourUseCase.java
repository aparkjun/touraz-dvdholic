package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 일문 관광정보(JpnService2) 조회 유스케이스.
 *
 * <p>{@link GetEngTourUseCase} 의 일본어 대응. REST 컨트롤러에서 사용하며, 어댑터 포트를 직접
 * 노출하지 않고 얇은 래퍼로 두어 추후 일문 전용 필터를 캡슐화할 수 있게 한다.
 */
public interface GetJpnTourUseCase {

    List<JpnTourPoi> byArea(String areaCode, String contentTypeId, int limit);

    List<JpnTourPoi> byLocation(double mapX, double mapY, int radius,
                                String contentTypeId, int limit);

    List<JpnTourPoi> byKeyword(String keyword, String contentTypeId, int limit);

    Optional<JpnTourPoi> detail(String contentId, String contentTypeId);

    boolean isConfigured();
}
