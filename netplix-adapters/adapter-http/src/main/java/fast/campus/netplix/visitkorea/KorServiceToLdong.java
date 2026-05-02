package fast.campus.netplix.visitkorea;

import java.util.Map;
import java.util.Optional;

/**
 * KorService2 광역 areaCode (1~8, 31~39) ↔ 법정동 광역코드 {@code lDongRegnCd} (11, 26, …).
 * 집중률·웰니스·포토 등 KTO 패밀리 간 코드 체계를 맞출 때 공통으로 사용한다.
 */
public final class KorServiceToLdong {

    private KorServiceToLdong() {}

    private static final Map<String, String> KOR_AREA_TO_LDONG_REGN = Map.ofEntries(
            Map.entry("1", "11"),
            Map.entry("2", "28"),
            Map.entry("3", "30"),
            Map.entry("4", "27"),
            Map.entry("5", "29"),
            Map.entry("6", "26"),
            Map.entry("7", "31"),
            Map.entry("8", "36"),
            Map.entry("31", "41"),
            Map.entry("32", "51"),
            Map.entry("33", "43"),
            Map.entry("34", "44"),
            Map.entry("35", "47"),
            Map.entry("36", "48"),
            Map.entry("37", "52"),
            Map.entry("38", "46"),
            Map.entry("39", "50")
    );

    /** KorService2 areaCode 문자열 → lDongRegnCd (2자리). */
    public static Optional<String> lDongRegnCd(String korServiceAreaCode) {
        if (korServiceAreaCode == null || korServiceAreaCode.isBlank()) {
            return Optional.empty();
        }
        String v = korServiceAreaCode.trim();
        return Optional.ofNullable(KOR_AREA_TO_LDONG_REGN.get(v));
    }

    /**
     * 웰니스 등에서 쿼리로 넘어온 값이 Kor 코드(1·31)이거나, 이미 법정동 광역 2자리(11·41)인 경우 모두 수용.
     */
    public static Optional<String> ldongRegnForWellnessAreaParam(String korOrLdongTwoDigit) {
        if (korOrLdongTwoDigit == null || korOrLdongTwoDigit.isBlank()) {
            return Optional.empty();
        }
        String v = korOrLdongTwoDigit.trim();
        Optional<String> fromKor = lDongRegnCd(v);
        if (fromKor.isPresent()) {
            return fromKor;
        }
        if (v.matches("\\d{2}")) {
            return Optional.of(v);
        }
        return Optional.empty();
    }
}
