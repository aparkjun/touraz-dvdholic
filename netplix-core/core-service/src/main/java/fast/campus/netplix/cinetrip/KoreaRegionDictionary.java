package fast.campus.netplix.cinetrip;

import lombok.Getter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * KTO areaCode(1~39) ↔ 지역명/영문명/주요 랜드마크 사전.
 *
 * <p>TMDB 메타(title/overview/tagline)에서 한국 지역을 자동 추출하기 위한 시드.
 * 한글 별칭은 단순 contains 매칭(한글은 단어 경계가 의미 없음), 영문 별칭은 대/소문자 구분 없이
 * \b 경계 매칭하여 "Seoul" 은 "Seoul Searching" 에서 매칭, "seoulless" 같은 건 비매칭.
 *
 * <p>모호한 동음이의(예: "광주" = 광주광역시 vs 경기 광주시) 는 광역 전체 이름만 포함하고
 * 짧은 별명은 스코어를 낮춘다.
 */
public final class KoreaRegionDictionary {

    @Getter
    public static final class RegionDef {
        private final String areaCode;
        private final String regionName;
        private final List<String> hangulAliases;   // contains 매칭
        private final List<Pattern> englishPatterns; // \b 경계 매칭
        private final List<String> strongAliases;   // 랜드마크 (매칭 시 +가중치)

        private RegionDef(String areaCode, String regionName,
                          List<String> hangulAliases, List<String> englishAliases,
                          List<String> strongAliases) {
            this.areaCode = areaCode;
            this.regionName = regionName;
            this.hangulAliases = List.copyOf(hangulAliases);
            this.strongAliases = List.copyOf(strongAliases);
            List<Pattern> patterns = new ArrayList<>(englishAliases.size());
            for (String a : englishAliases) {
                patterns.add(Pattern.compile("\\b" + Pattern.quote(a) + "\\b", Pattern.CASE_INSENSITIVE));
            }
            this.englishPatterns = List.copyOf(patterns);
        }
    }

    private static final Map<String, RegionDef> REGIONS;

