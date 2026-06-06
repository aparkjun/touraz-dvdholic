package fast.campus.netplix.wellness;

import java.util.List;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) 상세 조회 결과.
 *
 * <p>목록 API(areaBasedList 등)에는 소개글·이용시간 같은 본문 필드가 없어,
 * 콘텐츠별 상세 API 3종을 합쳐서 만든다:
 * <ul>
 *   <li>detailCommon → 개요(overview), 홈페이지, 대표 전화</li>
 *   <li>detailIntro  → 이용시간·휴무일·주차·문의 등 (contentTypeId 별 필드, label/value 로 정규화)</li>
 *   <li>detailImage  → 추가 사진 갤러리(원본 URL 목록)</li>
 * </ul>
 *
 * <p>키 미승인/쿼터 초과/데이터 미등록 시 각 필드는 null·빈 리스트로 비어 있을 수 있다.
 */
public record WellnessSpotDetail(
        String contentId,
        String overview,
        String homepage,
        String tel,
        List<String> images,
        List<Fact> facts
) {
    /** detailIntro 의 한 항목(예: "이용시간" → "09:00~18:00"). */
    public record Fact(String label, String value) {}

    public static WellnessSpotDetail empty(String contentId) {
        return new WellnessSpotDetail(contentId, null, null, null, List.of(), List.of());
    }
}
