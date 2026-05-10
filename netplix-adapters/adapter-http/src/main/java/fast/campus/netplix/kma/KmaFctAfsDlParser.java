package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * 단기 육상 다운로드({@code fct_afs_dl.php}, disp=0, help=0) 공백 구분 텍스트를
 * {@link KmaForecastSeriesExtractor} 가 탐색할 수 있는 JSON 으로 변환.
 */
public final class KmaFctAfsDlParser {

    private static final ObjectMapper M = new ObjectMapper();

    private KmaFctAfsDlParser() {}

    /**
     * @param rawText  허브 본문(이미 MS949/UTF-8 등 디코딩된 문자열)
     * @param expectReg 예보구역 코드 — 첫 컬럼과 일치하는 행만 사용
     * @return {@code result.status=0} + {@code items[]} JSON; 파싱·일치 행 없으면 null
     */
    public static String tabularTextToSeriesJson(String rawText, String expectReg) {
        if (rawText == null || rawText.isBlank() || expectReg == null || expectReg.isBlank()) {
            return null;
        }
        String reg = expectReg.trim();
        String norm = rawText.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = norm.split("\n");
        ArrayNode items = M.createArrayNode();
        for (String line : lines) {
            String t = line.strip();
            if (t.isEmpty() || t.startsWith("#")) {
                continue;
            }
            String[] p = t.split("\\s+");
            // tistory 샘플: regId TM_FC TM_EF ... TA ST SKY … (최소 15토큰)
            if (p.length < 15) {
                continue;
            }
            if (!reg.equals(p[0])) {
                continue;
            }
            String tmEf = p[2];
            ObjectNode row = M.createObjectNode();
            if (!fillFromTmEf(tmEf, row)) {
                continue;
            }
            putIfNumeric(row, "TMP", p[12]);
            putIfNumeric(row, "POP", p[13]);
            putIfInt(row, "SKY", p[14]);
            items.add(row);
        }
        if (items.isEmpty()) {
            return null;
        }
        try {
            ObjectNode root = M.createObjectNode();
            root.putObject("result").put("status", 0);
            root.put("source", "fct_afs_dl");
            root.set("items", items);
            return M.writeValueAsString(root);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean fillFromTmEf(String tmEf, ObjectNode row) {
        if (tmEf == null) {
            return false;
        }
        String digits = tmEf.replaceAll("\\D", "");
        if (digits.length() < 8) {
            return false;
        }
        row.put("fcstDate", digits.substring(0, 8));
        if (digits.length() >= 12) {
            row.put("fcstTime", digits.substring(8, 12));
        } else if (digits.length() >= 10) {
            row.put("fcstTime", digits.substring(8, 10) + "00");
        } else {
            row.put("fcstTime", "0000");
        }
        return true;
    }

    private static void putIfNumeric(ObjectNode row, String key, String raw) {
        if (raw == null || raw.isBlank() || "-".equals(raw)) {
            return;
        }
        try {
            if (raw.contains(".")) {
                row.put(key, Double.parseDouble(raw));
            } else {
                row.put(key, Long.parseLong(raw));
            }
        } catch (NumberFormatException ignored) {
            // skip
        }
    }

    private static void putIfInt(ObjectNode row, String key, String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        try {
            row.put(key, Integer.parseInt(raw.trim()));
        } catch (NumberFormatException ignored) {
            // skip
        }
    }
}
