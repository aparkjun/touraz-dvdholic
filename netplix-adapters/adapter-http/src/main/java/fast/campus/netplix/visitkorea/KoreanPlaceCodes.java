package fast.campus.netplix.visitkorea;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * KTO TarRlteTarService1 호출에 필요한 (areaCd, signguCd) 를 한국 행정 BJD 코드 기준으로 모아둔
 * 정적 레지스트리.
 *
 * <p>사용처
 * <ul>
 *   <li>{@code /searchKeyword1} 가 areaCd + signguCd + baseYm 를 모두 필수로 요구하므로,
 *       사용자가 단순 지명("여수", "한라산")만 입력해도 동작하려면 사전에 매핑이 필요하다.</li>
 *   <li>{@code /areaBasedList1} 의 광역 → 시군구 드릴다운 시, 광역 BJD 코드별 시군구 목록을 노출.</li>
 * </ul>
 *
 * <p>코드는 행정안전부 표준 BJD 코드(앞 2자리=광역, 5자리=시군구) 를 따른다.
 * 강원/전북은 2023~2024 특별자치도 출범 시 51/52 로 변경된 코드를 사용.
 */
public final class KoreanPlaceCodes {

    private KoreanPlaceCodes() {}

    /** 광역 BJD 코드 → 광역명. 화면 드롭다운/배지에 사용. */
    public static final Map<String, String> AREAS = unmodifiable(new LinkedHashMap<>() {{
        put("11", "서울");
        put("26", "부산");
        put("27", "대구");
        put("28", "인천");
        put("29", "광주");
        put("30", "대전");
        put("31", "울산");
        put("36", "세종");
        put("41", "경기");
        put("51", "강원");
        put("43", "충북");
        put("44", "충남");
        put("52", "전북");
        put("46", "전남");
        put("47", "경북");
        put("48", "경남");
        put("50", "제주");
    }});

    /**
     * 인기 지명 키워드 → (areaCd, signguCd). 키워드 모드에서 사용.
     * 키는 입력 정규화(공백 제거 + 소문자) 기준.
     */
    private static final Map<String, KoreanPlace> KEYWORD_TO_PLACE = unmodifiable(new LinkedHashMap<>() {{
        put(norm("한라산"),  new KoreanPlace("50", "50130", "서귀포시"));
        put(norm("제주"),    new KoreanPlace("50", "50110", "제주시"));
        put(norm("제주시"),  new KoreanPlace("50", "50110", "제주시"));
        put(norm("서귀포"),  new KoreanPlace("50", "50130", "서귀포시"));
        put(norm("서귀포시"),new KoreanPlace("50", "50130", "서귀포시"));
        put(norm("경주"),    new KoreanPlace("47", "47130", "경주시"));
        put(norm("강릉"),    new KoreanPlace("51", "51150", "강릉시"));
        put(norm("여수"),    new KoreanPlace("46", "46130", "여수시"));
        put(norm("담양"),    new KoreanPlace("46", "46710", "담양군"));
        put(norm("안동"),    new KoreanPlace("47", "47170", "안동시"));
        put(norm("통영"),    new KoreanPlace("48", "48220", "통영시"));
        put(norm("양양"),    new KoreanPlace("51", "51830", "양양군"));
        put(norm("부산"),    new KoreanPlace("26", "26110", "중구"));
        put(norm("서울"),    new KoreanPlace("11", "11680", "강남구"));
        put(norm("인천"),    new KoreanPlace("28", "28140", "중구"));
        put(norm("대전"),    new KoreanPlace("30", "30110", "동구"));
        put(norm("대구"),    new KoreanPlace("27", "27110", "중구"));
        put(norm("광주"),    new KoreanPlace("29", "29110", "동구"));
        put(norm("울산"),    new KoreanPlace("31", "31110", "중구"));
        put(norm("속초"),    new KoreanPlace("51", "51210", "속초시"));
        put(norm("춘천"),    new KoreanPlace("51", "51110", "춘천시"));
        put(norm("전주"),    new KoreanPlace("52", "52111", "완산구"));
        put(norm("순천"),    new KoreanPlace("46", "46150", "순천시"));
        put(norm("목포"),    new KoreanPlace("46", "46110", "목포시"));
        put(norm("거제"),    new KoreanPlace("48", "48310", "거제시"));
        put(norm("남해"),    new KoreanPlace("48", "48840", "남해군"));
    }});

    public static Optional<KoreanPlace> findByKeyword(String keyword) {
        if (keyword == null) return Optional.empty();
        String key = norm(keyword);
        if (key.isEmpty()) return Optional.empty();
        return Optional.ofNullable(KEYWORD_TO_PLACE.get(key));
    }

    /** 사전에 등록된 모든 인기 지명 키. UI 노출/디버깅용. */
    public static List<String> registeredKeywords() {
        return List.copyOf(KEYWORD_TO_PLACE.keySet());
    }

    private static String norm(String s) {
        return s == null ? "" : s.replaceAll("\\s+", "").toLowerCase();
    }

    private static <K, V> Map<K, V> unmodifiable(Map<K, V> m) {
        return java.util.Collections.unmodifiableMap(m);
    }

    /**
     * (areaCd, signguCd, signguName) 튜플.
     */
    public record KoreanPlace(String areaCd, String signguCd, String signguName) {}
}
