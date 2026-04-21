package fast.campus.netplix.tour;

import java.time.LocalDate;
import java.util.List;

/**
 * 한국관광공사 데이터랩 API 를 추상화한 포트.
 * adapter-http 에서 구현하며, 실제 호출은 배치 경유(일 1회) 가 주 경로.
 */
public interface VisitKoreaDataLabPort {

    /**
     * 지정한 기준일의 전체 지자체 지표를 한 번에 가져온다.
     * API 응답 중 누락된 지표는 null 로 둔다.
     */
    List<TourIndex> fetchIndicesForDate(LocalDate baseDate);

    /**
     * 서비스키가 설정되어 있는지 여부. 미설정 시 배치는 no-op 으로 동작.
     */
    boolean isConfigured();
}
