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

    /**
     * 최근 발표 시각 후보 — 최신 문자열 순 (yyyyMMddHHmm).
     * 각 회차(02·05·…·23시)는 발표 후 약 20분 뒤부터 조회하는 것으로 가정한다.
     */
    public static List<String> candidatesNewestFirst() {
        ZonedDateTime now = ZonedDateTime.now(KST);
        Set<String> ordered = new LinkedHashSet<>();
        for (int dayBack = 0; dayBack <= 2; dayBack++) {
            LocalDate d = now.toLocalDate().minusDays(dayBack);
            for (int h : BASE_HOURS_DESC) {
                ZonedDateTime cand = d.atTime(h, 0).atZone(KST);
                if (now.isBefore(cand.plusMinutes(20))) {
                    continue;
                }
                ordered.add(cand.format(TMFC));
            }
        }
        List<String> list = new ArrayList<>(ordered);
        list.sort(Comparator.reverseOrder());
        return list;
    }

    /**
     * {@link #candidatesNewestFirst()}가 비었을 때(이론상 드묾) 마지막 수단으로 사용하는 tmfc.
     */
    public static String conservativeFallbackTmfc() {
        ZonedDateTime z = ZonedDateTime.now(KST).minusHours(2).withMinute(0).withSecond(0).withNano(0);
        return z.format(TMFC);
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
