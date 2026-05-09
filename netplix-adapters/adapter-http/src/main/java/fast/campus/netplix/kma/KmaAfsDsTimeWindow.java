package fast.campus.netplix.kma;

import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * fct_afs_ds 의 tmfc1·tmfc2(각각 {@code yyyyMMddHH} 10자리, KST).
 */
public final class KmaAfsDsTimeWindow {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter F10 = DateTimeFormatter.ofPattern("yyyyMMddHH");

    private KmaAfsDsTimeWindow() {}

    /**
     * @param tmfc12Or10 발표시각(숫자만, 12자리 권장)
     * @return [tmfc1, tmfc2] 각 10자리, tmfc2 = tmfc1 + 12시간
     */
    public static String[] tmfc1Tmfc2(String tmfc12Or10) {
        if (tmfc12Or10 == null || tmfc12Or10.isBlank()) {
            return defaultWindow();
        }
        String digits = tmfc12Or10.replaceAll("\\D", "");
        if (digits.length() >= 12) {
            digits = digits.substring(0, 12);
        } else if (digits.length() == 10) {
            digits = digits + "00";
        } else if (digits.length() == 8) {
            digits = digits + "0000";
        } else {
            return defaultWindow();
        }
        String tmfc10 = digits.substring(0, 10);
        ZonedDateTime z = ZonedDateTime.of(
                        java.time.LocalDateTime.parse(tmfc10, F10), KST);
        String t2 = z.plusHours(12).format(F10);
        return new String[] {tmfc10, t2};
    }

    private static String[] defaultWindow() {
        ZonedDateTime l = ZonedDateTime.now(KST).withMinute(0).withSecond(0).withNano(0);
        return new String[] {l.format(F10), l.plusHours(12).format(F10)};
    }
}
