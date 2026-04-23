package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 영문 관광정보 서비스(EngService2) 조회 Port.
 *
 * <p>어댑터 구현은 (areaCode, contentTypeId) 조합 키로 TTL 캐시를 유지하며,
 * serviceKey 또는 URL 미설정 시 모든 메서드가 빈 결과를 반환해 기동 자체는 유지된다.
 *
 * <p>설계 원칙:
 * <ul>
 *   <li>응답 구조와 파라미터 이름은 KorService2(국문) 과 동일해 프론트에서 locale 토글만으로 스왑 가능.</li>
 *   <li>하지만 특화 서비스(KorWithService2/무장애, KorPetTourService2/반려동물, PhokoAwrdService/수상작)
 *       에 대응하는 영문 API 는 공공데이터포털에 존재하지 않으므로, 영어 모드에서는 해당 섹션을 숨기는 것을 권장.</li>
 * </ul>
 */
public interface EngTourPort {

    /**
     * 지역 + 콘텐츠타입 기반 영문 POI 목록.
     *
     * @param areaCode      KorService2 areaCode (1~8, 31~39). null/blank 허용.
     * @param contentTypeId 12/14/15/25/28/32/38/39. null/blank 허용.
     * @param limit         최대 반환 개수 (권장 5~30).
     */
    List<EngTourPoi> fetchByArea(String areaCode, String contentTypeId, int limit);

    /**
     * 좌표 반경 기반 조회 (촬영지 주변 영문 POI 탐색용).
     *
     * @param mapX   longitude (GPS)
     * @param mapY   latitude (GPS)
     * @param radius meters (권장 1000~5000)
     */
    List<EngTourPoi> fetchByLocation(double mapX, double mapY, int radius,
                                     String contentTypeId, int limit);

    /**
     * 키워드 검색(영문, 예: "Seoul", "Busan Beach").
     */
    List<EngTourPoi> fetchByKeyword(String keyword, String contentTypeId, int limit);

    /**
     * contentId 로 영문 공통 상세 조회(detailCommon2).
     * overview / homepage 등 긴 영문 메타가 여기서 채워진다.
     */
    Optional<EngTourPoi> fetchDetail(String contentId, String contentTypeId);

    /**
     * 어댑터 호출 가능 상태(serviceKey + URL 설정) 여부.
     */
    boolean isConfigured();
}
