package fast.campus.netplix.kma;

import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * fct_afs_ds 의 tmfc1·tmfc2(각각 {@code yyyyMMddHH} 10자리, KST).
 */
public final class KmaAfsDsTimeWindow {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter F10 = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter F12 = DateTimeFormatter.ofPattern("yyyyMMddHHmm");

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

    /**
     * 발표시각(12자리 권장)을 KST 기준으로 시간만큼 이동한 {@code yyyyMMddHHmm}.
     *
     * @return 정규화된 12자리 또는 파싱 불가 시 null
     */
    public static String shiftTmfc12(String tmfc12OrDigits, int hoursDelta) {
        String n = KmaShortRegIssuanceTime.normalizeTmfc(tmfc12OrDigits);
        if (n == null || n.length() < 12) {
            return null;
        }
        n = n.substring(0, 12);
        try {
            LocalDateTime l = LocalDateTime.parse(n, F12);
            return l.plusHours(hoursDelta).atZone(KST).format(F12);
        } catch (Exception e) {
            return null;
        }
    }
}
