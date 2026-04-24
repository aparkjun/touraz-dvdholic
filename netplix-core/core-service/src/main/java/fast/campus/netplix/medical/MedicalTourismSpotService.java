package fast.campus.netplix.medical;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 의료관광 조회 서비스. 캐시/페이지네이션은 어댑터(VisitKoreaMedicalTourismHttpClient)에서 관리.
 *
 * <p>상한 정책:
 *  - MAX_LIMIT = 5,000
 *  - limit<=0 → "전체 반환" 의미로 해석(포트 레벨에서도 0 이면 자르지 않음).
 *  - 언어 화이트리스트 (ko/en). 그 외 입력은 ko 로 강제.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MedicalTourismSpotService implements GetMedicalTourismSpotsUseCase {

    private static final int MAX_LIMIT = 5_000;
    private static final int MAX_RADIUS_M = 30_000;
    private static final int DEFAULT_RADIUS_M = 10_000;
    /** KTO 의료관광 API 가 langDivCd 로 지원하는 언어 화이트리스트. 서비스 정책상 ko/en 만 노출. */
    private static final Set<String> ALLOWED_LANGS = Set.of("ko", "en");
    private static final String DEFAULT_LANG = "ko";

    private final MedicalTourismSpotPort port;

    @Override
    public List<MedicalTourismSpot> all(String lang, int limit) {
        return port.fetchAll(sanitizeLang(lang), sanitize(limit));
    }

    @Override
    public List<MedicalTourismSpot> nearby(String lang, double latitude, double longitude, int radiusM, int limit) {
        int r = radiusM <= 0 ? DEFAULT_RADIUS_M : Math.min(radiusM, MAX_RADIUS_M);
        return port.fetchNearby(sanitizeLang(lang), latitude, longitude, r, sanitize(limit));
    }

    @Override
    public List<MedicalTourismSpot> byKeyword(String lang, String keyword, int limit) {
        return port.fetchByKeyword(sanitizeLang(lang), keyword, sanitize(limit));
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
}
