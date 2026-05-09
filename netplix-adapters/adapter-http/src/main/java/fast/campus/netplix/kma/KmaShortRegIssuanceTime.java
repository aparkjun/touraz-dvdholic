package fast.campus.netplix.kma;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 기상청 API허브 단기예보 fct_shrt_reg — 발표 시각(tmfc)은 하루 8회(02·05·08·11·14·17·20·23시, KST),
 * null/0 으로 호출하면 &quot;단기예보구역 조회&quot; 텍스트만 내려온다.
 */
public final class KmaShortRegIssuanceTime {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int[] BASE_HOURS_DESC = {23, 20, 17, 14, 11, 8, 5, 2};
    private static final DateTimeFormatter TMFC = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    private KmaShortRegIssuanceTime() {}

    /** 최근 발표 시각 후보 — 최신 문자열 순 (yyyyMMddHHmm). 자료 반영 지연 ~40분 가정. */
    public static List<String> candidatesNewestFirst() {
        ZonedDateTime now = ZonedDateTime.now(KST);
        ZonedDateTime ref = now.minusMinutes(40);
        Set<String> ordered = new LinkedHashSet<>();
        for (int dayBack = 0; dayBack <= 1; dayBack++) {
            LocalDate d = ref.toLocalDate().minusDays(dayBack);
            for (int h : BASE_HOURS_DESC) {
                ZonedDateTime cand = d.atTime(h, 0).atZone(KST);
                if (!cand.isAfter(ref)) {
                    ordered.add(cand.format(TMFC));
                }
            }
        }
        List<String> list = new ArrayList<>(ordered);
        list.sort(Comparator.reverseOrder());
        return list;
    }

    /** 숫자만 남겨 12자리(yyyyMMddHHmm)로 맞춤 */
    public static String normalizeTmfc(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() >= 12) {
            return digits.substring(0, 12);
        }
        if (digits.length() == 10) {
            return digits + "00";
        }
        if (digits.length() >= 8) {
            return digits;
        }
        return null;
    }
}
