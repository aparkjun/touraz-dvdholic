package fast.campus.netplix.user;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 가입 시 전화번호를 {@code (+국가번호)국내번호} 형태로 맞춘다.
 * 한국 사용자는 010-1234-5678 처럼 0을 붙여 보내는 경우가 많은데,
 * 기존 검증은 국가번호 뒤 정확히 10자리만 허용해서 가입이 실패했다.
 */
public final class PhoneNumberFormatter {

    private static final Pattern WRAPPED = Pattern.compile("^\\(\\+(\\d{1,3})\\)(.*)$");
    private static final Pattern STORED = Pattern.compile("^\\(\\+\\d{1,3}\\)\\d{8,11}$");

    private PhoneNumberFormatter() {
    }

    /**
     * @return 비어 있으면 {@code null}. 값이 있으면 저장용 문자열.
     * @throws IllegalArgumentException 형식이 맞지 않을 때
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String trimmed = raw.trim();
        String country = null;
        String nationalRaw = trimmed;

        Matcher wrapped = WRAPPED.matcher(trimmed);
        if (wrapped.matches()) {
            country = wrapped.group(1);
            nationalRaw = wrapped.group(2);
        } else {
            String compact = trimmed.replaceAll("[\\s-]", "");
            if (compact.startsWith("+")) {
                String afterPlus = compact.substring(1).replaceAll("\\D", "");
                if (afterPlus.startsWith("82") && afterPlus.length() >= 10) {
                    country = "82";
                    nationalRaw = afterPlus.substring(2);
                } else if (afterPlus.length() >= 9 && afterPlus.length() <= 14) {
                    country = afterPlus.substring(0, Math.min(2, afterPlus.length() - 8));
                    if (country.isEmpty()) {
                        throw new IllegalArgumentException("missing country");
                    }
                    nationalRaw = afterPlus.substring(country.length());
                }
            }
        }

        String digits = nationalRaw.replaceAll("\\D", "");
        if (digits.isEmpty()) {
            throw new IllegalArgumentException("empty national number");
        }

        if (country == null) {
            country = "82";
        }

        if ("82".equals(country) && digits.startsWith("0")) {
            digits = digits.replaceFirst("^0+", "");
        }

        String stored = "(+" + country + ")" + digits;
        if (!STORED.matcher(stored).matches()) {
            throw new IllegalArgumentException("invalid phone: " + raw);
        }
        return stored;
    }
}
