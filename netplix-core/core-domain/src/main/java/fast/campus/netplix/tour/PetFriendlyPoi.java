package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

/**
 * 한국관광공사 반려동물 동반여행 서비스(KorPetTourService) POI.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/KorPetTourService/areaBasedList2}
 *
 * <p>무장애 여행({@link AccessiblePoi})과 동일하게 contentTypeId(12/14/28/32/38/39) 를 공유.
 *
 * <p>반려동물 정책 세부 필드는 {@code detailPetTour2} 호출로 보강되며, 해당 호출을 하지 않은
 * 행에서는 {@link #petAcceptance} 가 null/empty 이다. UI 는 null 을 "정보 없음" 으로 표시.
 *
 * <p>acmpyTypeCd(동반 구분):
 * <ul>
 *   <li>1 전체 동반가능</li>
 *   <li>2 일부 제한적 동반가능</li>
 *   <li>3 동반 불가</li>
 * </ul>
 */
@Getter
@Builder(toBuilder = true)
public class PetFriendlyPoi {

    private final String contentId;
    private final String contentTypeId;
    private final String title;
    private final String addr1;
    private final String addr2;
    private final String areaCode;
    private final String sigunguCode;
    private final String firstImage;
    private final String firstImageThumb;
    private final String tel;
    private final Double mapX;
    private final Double mapY;
    private final String overview;
    private final String homepage;

    /**
     * detailPetTour2 에서 내려온 반려동물 정책 세부(라벨 → 값).
     *
     * <p>KTO 반려동물 API 는 필드가 계속 확장되므로 고정 필드 매핑 대신 맵 형태로
     * 보존해 UI 가 자유롭게 렌더링하도록 한다.
     */
    private final Map<String, String> petAcceptance;

    /** 동반 구분 코드 원문 (1/2/3). null 이면 미집계. */
    private final String acmpyTypeCd;

    /** true 면 전체 동반 가능 (acmpyTypeCd == "1"). */
    public boolean isFullyAllowed() {
        return "1".equals(acmpyTypeCd);
    }

    /** true 면 부분 동반 가능 (acmpyTypeCd == "2"). */
    public boolean isLimitedAllowed() {
        return "2".equals(acmpyTypeCd);
    }

    /** true 면 동반 불가 (acmpyTypeCd == "3"). */
    public boolean isNotAllowed() {
        return "3".equals(acmpyTypeCd);
    }

    /** 한글 라벨 요약 — 프론트 칩/뱃지용. */
    public String acceptanceLabel() {
        if (isFullyAllowed()) return "반려동물 동반 가능";
        if (isLimitedAllowed()) return "일부 구역 동반 가능";
        if (isNotAllowed()) return "반려동물 동반 불가";
        return "정책 정보 없음";
    }
}
