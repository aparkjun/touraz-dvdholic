package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) 공통 응답 포맷.
 *
 * <p>다음 2개 오퍼레이션이 동일한 {@code response.body.items.item} 래퍼를 공유:
 * <ul>
 *   <li>{@code /courseList} — 코스 목록 정보 (crsIdx, crsKorNm, crsDstnc, crsLevel, ...)</li>
 *   <li>{@code /routeList}  — 길 목록 정보 (routeIdx, brdDiv, lnm, themeNm, ...)</li>
 * </ul>
 *
 * <p>TourAPI 공통 관례대로 totalCount=0 일 때 {@code items} 가 빈 문자열("")로 내려올 수 있어
 * 어댑터에서 {@code null} 로 사전 치환한다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaDurunubiResponse {

    private Response response;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        private Header header;
        private Body body;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Header {
        private String resultCode;
        private String resultMsg;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private Items items;
        private Integer numOfRows;
        private Integer pageNo;
        private Integer totalCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Items {
        private List<Item> item;
    }

    /**
     * courseList / routeList 모든 필드를 느슨하게 수용.
     * 해당 오퍼레이션에 없는 필드는 Jackson 이 null 로 둔다.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        // 공통/상위
        private String routeIdx;
        private String brdDiv;
        private String brdNm;
        private String themeNm;
        private String lnm;              // 길 이름 (해파랑길 등)
        private String lnkgCourse;       // 연계 코스 원문 (routeList)
        private String cpnBgng;          // 시점
        private String cpnEnd;           // 종점

        // courseList 전용
        private String crsIdx;           // 코스 고유번호
        private String crsKorNm;         // 코스명
        private String crsDstnc;         // 거리 (km, 문자열)
        private String crsLevel;         // 난이도 1/2/3
        private String crsTotlRqrmHour;  // 총 소요시간 (분, 문자열)
        private String crsCycle;         // 순환/비순환
        private String crsContents;      // 코스 소개
        private String crsTourInfo;      // 주요 경유지/관광지
        private String crsTravelerinfo;  // 여행자 정보/주의사항
        private String sigun;            // 시군명
        private String gpxpath;          // GPX 다운로드 경로
    }
}
