package fast.campus.netplix.controller.gassafety;

import fast.campus.netplix.gassafety.GasAccidentStat;

/**
 * 가스사고발생통계(시군구) 프론트 소비용 DTO.
 */
public record GasAccidentStatResponse(
        String region,
        int count,
        Integer casualties
) {
    public static GasAccidentStatResponse from(GasAccidentStat s) {
        return new GasAccidentStatResponse(s.regionName(), s.accidentCount(), s.casualtyCount());
    }
}
