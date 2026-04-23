package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) "코스(course)" 도메인.
 *
 * <p>코리아둘레길 284개 코스 중 한 단위. 하나의 {@link DurunubiRoute} 에 속한다.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/Durunubi/courseList}
 *
 * <p>대표 필드 (TourAPI Guide v4.1 기준):
 * <ul>
 *   <li>{@code crsIdx}            — 코스 고유번호</li>
 *   <li>{@code routeIdx}          — 상위 길(route) 고유번호</li>
 *   <li>{@code crsKorNm}          — 코스명 (예: "남파랑길 55코스")</li>
 *   <li>{@code crsDstnc}          — 코스 길이 (km, 문자열로 내려옴)</li>
 *   <li>{@code crsLevel}          — 난이도 1(쉬움) / 2(보통) / 3(어려움)</li>
 *   <li>{@code crsTotlRqrmHour}   — 총 소요시간 (분, 문자열)</li>
 *   <li>{@code crsCycle}          — 순환/비순환 여부</li>
 *   <li>{@code crsContents}       — 코스 소개(HTML 또는 일반 텍스트)</li>
 *   <li>{@code crsTourInfo}       — 주요 경유지/관광지</li>
 *   <li>{@code crsTravelerinfo}   — 여행자 정보/주의사항</li>
 *   <li>{@code sigun}             — 시군명 원문</li>
 *   <li>{@code cpnBgng / cpnEnd}  — 시점 / 종점 주소</li>
 *   <li>{@code gpxpath}           — GPX 파일 다운로드 경로</li>
 *   <li>{@code brdDiv / brdNm}    — 상위 길 구분 코드/명</li>
 * </ul>
 */
@Getter
@Builder(toBuilder = true)
public class DurunubiCourse {

    private final String crsIdx;
    private final String routeIdx;
    private final String crsKorNm;

    /** km 단위 거리(문자열 원본). 파싱 실패 허용. */
    private final String crsDstnc;

    /** 난이도 원본 ("1"/"2"/"3"). */
    private final String crsLevel;

    /** 총 소요시간 (분 단위, 문자열). */
    private final String crsTotlRqrmHour;

    private final String crsCycle;
    private final String crsContents;
    private final String crsTourInfo;
    private final String crsTravelerinfo;

    private final String sigun;
    private final String cpnBgng;
    private final String cpnEnd;

    private final String gpxpath;
    private final String brdDiv;
    private final String brdNm;

    /** UI 뱃지용 한글 난이도 라벨. */
    public String levelLabel() {
        if ("1".equals(crsLevel)) return "쉬움";
        if ("2".equals(crsLevel)) return "보통";
        if ("3".equals(crsLevel)) return "어려움";
        return "난이도 정보 없음";
    }

    /** km 단위 숫자 파싱, 실패 시 null. */
    public Double distanceKm() {
        if (crsDstnc == null || crsDstnc.isBlank()) return null;
        try { return Double.parseDouble(crsDstnc.replaceAll("[^0-9.]", "")); }
        catch (NumberFormatException e) { return null; }
    }

    /** 시간 단위(분 → 시간/분) 한글 요약. ex) "5시간 30분". */
    public String estimatedTimeLabel() {
        if (crsTotlRqrmHour == null || crsTotlRqrmHour.isBlank()) return null;
        try {
            int min = (int) Math.round(Double.parseDouble(crsTotlRqrmHour));
            int h = min / 60;
            int m = min % 60;
            if (h > 0 && m > 0) return h + "시간 " + m + "분";
            if (h > 0) return h + "시간";
            return m + "분";
        } catch (NumberFormatException e) {
            return crsTotlRqrmHour;
        }
    }
}
