package fast.campus.netplix.audioguide;

import java.util.List;

/**
 * 오디오 가이드 조회 유스케이스. 컨트롤러 → 서비스 → 포트 계층 분리를 유지하기 위한 얇은 래퍼.
 */
public interface GetAudioGuideItemsUseCase {

    List<AudioGuideItem> all(AudioGuideItem.Type type, String lang, int limit);

    List<AudioGuideItem> nearby(AudioGuideItem.Type type, String lang,
                                double latitude, double longitude, int radiusM, int limit);

    List<AudioGuideItem> byKeyword(AudioGuideItem.Type type, String lang, String keyword, int limit);

    /**
     * 특정 관광지(THEME)에 속한 해설 이야기(STORY) 조회.
     * 모달에서 THEME 카드 클릭 시 연관 이야기들을 불러와 각각 TTS 재생하기 위해 사용.
     */
    List<AudioGuideItem> storiesByTheme(String themeId, String themeTitleHint, String lang, int limit);

    /** Odii 키 설정 여부·표본 조회 — 목록이 비어 있을 때 원인 표시용 */
    AudioGuideOdiiMeta odiiMeta();
}
