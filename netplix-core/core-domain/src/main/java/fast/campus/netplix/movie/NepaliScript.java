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
}
