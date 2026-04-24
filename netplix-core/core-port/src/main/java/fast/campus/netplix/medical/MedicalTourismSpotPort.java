package fast.campus.netplix.medical;

import java.util.List;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) 조회 Port.
 *
 * <p>3가지 핵심 조회 경로 + 다국어:
 * <ul>
 *   <li>전체 목록: /areaBasedList — 전국 의료관광 클러스터 마스터</li>
 *   <li>위치기반: /locationBasedList — 현재 좌표 반경 m 단위 (햄버거 "내 주변 의료관광")</li>
 *   <li>키워드 검색: /searchKeyword — 이름/클러스터/진료분야 부분 일치</li>
 * </ul>
 *
 * <p>langDivCd 로 ko/en 을 전환한다. 외국인 타깃 서비스 특성상 en 호출 빈도가 높을 수 있어
 * 언어별 독립 캐시를 사용한다.
 *
 * <p>일일 쿼터 1,000회 고려 — 어댑터에서 in-memory 캐시 + 첫페이지 동기/잔여 백그라운드 적재.
 * 환경변수(MEDICAL_TOURISM_API_KEY) 미설정 또는 Forbidden(활용 미승인) 시 빈 리스트 반환 → UI 자연 숨김.
 */
public interface MedicalTourismSpotPort {

    /** 전국 의료관광 스팟. limit<=0 이면 캐시 전체 반환. */
    List<MedicalTourismSpot> fetchAll(String lang, int limit);

    /**
     * 좌표 기반 주변 조회.
     *
     * @param lang      언어 (ko/en)
     * @param latitude  위도 (mapY)
     * @param longitude 경도 (mapX)
     * @param radiusM   반경(미터) — KTO API 는 최대 20,000m
     * @param limit     최대 반환 수 (0 이하 → 전체)
     */
    List<MedicalTourismSpot> fetchNearby(String lang, double latitude, double longitude, int radiusM, int limit);

    /** 키워드 검색 (관광지명/클러스터/진료분야 부분일치). */
    List<MedicalTourismSpot> fetchByKeyword(String lang, String keyword, int limit);

    /** 어댑터 호출 가능 여부 (serviceKey 설정 여부). */
    boolean isConfigured();
}
