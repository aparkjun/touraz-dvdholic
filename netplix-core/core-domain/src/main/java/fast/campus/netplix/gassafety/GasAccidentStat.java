package fast.campus.netplix.gassafety;

/**
 * 행정안전부 생활안전지도(safemap.go.kr) 가스사고발생통계 — 시군구 단위 집계 항목.
 *
 * <p>출처: safemap openapi2 IF_0064 (가스사고발생이력통계, 한국가스안전공사 제공).
 *  - regionName: 시군구 명칭(예: "서울특별시 강남구"). 원문 시도+시군구를 합쳐 표기.
 *  - accidentCount: 해당 지역 가스사고 발생건수 합계.
 *  - casualtyCount: 인명피해(사상) 수. 원문에 없으면 null.
 */
public record GasAccidentStat(
        String regionName,
        int accidentCount,
        Integer casualtyCount
) {
}
