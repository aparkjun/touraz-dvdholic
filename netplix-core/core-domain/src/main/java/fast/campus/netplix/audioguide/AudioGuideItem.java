package fast.campus.netplix.audioguide;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) 조회 결과 항목.
 * 출처: /themeBasedList · /storyBasedList · /themeLocationBasedList · /storyLocationBasedList ·
 *       /themeSearchList · /storySearchList (모두 공통 item 구조로 가정, JsonAlias 로 유연 수용)
 *
 * <p>컨셉: "Cine Audio Trail · 귀로 듣는 영화의 배경".
 *  - 영화/드라마로 본 배경지를 실제로 방문할 때 현지 이야기를 이어폰으로 들려주는 오디오 가이드.
 *  - 정주행 번아웃(눈 피로) 후 귀로 소비하는 이동형 스토리텔링.
 *
 * <p>type 구분:
 *  - THEME: 관광지 기본정보 (예: 경복궁, 해인사 - 위치/테마 중심)
 *  - STORY: 관광지 내 '이야기' 조각 (예: "경복궁 근정전의 용상 이야기" - 세부 내러티브, 오디오 파일 중심)
 *
 * <p>주요 필드 (원문 → 도메인, 원문명은 API 매뉴얼 공개 전까지 JsonAlias 로 여러 후보 수용):
 *  - tid / stid / contentId → id
 *  - title → title
 *  - audioTitle → audioTitle
 *  - audioUrl (mp3 직링크 가능) → audioUrl
 *  - playTime (mm:ss 또는 초) → playTimeText
 *  - script / scriptDesc / overview → description
 *  - imageUrl / thumbnail → imageUrl
 *  - baseAddr → address
 *  - mapX / mapY → longitude / latitude
 *  - themeCategory / themeGb / categoryName → themeCategory
 *  - langCode / langDivCd → language
 *  - distanceKm (Haversine, nearby 조회 시 계산)
 */
@Getter
@Builder
public class AudioGuideItem {

    public enum Type { THEME, STORY }

    private final String id;
    /** 연관 관광지 ID (STORY 항목일 때 상위 THEME 과 연결). null 허용. */
    private final String themeId;
    private final Type type;
    private final String title;
    private final String audioTitle;
    /** 재생 가능한 오디오 파일 URL (mp3 등). null 시 플레이어 숨김. */
    private final String audioUrl;
    /** "mm:ss" 또는 초 문자열. UI 배지 표기 용. */
    private final String playTimeText;
    private final String description;
    private final String imageUrl;
    private final String address;
    private final Double latitude;
    private final Double longitude;
    /** 카테고리/테마 (예: 역사, 자연, 문화, K-드라마 촬영지). */
    private final String themeCategory;
    /** 콘텐츠 언어 (ko, en 등). 다국어 전환 UI 필터용. */
    private final String language;
    /** nearby 호출 시 호출자 좌표 기준 km 단위 거리(Haversine). */
    private final Double distanceKm;
}
