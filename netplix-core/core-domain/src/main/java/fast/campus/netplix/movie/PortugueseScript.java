package fast.campus.netplix.movie;

import java.util.regex.Pattern;

/**
 * TMDB {@code pt-BR} 는 번역이 없으면 영어 원문을 그대로 돌려주는 경우가 있다.
 * 브라질 포르투갈어 표지(ã/õ/ç, 동사 활용, 흔한 접속사)가 있어야 실제 PT 로 본다.
 */
public final class PortugueseScript {

    private static final Pattern PT_MARKERS = Pattern.compile(
            "[ãõáàâéêíóôúüçÃÕÁÀÂÉÊÍÓÔÚÜÇ]"
                    + "|\\b(não|você|vocês|também|filme|filmes|história|sinopse|pelo|pela|uma|uns|umas)\\b",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private PortugueseScript() {
    }

    public static boolean isUsable(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return PT_MARKERS.matcher(text).find();
    }

    public static boolean isTranslatableSource(String text) {
        return NepaliScript.isTranslatableSource(text);
    }

    public static String firstTranslatable(String... texts) {
        return NepaliScript.firstTranslatable(texts);
    }
}
