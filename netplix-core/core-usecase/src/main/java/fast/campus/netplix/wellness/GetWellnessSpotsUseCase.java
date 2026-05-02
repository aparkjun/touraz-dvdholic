package fast.campus.netplix.wellness;

import java.util.List;

/**
 * 웰니스관광 조회 유스케이스.
 * 컨트롤러 → 서비스 → 포트 계층 분리를 유지하기 위한 얇은 래퍼.
 */
public interface GetWellnessSpotsUseCase {

    List<WellnessSpot> all(int limit);

    List<WellnessSpot> nearby(double latitude, double longitude, int radiusM, int limit);

    List<WellnessSpot> byKeyword(String keyword, int limit);

    List<WellnessSpot> byKorAdministrativeArea(String korAreaCode, String signguCodeOrNull, int limit);
}
