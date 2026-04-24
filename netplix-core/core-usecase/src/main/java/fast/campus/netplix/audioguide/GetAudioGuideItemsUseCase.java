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
}
