package fast.campus.netplix.cinetrip.autotag;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 룰 기반 1차 필터 — 17개 광역 지자체(관광공사 표준 area_code) 대표 키워드 사전.
 * overview / title / cast / director 등 영화 DB 필드에서 해당 키워드가 발견되면
 * mapping_type=BACKGROUND (또는 THEME) 으로 즉시 후보 생성한다.
 *
 * 키워드는 한글·영문·로마자 표기를 모두 담아 재현율을 높인다.
 * confidence 는 룰 기반이므로 수작업 시드(5) 보다 한 단계 낮은 4 로 설정.
 */
public final class RegionKeywordDictionary {

    private RegionKeywordDictionary() {}

    public record Region(String areaCode, String regionName, List<String> keywords) {}

    private static final Map<String, Region> REGIONS = buildRegions();

    private static Map<String, Region> buildRegions() {
        Map<String, Region> m = new LinkedHashMap<>();
        // 광역시 1~8
        m.put("1",  new Region("1",  "서울", List.of("서울", "강남", "강북", "종로", "명동", "홍대", "한강", "명동",
                "이태원", "여의도", "잠실", "광화문", "북촌", "서촌", "성북", "자하문", "해방촌",
                "Seoul", "seoul", "gangnam", "myeongdong", "hongdae", "han river")));
        m.put("2",  new Region("2",  "인천", List.of("인천", "송도", "월미도", "강화", "차이나타운", "인천공항",
                "Incheon", "incheon", "songdo", "wolmido")));
        m.put("3",  new Region("3",  "대전", List.of("대전", "유성", "엑스포", "대덕", "Daejeon", "daejeon")));
        m.put("4",  new Region("4",  "대구", List.of("대구", "동성로", "팔공산", "Daegu", "daegu")));
        m.put("5",  new Region("5",  "광주", List.of("광주", "5·18", "518", "518 민주", "Gwangju", "gwangju")));
        m.put("6",  new Region("6",  "부산", List.of("부산", "해운대", "광안리", "남포동", "자갈치", "감천", "태종대",
                "영도", "Busan", "busan", "haeundae", "gwangalli")));
        m.put("7",  new Region("7",  "울산", List.of("울산", "간절곶", "태화강", "Ulsan", "ulsan")));
        m.put("8",  new Region("8",  "세종", List.of("세종시", "Sejong", "sejong")));
        // 도 31~39
        m.put("31", new Region("31", "경기", List.of("경기", "수원", "용인", "일산", "분당", "판교", "양평", "가평",
                "남한산성", "Gyeonggi", "gyeonggi", "suwon", "paju")));
        m.put("32", new Region("32", "강원", List.of("강원", "강릉", "속초", "춘천", "평창", "정동진", "태백", "양양",
                "동해", "설악산", "주문진", "Gangwon", "gangwon", "gangneung", "sokcho", "pyeongchang")));
        m.put("33", new Region("33", "충북", List.of("충북", "청주", "단양", "제천", "괴산", "Chungbuk", "chungbuk")));
        m.put("34", new Region("34", "충남", List.of("충남", "천안", "공주", "부여", "보령", "대천",
                "Chungnam", "chungnam")));
        m.put("35", new Region("35", "경북", List.of("경북", "경주", "포항", "안동", "문경", "불국사", "하회마을",
                "구룡포", "Gyeongbuk", "gyeongbuk", "gyeongju", "pohang", "andong")));
        m.put("36", new Region("36", "경남", List.of("경남", "창원", "진주", "통영", "거제", "남해", "사천", "합천",
                "Gyeongnam", "gyeongnam", "tongyeong", "geoje")));
        m.put("37", new Region("37", "전북", List.of("전북", "전주", "군산", "남원", "부안", "한옥마을", "변산",
                "Jeonbuk", "jeonbuk", "jeonju")));
        m.put("38", new Region("38", "전남", List.of("전남", "여수", "순천", "목포", "해남", "담양", "보성", "진도",
                "Jeonnam", "jeonnam", "yeosu", "suncheon", "mokpo")));
        m.put("39", new Region("39", "제주", List.of("제주", "제주도", "서귀포", "성산", "한라산", "우도", "섭지코지",
                "Jeju", "jeju", "jeju island", "jeju-island", "jejudo", "seogwipo")));
        return Collections.unmodifiableMap(m);
    }

    public static Map<String, Region> all() { return REGIONS; }
}
