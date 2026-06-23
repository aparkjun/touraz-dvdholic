package fast.campus.netplix.util;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * safemap 가스사고 시군구명 인코딩 복구.
 * UTF-8 한글이 ISO-8859-1/Windows-1252 로 잘못 읽혀 ì·ëí 형태 mojibake 가 되는 경우를 복구한다.
 */
public final class GasRegionNameNormalizer {

    private GasRegionNameNormalizer() {}

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        String trimmed = raw.trim();
        if (looksLikeKoreanAdminName(trimmed)) {
            return trimmed;
        }
        for (String charsetName : new String[] {"ISO-8859-1", "windows-1252"}) {
            try {
                Charset cs = Charset.forName(charsetName);
                String fixed = new String(trimmed.getBytes(cs), StandardCharsets.UTF_8);
                if (looksLikeKoreanAdminName(fixed)) {
                    return fixed;
                }
            } catch (Exception ignored) {
                /* charset 미지원 — 다음 시도 */
            }
        }
        return trimmed;
    }

    public static boolean looksLikeKoreanAdminName(String s) {
        if (s == null || !containsHangul(s)) {
            return false;
        }
        if (s.contains("특별") || s.contains("광역")) {
            return true;
        }
        return s.endsWith("시") || s.endsWith("군") || s.endsWith("구") || s.endsWith("도");
    }

    private static boolean containsHangul(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                return true;
            }
        }
        return false;
    }
}
