package fast.campus.netplix.tour;

import java.util.List;

/**
 * 관광공모전(사진) 수상작 조회 유스케이스.
 * REST 컨트롤러에서 사용. 포트를 직접 노출하지 않고 얇은 래퍼로 두어
 * 추후 필터/정렬 로직(예: contentType 기반 필터, 저작권 Type 필터 등)이 늘어나도
 * 외부 API 계약을 유지할 수 있도록 한다.
 */
public interface GetTourPhotosUseCase {

    List<TourPhoto> byAreaCode(String areaCode, int limit);

    List<TourPhoto> byLDongRegnCd(String lDongRegnCd, int limit);

    List<TourPhoto> byKeyword(String keyword, int limit);

    List<TourPhoto> all(int limit);
}
