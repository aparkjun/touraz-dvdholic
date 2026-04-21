package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 포토코리아 관광공모전(사진) 수상작 정보.
 * 출처: PhokoAwrdService / phokoAwrdList (공공데이터 15145706)
 *
 * <p>주요 용도:
 * <ul>
 *   <li>CineTrip 지역 상세 페이지 사진 갤러리</li>
 *   <li>영화-지역 매칭 보조(키워드 교차)</li>
 *   <li>Cultural Map 말풍선 내 썸네일 표시</li>
 * </ul>
 *
 * <p>저작권 주의: {@code copyrightType} 이 "Type1" 이면 출처 표기로 자유 이용 가능,
 * 그 외 유형은 노출 제한을 둘 수 있어 필드 그대로 보존.
 */
@Getter
@Builder
public class TourPhoto {

    private final String contentId;
    private final String title;
    private final String titleEn;
    private final String lDongRegnCd;
    private final String filmSite;
    private final String filmSiteEn;
    private final String filmDay;
    private final String photographer;
    private final String award;
    private final String keywords;
    private final String imageUrl;
    private final String thumbnailUrl;
    private final String copyrightType;
}
