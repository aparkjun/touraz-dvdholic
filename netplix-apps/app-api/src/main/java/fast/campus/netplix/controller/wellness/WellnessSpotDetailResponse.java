package fast.campus.netplix.controller.wellness;

import fast.campus.netplix.wellness.WellnessSpotDetail;

import java.util.List;

/**
 * 웰니스 스팟 상세(개요·이용정보·추가 사진) 프론트 소비용 DTO.
 */
public record WellnessSpotDetailResponse(
        String contentId,
        String overview,
        String homepage,
        String tel,
        List<String> images,
        List<Fact> facts
) {
    public record Fact(String label, String value) {}

    public static WellnessSpotDetailResponse from(WellnessSpotDetail d) {
        List<Fact> facts = d.facts() == null ? List.of()
                : d.facts().stream().map(f -> new Fact(f.label(), f.value())).toList();
        return new WellnessSpotDetailResponse(
                d.contentId(),
                d.overview(),
                d.homepage(),
                d.tel(),
                d.images() == null ? List.of() : d.images(),
                facts
        );
    }
}
