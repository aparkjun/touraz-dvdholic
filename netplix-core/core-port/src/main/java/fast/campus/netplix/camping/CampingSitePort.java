package fast.campus.netplix.camping;

import java.util.List;

/**
 * 한국관광공사 고캠핑(GoCamping) 조회 Port.
 *
 * <p>3가지 핵심 조회 경로:
 * <ul>
 *   <li>전체 목록: /basedList — 전국 야영장 마스터 (전체 카드 그리드/지도)</li>
 *   <li>위치기반: /locationBasedList — 현재 좌표 반경 m 단위 (햄버거 "내 주변 야영장")</li>
 *   <li>키워드 검색: /searchList — 이름/지역명 부분 일치</li>
 * </ul>
 *
 * <p>일일 쿼터 1,000회 고려 — 어댑터에서 in-memory 캐시 + 첫페이지 동기/잔여 백그라운드 적재.
 * 환경변수(GOCAMPING_API_KEY) 미설정 시 {@link #isConfigured()} false 로 빈 리스트 반환 → UI 자연 숨김.
 */
public interface CampingSitePort {

    /** 전체 야영장(최신순). limit<=0 이면 캐시 전체 반환. */
    List<CampingSite> fetchAll(int limit);

    /**
     * 좌표 기반 주변 조회.
     *
     * @param latitude  위도 (mapY)
     * @param longitude 경도 (mapX)
     * @param radiusM   반경(미터) — KTO API 는 최대 20,000m 이지만 본 포트는 캡을 두지 않고 어댑터가 방어.
     * @param limit     최대 반환 수 (0 이하 → 전체)
     */
    List<CampingSite> fetchNearby(double latitude, double longitude, int radiusM, int limit);

    /** 키워드 검색 (야영장명/지역명). */
    List<CampingSite> fetchByKeyword(String keyword, int limit);

    /** 어댑터 호출 가능 여부 (serviceKey 설정 여부). */
    boolean isConfigured();
}
