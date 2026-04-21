package fast.campus.netplix.tour;

import java.util.List;

/**
 * 한국관광공사 관광지 집중률 예측 API 포트.
 * (TatsCnctrRateService / tatsCnctrRatedList, 공공데이터 15128555)
 *
 * <p>어댑터(http) 구현은 in-memory TTL 캐시(6h)를 포함. 응답은 "오늘 포함 향후 7일" 예측이라
 * 하루 내 동일 (signguCode, spotName) 쿼리는 모두 동일 결과.
 */
public interface TourConcentrationPort {

    /**
     * 주어진 시군구의 대표 관광지 7일 예측을 반환.
     *
     * @param areaCode   KorService2 areaCode (1~8, 31~39). 내부에서 lDongRegnCd 로 변환.
     * @param signguCode 법정동 시군구 5자리 (예: 11110=종로구). null/blank 불가.
     * @param spotName   선택. 지정 시 해당 관광지 예측만 반환. null 이면 signguCd 기본 관광지.
     * @return 날짜 오름차순으로 정렬된 예측 리스트. 미설정/오류/빈 응답 시 빈 리스트.
     */
    List<TourConcentrationPrediction> fetchPredictions(String areaCode, String signguCode, String spotName);

    /**
     * serviceKey 설정 여부. false 면 모든 조회가 빈 리스트.
     */
    boolean isConfigured();
}
