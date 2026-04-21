package fast.campus.netplix.tour;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TourIndexUseCase {

    /**
     * 지정 기준일로 외부 API 를 호출해 전체 지자체 지표를 upsert 한다.
     * 반환값: 저장된 지자체 수.
     */
    int syncFromApi(LocalDate baseDate);

    /**
     * 지자체별 최신 스냅샷(1개/지자체) 목록. 히트맵/대시보드용.
     */
    List<TourIndex> getLatestPerRegion();

    Optional<TourIndex> getLatestByAreaCode(String areaCode);

    /**
     * 검색량 상위 N 지자체 → "오늘 뜨는 지역" 위젯 소스.
     */
    List<TourIndex> getTopBySearchVolume(int limit);
}
