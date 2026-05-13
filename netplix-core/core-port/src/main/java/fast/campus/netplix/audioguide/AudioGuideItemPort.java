package fast.campus.netplix.audioguide;

import java.util.List;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) 조회 Port.
 *
 * <p>두 종류 × 세 가지 조회 경로 = 6개 오퍼레이션을 type 파라미터로 통합한다:
 * <ul>
 *   <li>전체 목록: /themeBasedList · /storyBasedList</li>
 *   <li>위치기반: /themeLocationBasedList · /storyLocationBasedList (mapX/mapY/radius)</li>
 *   <li>키워드 검색: /themeSearchList · /storySearchList</li>
 * </ul>
 *
 * <p>일일 쿼터 1,000회/오퍼레이션 고려 — 어댑터는 type+lang 독립 in-memory 캐시 유지.
 * 프런트·유스케이스 언어는 ko|en|zh|ja 이며, Odii GW 의 실제 langCode 는 어댑터가 프로브·캐시한다.
 * 미승인 403 Forbidden / 키 미설정 시 빈 리스트 → UI 자연 숨김.
 */
public interface AudioGuideItemPort {

    /** type 별 전체 목록 조회. limit<=0 → 캐시 전체 반환. */
    List<AudioGuideItem> fetchAll(AudioGuideItem.Type type, String lang, int limit);

    /** type 별 좌표 기반 주변 조회. radiusM 은 미터 단위. */
    List<AudioGuideItem> fetchNearby(AudioGuideItem.Type type, String lang,
                                     double latitude, double longitude, int radiusM, int limit);

    /** type 별 키워드 검색 (제목/내용 부분 일치). */
    List<AudioGuideItem> fetchByKeyword(AudioGuideItem.Type type, String lang, String keyword, int limit);

    /**
     * 특정 관광지(THEME)에 연결된 해설 이야기(STORY) 목록 조회.
     *
     * @param themeId 관광지 ID (AudioGuideItem.id / themeId)
     * @param themeTitleHint tid 매칭 실패 시 STORY 키워드 검색·제목 매칭 폴백용 (nullable)
     * @param lang ko | en | zh | ja (Odii 요청 시 zh/ja 는 어댑터에서 GW 코드로 변환)
     * @param limit 최대 반환 개수 (0 이하 = 무제한, 상한은 어댑터 내부 정책)
     * @param anchorLat 선택 — THEME 위도(WGS84). 있으면 tid 불일치 시에도 KO 근접 테마·스토리 브리지에 사용
     * @param anchorLon 선택 — THEME 경도(WGS84)
     */
    List<AudioGuideItem> fetchStoriesByTheme(String themeId, String themeTitleHint, String lang, int limit,
                                             Double anchorLat, Double anchorLon);

    /** 어댑터 호출 가능 여부(serviceKey 설정). */
    boolean isConfigured();
}
