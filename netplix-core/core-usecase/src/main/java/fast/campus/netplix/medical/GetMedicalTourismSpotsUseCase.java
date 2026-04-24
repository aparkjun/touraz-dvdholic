package fast.campus.netplix.medical;

import java.util.List;

/**
 * 의료관광 조회 유스케이스.
 * 컨트롤러 → 서비스 → 포트 계층 분리를 유지하기 위한 얇은 래퍼.
 */
public interface GetMedicalTourismSpotsUseCase {

    List<MedicalTourismSpot> all(String lang, int limit);

    List<MedicalTourismSpot> nearby(String lang, double latitude, double longitude, int radiusM, int limit);

    List<MedicalTourismSpot> byKeyword(String lang, String keyword, int limit);
}
