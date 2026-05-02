package fast.campus.netplix.wellness;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 웰니스관광 조회 서비스. 캐시/페이지네이션은 어댑터(VisitKoreaWellnessHttpClient)에서 관리.
 *
 * <p>상한 정책:
 *  - MAX_LIMIT = 5,000 (2026-04 기준 전국 웰니스관광지 약 700~900개 수준; 여유 버퍼 포함)
 *  - limit<=0 → "전체 반환" 의미로 해석(포트 레벨에서도 0 이면 자르지 않음).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WellnessSpotService implements GetWellnessSpotsUseCase {

    private static final int MAX_LIMIT = 5_000;
    /** 안전 반경 상한 (m). KTO API 정책은 20km, 내부 보수적 상한으로 30km 까지만 허용. */
    private static final int MAX_RADIUS_M = 30_000;
    private static final int DEFAULT_RADIUS_M = 10_000;

    private final WellnessSpotPort wellnessSpotPort;

    @Override
    public List<WellnessSpot> all(int limit) {
        return wellnessSpotPort.fetchAll(sanitize(limit));
    }

    @Override
    public List<WellnessSpot> nearby(double latitude, double longitude, int radiusM, int limit) {
        int r = radiusM <= 0 ? DEFAULT_RADIUS_M : Math.min(radiusM, MAX_RADIUS_M);
        return wellnessSpotPort.fetchNearby(latitude, longitude, r, sanitize(limit));
    }

    @Override
    public List<WellnessSpot> byKeyword(String keyword, int limit) {
        return wellnessSpotPort.fetchByKeyword(keyword, sanitize(limit));
    }

    @Override
    public List<WellnessSpot> byKorAdministrativeArea(String korAreaCode, String signguCodeOrNull, int limit) {
        return wellnessSpotPort.fetchByKorAdministrativeArea(korAreaCode, signguCodeOrNull, sanitize(limit));
    }

    private int sanitize(int limit) {
        if (limit <= 0) return 0;
        return Math.min(limit, MAX_LIMIT);
    }
}