    static {
        Map<String, RegionDef> m = new LinkedHashMap<>();

        m.put("1", def("1", "서울",
                List.of("서울특별시", "서울시", "서울"),
                List.of("Seoul"),
                List.of("한강", "강남", "홍대", "명동", "이태원", "광화문", "남산", "북한산",
                        "종로", "용산", "동대문", "신촌", "여의도", "경복궁", "덕수궁", "청와대",
                        "Gangnam", "Hongdae", "Myeongdong", "Itaewon", "Gwanghwamun", "Namsan",
                        "Bukhansan", "Jongno", "Yongsan", "Han River", "Gyeongbokgung")));

        m.put("2", def("2", "인천",
                List.of("인천광역시", "인천시", "인천"),
                List.of("Incheon"),
                List.of("월미도", "송도", "강화도", "차이나타운", "영종도",
                        "Wolmido", "Songdo", "Ganghwa")));

        m.put("3", def("3", "대전",
                List.of("대전광역시", "대전시", "대전"),
                List.of("Daejeon"),
                List.of("유성", "엑스포", "Yuseong")));

        m.put("4", def("4", "대구",
                List.of("대구광역시", "대구시", "대구"),
                List.of("Daegu"),
                List.of("팔공산", "동성로", "Palgongsan")));

        m.put("5", def("5", "광주",
                List.of("광주광역시"),
                List.of("Gwangju"),
                List.of("무등산", "5·18", "518 민주화운동", "Mudeungsan")));

        m.put("6", def("6", "부산",
                List.of("부산광역시", "부산시", "부산"),
                List.of("Busan"),
                List.of("해운대", "광안리", "자갈치", "감천문화마을", "태종대", "송도해수욕장",
                        "남포동", "영도", "기장", "국제시장",
                        "Haeundae", "Gwangalli", "Jagalchi", "Gamcheon", "Taejongdae",
                        "Nampo", "Yeongdo", "Gijang")));

        m.put("7", def("7", "울산",
                List.of("울산광역시", "울산시", "울산"),
                List.of("Ulsan"),
                List.of("간절곶", "태화강", "Ganjeolgot", "Taehwa")));

        m.put("8", def("8", "세종",
                List.of("세종특별자치시", "세종시"),
                List.of("Sejong"),
                List.of()));

        m.put("31", def("31", "경기",
                List.of("경기도", "경기"),
                List.of("Gyeonggi"),
                List.of("수원", "화성", "용인", "파주", "가평", "양평", "포천", "안양", "일산", "분당",
                        "에버랜드", "한국민속촌", "DMZ", "비무장지대", "판문점", "임진각",
                        "Suwon", "Hwaseong", "Yongin", "Paju", "Gapyeong", "Yangpyeong",
                        "Everland", "Panmunjom", "Imjingak")));

        m.put("32", def("32", "강원",
                List.of("강원도", "강원특별자치도", "강원"),
                List.of("Gangwon"),
                List.of("강릉", "속초", "원주", "춘천", "평창", "정선", "양양", "태백", "동해시",
                        "설악산", "오대산", "남이섬", "경포대", "주문진", "DMZ",
                        "Gangneung", "Sokcho", "Wonju", "Chuncheon", "Pyeongchang", "Jeongseon",
                        "Yangyang", "Taebaek", "Seoraksan", "Nami Island")));

        m.put("33", def("33", "충북",
                List.of("충청북도", "충북"),
                List.of("Chungbuk", "North Chungcheong"),
                List.of("청주", "단양", "제천", "충주", "속리산",
                        "Cheongju", "Danyang", "Jecheon", "Songnisan")));

        m.put("34", def("34", "충남",
                List.of("충청남도", "충남"),
                List.of("Chungnam", "South Chungcheong"),
                List.of("천안", "아산", "공주", "부여", "서산", "태안", "보령",
                        "독립기념관", "백제",
                        "Cheonan", "Asan", "Gongju", "Buyeo", "Seosan", "Taean", "Boryeong", "Baekje")));

        m.put("35", def("35", "전북",
                List.of("전라북도", "전북특별자치도", "전북"),
                List.of("Jeonbuk", "North Jeolla"),
                List.of("전주", "군산", "정읍", "남원", "무주", "부안", "한옥마을",
                        "Jeonju", "Gunsan", "Jeongeup", "Namwon", "Muju", "Buan")));

        m.put("36", def("36", "전남",
                List.of("전라남도", "전남"),
                List.of("Jeonnam", "South Jeolla"),
                List.of("여수", "순천", "목포", "광양", "나주", "담양", "완도", "진도", "해남",
                        "보성녹차", "순천만",
                        "Yeosu", "Suncheon", "Mokpo", "Gwangyang", "Damyang", "Wando", "Jindo", "Haenam",
                        "Suncheonman")));

        m.put("37", def("37", "경북",
                List.of("경상북도", "경북"),
                List.of("Gyeongbuk", "North Gyeongsang"),
                List.of("경주", "포항", "안동", "영주", "문경", "울릉도", "독도",
                        "불국사", "석굴암", "하회마을", "도산서원",
                        "Gyeongju", "Pohang", "Andong", "Yeongju", "Mungyeong", "Ulleungdo", "Dokdo",
                        "Bulguksa", "Seokguram", "Hahoe")));

        m.put("38", def("38", "경남",
                List.of("경상남도", "경남"),
                List.of("Gyeongnam", "South Gyeongsang"),
                List.of("창원", "진주", "통영", "거제", "남해", "사천", "김해", "밀양", "양산",
                        "합천해인사", "지리산",
                        "Changwon", "Jinju", "Tongyeong", "Geoje", "Namhae", "Sacheon", "Gimhae",
                        "Miryang", "Yangsan", "Jirisan")));

        m.put("39", def("39", "제주",
                List.of("제주특별자치도", "제주도", "제주"),
                List.of("Jeju"),
                List.of("서귀포", "성산일출봉", "한라산", "우도", "협재", "중문", "올레길", "용두암",
                        "Seogwipo", "Seongsan", "Hallasan", "Udo", "Hyeopjae", "Jungmun", "Olle",
                        "Yongduam")));

        REGIONS = Collections.unmodifiableMap(m);
    }

    private static RegionDef def(String code, String name,
                                 List<String> hangul, List<String> english, List<String> strong) {
        return new RegionDef(code, name, hangul, english, strong);
    }

    public static Map<String, RegionDef> regions() {
        return REGIONS;
    }

    private KoreaRegionDictionary() {}
}
