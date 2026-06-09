package fast.campus.netplix.gassafety;

import java.util.List;

/**
 * 생활안전지도 가스사고발생통계(IF_0064) 조회 포트.
 * 외부(safemap) 호출·XML 파싱·시군구 집계는 어댑터에서 담당한다.
 */
public interface GasAccidentStatPort {

    /** 서비스키·엔드포인트 설정 여부. 미설정이면 호출부는 빈 목록으로 자연 degrade. */
    boolean isConfigured();

    /** 시군구 단위 가스사고 발생건수 목록(발생건수 내림차순). */
    List<GasAccidentStat> fetchSigunguStats();

    /** 임시 진단: safemap page1 호출의 원시 결과(키 마스킹·resultCode·앞부분 스니펫)를 문자열로. */
    String debugProbe();
}
