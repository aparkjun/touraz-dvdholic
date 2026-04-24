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
 *  - MAX_RADIUS_M = 30,000 / DEFAULT_RADIUS_M = 10,000
 *  - 언어 화이트리스트 (ko/en). 그 외 입력은 ko 로 강제.
 *  - type null → THEME 로 강제 (기본).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AudioGuideItemService implements GetAudioGuideItemsUseCase {

    private static final int MAX_LIMIT = 5_000;
    private static final int MAX_RADIUS_M = 30_000;
    private static final int DEFAULT_RADIUS_M = 10_000;
    private static final Set<String> ALLOWED_LANGS = Set.of("ko", "en");
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

    private int sanitize(int limit) {
        if (limit <= 0) return 0;
        return Math.min(limit, MAX_LIMIT);
    }

    private String sanitizeLang(String lang) {
        if (lang == null || lang.isBlank()) return DEFAULT_LANG;
        String normalized = lang.trim().toLowerCase(Locale.ROOT);
        return ALLOWED_LANGS.contains(normalized) ? normalized : DEFAULT_LANG;
    }

    private AudioGuideItem.Type sanitizeType(AudioGuideItem.Type type) {
        return type == null ? AudioGuideItem.Type.THEME : type;
    }
}
