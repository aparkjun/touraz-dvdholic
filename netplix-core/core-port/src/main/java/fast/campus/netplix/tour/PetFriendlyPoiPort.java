package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 반려동물 동반여행(KorPetTourService) 조회 Port.
 *
 * <p>어댑터는 (areaCode, contentTypeId) 조합 키로 TTL 캐시를 유지.
 * 단일 서비스키를 다른 KTO 서비스와 공유하므로 QPS 여유를 위해 내부 캐시가 필수.
 */
public interface PetFriendlyPoiPort {

    /**
     * 지역 + 콘텐츠타입 기반 목록.
     *
     * @param areaCode      KorService2 areaCode (1~8, 31~39). null/blank 허용 시 전국.
     * @param contentTypeId 12/14/28/32/38/39 중 하나. null/blank 면 전체 타입.
     * @param limit         최대 반환 개수.
     */
    List<PetFriendlyPoi> fetchByArea(String areaCode, String contentTypeId, int limit);

    /**
     * 콘텐츠ID 로 반려동물 상세 조회.
     * detailCommon2(공통 정보) + detailPetTour2(반려동물 정책) 을 병합한다.
     */
    Optional<PetFriendlyPoi> fetchDetail(String contentId, String contentTypeId);

    /** 좌표 반경 기반 (CineTrip 촬영지 주변 반려동물 친화 스팟 탐색). */
    List<PetFriendlyPoi> fetchByLocation(double mapX, double mapY, int radius,
                                         String contentTypeId, int limit);

    /** 키워드 검색. */
    List<PetFriendlyPoi> fetchByKeyword(String keyword, String contentTypeId, int limit);

    /** 어댑터 호출 가능 상태(serviceKey + URL 설정) 여부. */
    boolean isConfigured();
}
