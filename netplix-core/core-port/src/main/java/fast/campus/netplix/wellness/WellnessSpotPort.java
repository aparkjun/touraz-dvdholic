package fast.campus.netplix.wellness;

import java.util.List;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) 조회 Port.
 *
 * <p>3가지 핵심 조회 경로:
 * <ul>
 *   <li>전체 목록: /areaBasedList — 전국 웰니스관광지 마스터</li>
 *   <li>위치기반: /locationBasedList — 현재 좌표 반경 m 단위 (햄버거 "내 주변 힐링 스팟")</li>
 *   <li>키워드 검색: /searchKeyword — 이름/지역명/테마(온천·스파 등) 부분 일치</li>
 * </ul>
 *
 * <p>일일 쿼터 1,000회 고려 — 어댑터에서 in-memory 캐시 + 첫페이지 동기/잔여 백그라운드 적재.
 * 환경변수(WELLNESS_API_KEY) 미설정 시 {@link #isConfigured()} false 로 빈 리스트 반환 → UI 자연 숨김.
 */
public interface WellnessSpotPort {

    /** 전국 웰니스관광지. limit<=0 이면 캐시 전체 반환. */
    List<WellnessSpot> fetchAll(int limit);

    /**
     * 좌표 기반 주변 조회.
     *
     * @param latitude  위도 (mapY)
     * @param longitude 경도 (mapX)
     * @param radiusM   반경(미터) — KTO API 는 최대 20,000m
     * @param limit     최대 반환 수 (0 이하 → 전체)
     */
    List<WellnessSpot> fetchNearby(double latitude, double longitude, int radiusM, int limit);

    /** 키워드 검색 (관광지명/지역명/테마 부분일치). */
    List<WellnessSpot> fetchByKeyword(String keyword, int limit);

    /**
     * KorService2 광역 {@code areaCode}(1~8·31~39) + 선택 법정동 시군구코드 로 /areaBasedList 조회.
     * 집중률 캘린더 등에서 넘어온 행정코드와 동일 스키마를 받는다.
     */
    List<WellnessSpot> fetchByKorAdministrativeArea(String korAreaCode, String signguCodeOrNull, int limit);

    /** 어댑터 호출 가능 여부 (serviceKey 설정 여부). */
    boolean isConfigured();
}
