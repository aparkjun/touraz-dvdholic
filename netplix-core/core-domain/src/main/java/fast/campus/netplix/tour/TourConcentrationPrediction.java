package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

/**
 * 한국관광공사 관광지 집중률 방문자 추이 예측 데이터 1행.
 * 출처: TatsCnctrRateService / tatsCnctrRatedList (공공데이터 15128555)
 *
 * <p>요청 (areaCd=2자리, signguCd=5자리, 선택 tAtsNm) 기준으로 "오늘 포함 향후 7일"의
 * 예상 집중률(%)을 반환. 집중률은 해당 관광지 혼잡도를 0~100 으로 정규화한 값이며
 * 100 에 가까울수록 혼잡 예측이 높다.
 *
 * <p>저장 정책: 현 시점에는 어댑터 레벨 in-memory 캐시 (6h) 만 사용하고 DB 스냅샷을 남기지 않는다.
 * 일 단위로 갱신되는 예측치라 DB 누적보다 실시간 패치가 적합.
 */
@Getter
@Builder
public class TourConcentrationPrediction {

    private final LocalDate baseDate;

    /**
     * KorService2 areaCode (1~8, 31~39). 서비스 계층에서 lDongRegnCd 로 부터 변환 후 저장한다.
     */
    private final String areaCode;

    /**
     * 광역 명칭 (예: 서울특별시). KTO 응답의 areaNm 그대로.
     */
    private final String areaName;

    /**
     * 법정동 5자리 시군구 코드 (KTO 원본 그대로 보존).
     */
    private final String signguCode;

    /**
     * 시군구 명칭 (예: 종로구).
     */
    private final String signguName;

    /**
     * 관광지 명칭 (tAtsNm). KTO 가 signguCd 별 대표 관광지 1개를 기본 반환하며
     * 요청 파라미터에 tAtsNm 을 명시하면 해당 관광지 예측만 반환된다.
     */
    private final String spotName;

    /**
     * 0~100 범위. 소수점 2자리까지 포함될 수 있다.
     */
    private final Double concentrationRate;
}
