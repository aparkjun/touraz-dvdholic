package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 중문(간체) 관광정보 서비스(ChsService2) 조회 Port.
 *
 * <p>{@link EngTourPort}/{@link JpnTourPort} 와 동일한 계약을 간체 중국어 콘텐츠에 대해 제공한다.
 * 어댑터 구현은 (areaCode, contentTypeId) 조합 키로 TTL 캐시를 유지하며, serviceKey 또는 URL
 * 미설정 시 모든 메서드가 빈 결과를 반환해 기동 자체는 유지된다.
 *
 * <p>국문 특화 서비스(무장애/반려동물/수상작 등)에 대응하는 중문 API 는 존재하지 않으므로,
 * 중국어 모드에서는 해당 국문 전용 섹션을 숨기는 것을 권장한다.
 */
public interface ChsTourPort {

    List<ChsTourPoi> fetchByArea(String areaCode, String contentTypeId, int limit);

    List<ChsTourPoi> fetchByLocation(double mapX, double mapY, int radius,
                                     String contentTypeId, int limit);

    List<ChsTourPoi> fetchByKeyword(String keyword, String contentTypeId, int limit);

    Optional<ChsTourPoi> fetchDetail(String contentId, String contentTypeId);

    boolean isConfigured();
}
