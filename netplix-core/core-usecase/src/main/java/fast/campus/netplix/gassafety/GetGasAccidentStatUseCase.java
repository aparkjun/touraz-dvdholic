package fast.campus.netplix.gassafety;

import java.util.List;

/**
 * 가스사고발생통계 조회 유스케이스. 컨트롤러 → 서비스 → 포트 계층 분리를 위한 얇은 래퍼.
 */
public interface GetGasAccidentStatUseCase {

    /** 시군구 단위 가스사고 발생건수 목록(발생건수 내림차순). */
    List<GasAccidentStat> sigunguStats();
}
