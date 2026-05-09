package fast.campus.netplix.kma;

import java.util.Map;

/**
 * 단기 개황(fct_afs_ds) 조회용 STN(발표관서). reg 코드는 예보 구역(11B…), STN은 관서 번호.
 */
public final class KmaRegToAfsDsStn {

    private static final Map<String, Integer> BY_REG = Map.ofEntries(
            Map.entry("11B10101", 109),
            Map.entry("11B10103", 109),
            Map.entry("11B20201", 109),
            Map.entry("11B20605", 109),
            Map.entry("11B20405", 101),
            Map.entry("11B20403", 105),
            Map.entry("11C10301", 127),
            Map.entry("11C10304", 133),
            Map.entry("11C20401", 133),
            Map.entry("11H10701", 143),
            Map.entry("11H10201", 152),
            Map.entry("11H20201", 155),
            Map.entry("11H20301", 155),
            Map.entry("11F20501", 156),
            Map.entry("11F10201", 140),
            Map.entry("11F20801", 168),
            Map.entry("11G00201", 184),
            Map.entry("11H10301", 138),
            Map.entry("11H10501", 136),
            Map.entry("11F10301", 146));

    private KmaRegToAfsDsStn() {}

    public static int stnForReg(String reg, int defaultStn) {
        if (reg == null || reg.isBlank()) {
            return defaultStn;
        }
        String r = reg.trim();
        Integer exact = BY_REG.get(r);
        if (exact != null) {
            return exact;
        }
        if (r.startsWith("11B1") || r.startsWith("11B2")) {
            return 109;
        }
        if (r.startsWith("11C1")) {
            return 127;
        }
        if (r.startsWith("11C2")) {
            return 133;
        }
        if (r.startsWith("11D")) {
            return 101;
        }
        if (r.startsWith("11F1")) {
            return 140;
        }
        if (r.startsWith("11F2")) {
            return 156;
        }
        if (r.startsWith("11G0")) {
            return 184;
        }
        if (r.startsWith("11H1")) {
            return 130;
        }
        if (r.startsWith("11H2")) {
            return 155;
        }
        return defaultStn;
    }
}
