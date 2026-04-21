package fast.campus.netplix.tour;

import java.util.List;

/**
 * 관광지 집중률 예측 조회 유스케이스.
 *
 * <p>두 가지 조회 모드:
 * <ol>
 *   <li>광역 기준(기본): 서비스 계층이 보유한 "광역 → 대표 시군구" 매핑을 이용해
 *       해당 지자체의 대표 관광지 7일 예측을 반환. 프론트에서 KorService2 areaCode 만 넘기면 됨.</li>
 *   <li>관광지 지정: 프론트가 직접 signguCode (+ 선택 spotName) 을 지정해 특정 관광지 예측을 받는다.</li>
 * </ol>
 */
public interface GetTourConcentrationUseCase {

    /**
     * KorService2 areaCode 기준 해당 광역 대표 관광지 7일 예측.
     * 매핑이 없는 areaCode 는 빈 리스트.
     */
    List<TourConcentrationPrediction> byAreaCode(String areaCode);

    /**
     * 시군구 코드 + 관광지명(선택) 기준 예측.
     */
    List<TourConcentrationPrediction> bySignguCode(String areaCode, String signguCode, String spotName);
}
