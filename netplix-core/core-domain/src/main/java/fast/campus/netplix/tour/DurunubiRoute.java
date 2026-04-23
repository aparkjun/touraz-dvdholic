package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) "길(route)" 도메인.
 *
 * <p>코리아둘레길의 상위 묶음으로, 예) 해파랑길 · 남파랑길 · 서해랑길 · DMZ 평화의 길.
 * 각 길은 여러 개의 {@link DurunubiCourse} 를 포함한다.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/Durunubi/routeList}
 *
 * <p>대표 필드 (TourAPI Guide v4.1):
 * <ul>
 *   <li>{@code routeIdx} — 길 고유번호 (courseList 필터 키)</li>
 *   <li>{@code brdDiv}   — 길 구분 코드 (DNWW: 해파랑길 등)</li>
 *   <li>{@code brdNm}    — 길 구분명</li>
 *   <li>{@code themeNm}  — 테마명</li>
 *   <li>{@code lnm}      — 길 이름 (최상위 브랜드)</li>
 *   <li>{@code lnkgCourse} — 연계 코스 정보 원문</li>
 *   <li>{@code cpnBgng / cpnEnd} — 시점 / 종점 주소 요약</li>
 * </ul>
 */
@Getter
@Builder(toBuilder = true)
public class DurunubiRoute {

    private final String routeIdx;
    private final String brdDiv;
    private final String brdNm;
    private final String themeNm;
    private final String lnm;
    private final String lnkgCourse;
    private final String cpnBgng;
    private final String cpnEnd;

    /** 화면용 라벨. {@code lnm} 우선, 없으면 {@code brdNm}. */
    public String displayName() {
        if (lnm != null && !lnm.isBlank()) return lnm;
        if (brdNm != null && !brdNm.isBlank()) return brdNm;
        return themeNm;
    }
}
