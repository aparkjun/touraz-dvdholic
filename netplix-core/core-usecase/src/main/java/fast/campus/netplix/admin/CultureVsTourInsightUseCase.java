package fast.campus.netplix.admin;

import java.util.List;

/**
 * 관리자 "문화×관광 인사이트" 뷰 모델을 조립하는 유스케이스.
 * DVD 매장 집계(DvdStorePort)와 관광공사 스냅샷(TourIndexUseCase)을 지자체 코드로 조인한다.
 */
public interface CultureVsTourInsightUseCase {

    /**
     * 지자체별 문화×관광 인사이트 행을 반환한다.
     * 기준은 DVD 매장이 존재하는 지자체 ∪ 관광 지표가 존재하는 지자체 의 합집합.
     */
    List<CultureVsTourRow> getRows();
}
