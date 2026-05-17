package fast.campus.netplix.audioguide;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

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

    private final AudioGuideItemPort port;

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
        String hint = themeTitleHint == null || themeTitleHint.isBlank() ? null : themeTitleHint.trim();
        return port.fetchStoriesByTheme(themeId.trim(), hint, sanitizeLang(lang), sanitize(limit), anchorLat, anchorLon);
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
