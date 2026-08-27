package fast.campus.netplix.movie;

/**
 * TMDB {@code ne-NP} 는 번역이 없으면 영어 원문을 그대로 돌려주는 경우가 많다.
 * 데바나가리(네팔어)가 한 글자라도 있어야 실제 네팔어로 본다.
 */
public final class NepaliScript {

    private NepaliScript() {
    }

    public static boolean isUsable(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.codePoints().anyMatch(cp -> cp >= 0x0900 && cp <= 0x097F);
    }

    /** 한국어가 없으면 영어 줄거리·태그라인을 네팔어 번역 원문으로 쓴다. */
    public static boolean isTranslatableSource(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return !"No description available.".equalsIgnoreCase(text.trim());
    }

    public static String firstTranslatable(String... texts) {
        if (texts == null) {
            return null;
        }
        for (String text : texts) {
            if (isTranslatableSource(text)) {
                return text;
            }
        }
        return null;
    }
}
