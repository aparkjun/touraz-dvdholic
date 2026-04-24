package fast.campus.netplix.controller.audioguide;

import fast.campus.netplix.audioguide.AudioGuideItem;

/**
 * 프론트엔드 소비용 오디오 가이드 아이템 DTO.
 *
 * <p>audioUrl 이 존재하는 항목은 프런트 플레이어 UI 에서 즉시 재생 가능.
 * type 은 "THEME" | "STORY" 문자열로 전달한다.
 */
public record AudioGuideItemResponse(
        String id,
        String themeId,
        String type,
        String title,
        String audioTitle,
        String audioUrl,
        String playTimeText,
        String description,
        String imageUrl,
        String address,
        Double latitude,
        Double longitude,
        String themeCategory,
        String language,
        Double distanceKm
) {
    public static AudioGuideItemResponse from(AudioGuideItem s) {
        return new AudioGuideItemResponse(
                s.getId(),
                s.getThemeId(),
                s.getType() != null ? s.getType().name() : null,
                s.getTitle(),
                s.getAudioTitle(),
                s.getAudioUrl(),
                s.getPlayTimeText(),
                s.getDescription(),
                s.getImageUrl(),
                s.getAddress(),
                s.getLatitude(),
                s.getLongitude(),
                s.getThemeCategory(),
                s.getLanguage(),
                s.getDistanceKm()
        );
    }
}
