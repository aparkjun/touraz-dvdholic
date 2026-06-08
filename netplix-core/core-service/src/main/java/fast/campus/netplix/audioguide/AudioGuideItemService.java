package fast.campus.netplix.audioguide;

import fast.campus.netplix.translation.TextTranslationPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 오디오 가이드 조회 서비스. 캐시/페이지네이션은 어댑터(VisitKoreaOdiiHttpClient)에서 관리.
 *
 * <p>상한 정책:
 *  - MAX_LIMIT = 5,000 (이야기 포함 전체 약 수천 개 추정, 여유 버퍼)
 *  - MAX_RADIUS_M = 100,000 (100km; Odii GW location 은 20km 한도로, 그 초과는 캐시 전체+Haversine 필터)
 *  - DEFAULT_RADIUS_M = 10,000
 *  - 언어 화이트리스트 (ko/en/zh/ja). 그 외 입력은 ko 로 강제.
 *  - type null → THEME 로 강제 (기본).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AudioGuideItemService implements GetAudioGuideItemsUseCase {

    private static final int MAX_LIMIT = 5_000;
    private static final int MAX_RADIUS_M = 100_000;
    private static final int DEFAULT_RADIUS_M = 10_000;
    private static final Set<String> ALLOWED_LANGS = Set.of("ko", "en", "zh", "ja");
    private static final String DEFAULT_LANG = "ko";
    /** 비한국어 해설 번역 시 한 번에 처리할 스토리 상한(지연·비용 폭주 방지). */
    private static final int TRANSLATE_STORY_CAP = 20;

    private final AudioGuideItemPort port;
    private final TextTranslationPort translationPort;

    @Override
    public List<AudioGuideItem> all(AudioGuideItem.Type type, String lang, int limit) {
        return port.fetchAll(sanitizeType(type), sanitizeLang(lang), sanitize(limit));
    }

    @Override
    public List<AudioGuideItem> nearby(AudioGuideItem.Type type, String lang,
                                       double latitude, double longitude, int radiusM, int limit) {
        int r = radiusM <= 0 ? DEFAULT_RADIUS_M : Math.min(radiusM, MAX_RADIUS_M);
        return port.fetchNearby(sanitizeType(type), sanitizeLang(lang), latitude, longitude, r, sanitize(limit));
    }

    @Override
    public List<AudioGuideItem> byKeyword(AudioGuideItem.Type type, String lang, String keyword, int limit) {
        return port.fetchByKeyword(sanitizeType(type), sanitizeLang(lang), keyword, sanitize(limit));
    }

    @Override
    public List<AudioGuideItem> storiesByTheme(String themeId, String themeTitleHint, String lang, int limit,
                                               Double anchorLat, Double anchorLon) {
        if (themeId == null || themeId.isBlank()) return List.of();
        String id = themeId.trim();
        String hint = themeTitleHint == null || themeTitleHint.isBlank() ? null : themeTitleHint.trim();
        String target = sanitizeLang(lang);
        int lim = sanitize(limit);

        List<AudioGuideItem> result = port.fetchStoriesByTheme(id, hint, target, lim, anchorLat, anchorLon);

        /*
         * 비한국어로 보는데 해당 언어 네이티브 해설이 없으면(어댑터가 빈 목록 또는 한국어만 반환),
         * 한국어 해설을 다시 받아 선택 언어로 번역해 제공한다. 번역 실패 시엔 한국어 원문을
         * 그대로 노출(숨기지 않음)해 자연 degrade 한다.
         */
        if (!"ko".equals(target) && translationPort != null && translationPort.isAvailable()) {
            boolean hasNativeAligned = result.stream()
                    .anyMatch(it -> languageAligns(it.getLanguage(), target));
            if (!hasNativeAligned) {
                List<AudioGuideItem> ko = port.fetchStoriesByTheme(id, hint, "ko", lim, anchorLat, anchorLon);
                if (!ko.isEmpty()) {
                    return translateStories(ko, target);
                }
            }
        }
        return result;
    }

    /** 한국어 스토리들의 제목·오디오제목·해설 대본을 target 언어로 번역해 새 아이템으로 재구성한다. */
    private List<AudioGuideItem> translateStories(List<AudioGuideItem> koItems, String target) {
        int cap = Math.min(koItems.size(), TRANSLATE_STORY_CAP);
        List<AudioGuideItem> src = koItems.subList(0, cap);

        // [title, audioTitle, description] × N 으로 평탄화해 한 번에 번역.
        List<String> texts = new ArrayList<>(src.size() * 3);
        for (AudioGuideItem it : src) {
            texts.add(nz(it.getTitle()));
            texts.add(nz(it.getAudioTitle()));
            texts.add(nz(it.getDescription()));
        }

        List<String> tr;
        try {
            tr = translationPort.translate(texts, target);
        } catch (Exception e) {
            log.warn("[AUDIO-GUIDE] 해설 번역 실패 → 한국어 폴백: {}", e.getMessage());
            return koItems;
        }
        if (tr == null || tr.size() != texts.size()) {
            return koItems;
        }

        List<AudioGuideItem> out = new ArrayList<>(src.size());
        for (int i = 0; i < src.size(); i++) {
            AudioGuideItem it = src.get(i);
            String t = blankToNull(tr.get(i * 3));
            String at = blankToNull(tr.get(i * 3 + 1));
            String d = blankToNull(tr.get(i * 3 + 2));
            out.add(it.toBuilder()
                    .title(t != null ? t : it.getTitle())
                    .audioTitle(at != null ? at : it.getAudioTitle())
                    .description(d != null ? d : it.getDescription())
                    /*
                     * 원본 audioUrl 은 한국어 mp3 다. 이걸 남겨두면 프런트가 그 한국어 녹음을
                     * 그대로 재생해 "언어를 바꿔도 소리는 한국어"가 된다. 번역본은 오디오를 비워
                     * 프런트가 번역 대본을 선택 언어 TTS 음성으로 읽도록 한다.
                     */
                    .audioUrl(null)
                    .playTimeText(null)
                    .language(target)
                    .build());
        }
        return out;
    }

    /** 콘텐츠 언어 필드가 선택 언어와 일치하는지(BCP47 접두 허용). */
    private static boolean languageAligns(String itemLang, String target) {
        if (itemLang == null) return false;
        String n = itemLang.trim().toLowerCase(Locale.ROOT);
        if (n.isEmpty()) return false;
        if (n.startsWith("zh")) n = "zh";
        else if (n.startsWith("ja")) n = "ja";
        else if (n.startsWith("en")) n = "en";
        else if (n.startsWith("ko")) n = "ko";
        return n.equals(target);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    @Override
    public AudioGuideOdiiMeta odiiMeta() {
        return new AudioGuideOdiiMeta(port.isConfigured(), 0, port.isQuotaBackoffActive());
    }

    private int sanitize(int limit) {
        if (limit <= 0) return 0;
        return Math.min(limit, MAX_LIMIT);
    }

    private String sanitizeLang(String lang) {
        if (lang == null || lang.isBlank()) return DEFAULT_LANG;
        String normalized = lang.trim().toLowerCase(Locale.ROOT);
        if (ALLOWED_LANGS.contains(normalized)) {
            return normalized;
        }
        /*
         * i18n·클라이언트가 zh-CN, en-US, ja-JP 등 BCP47 태그를 넘기면
         * 이전에는 무조건 ko 로 떨어져 stories-by-theme 의 비한국어 브리지 분기가 전부 스킵되었다.
         */
        if (normalized.startsWith("zh")) {
            return "zh";
        }
        if (normalized.startsWith("ja")) {
            return "ja";
        }
        if (normalized.startsWith("en")) {
            return "en";
        }
        if (normalized.startsWith("ko")) {
            return "ko";
        }
        return DEFAULT_LANG;
    }

    private AudioGuideItem.Type sanitizeType(AudioGuideItem.Type type) {
        return type == null ? AudioGuideItem.Type.THEME : type;
    }
}
