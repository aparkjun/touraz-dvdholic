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
        Double distanceKm,
        boolean scriptAvailable
) {
    public static AudioGuideItemResponse from(AudioGuideItem s) {
        return from(s, false);
    }

    /**
     * lite=true 일 때 큰 필드(해설 대본)를 응답에서 생략한다.
     *
     * <p>STORY 리스트는 한 항목당 수 KB 의 script 를 포함해 전체 6,000+건을 직렬화하면
     * 응답이 수 MB 로 커지고 프런트 렌더링이 불안정해진다. 리스트 조회는 기본 lite,
     * 모달에서 상세가 필요한 순간에 별도 엔드포인트로 description 을 조회한다.
     */
    public static AudioGuideItemResponse from(AudioGuideItem s, boolean lite) {
        return new AudioGuideItemResponse(
                s.getId(),
                s.getThemeId(),
                s.getType() != null ? s.getType().name() : null,
                s.getTitle(),
                s.getAudioTitle(),
                s.getAudioUrl(),
                s.getPlayTimeText(),
                lite ? null : s.getDescription(),
                s.getImageUrl(),
                s.getAddress(),
                s.getLatitude(),
                s.getLongitude(),
                s.getThemeCategory(),
                s.getLanguage(),
                s.getDistanceKm(),
                s.isScriptAvailable()
        );
    }
}
