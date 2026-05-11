package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 단기 개황(fct_afs_ds.php, disp=0) 텍스트를 API 응답용 JSON 으로 변환.
 */
public final class KmaAfsDsParser {

    private static final ObjectMapper M = new ObjectMapper();
    private static final Pattern BLOCK_HEAD = Pattern.compile("^\\$0#(\\d+)#");

    private KmaAfsDsParser() {}

    /**
     * 일부 허브 응답은 {@code $0#} 블록 없이 {@code #START7777}…{@code #7777END} 껍데기 안에만
     * 개황 문장을 넣는다. 그 경우에도 앱이 개황을 쓸 수 있도록 최소 {@code afsDs} JSON 을 만든다.
     *
     * @return JSON; 추출할 본문이 없으면 null
     */
    public static String tryBuildJsonFromShellEnvelope(String rawText, int stn, String tmfc1, String tmfc2) {
        if (rawText == null || rawText.isBlank() || rawText.contains("$0#")) {
            return null;
        }
        String norm = rawText.replace("\r\n", "\n").replace('\r', '\n');
        int s = norm.indexOf("#START7777");
        int endMark = norm.indexOf("#7777END");
        if (s < 0 || endMark <= s) {
            return null;
        }
        String mid = norm.substring(s + "#START7777".length(), endMark).strip();
        mid = mid.replaceFirst("(?m)^\\s*단기예보\\s*개황\\s*$", "").strip();
        mid = compactPreview(mid, 8000);
        if (mid.length() < 12) {
            return null;
        }
        try {
            ObjectNode root = M.createObjectNode();
            root.putObject("result").put("status", 0);
            root.put("source", "fct_afs_ds_shell");
            ObjectNode afs = root.putObject("afsDs");
            afs.put("stn", stn);
            afs.put("tmfc1", tmfc1);
            afs.put("tmfc2", tmfc2);
            afs.put("summary", mid);
            return M.writeValueAsString(root);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * @return JSON 문자열; 파싱 실패 시 null
     */
    public static String toForecastJson(String rawText, int targetStn, String tmfc1, String tmfc2) {
        if (rawText == null || rawText.isBlank()) {
            return null;
        }
        String norm = rawText.replace("\r\n", "\n").replace('\r', '\n');
        ParsedBlock match = extractBlock(norm, targetStn);
        if (match == null) {
            return null;
        }
        try {
            ObjectNode root = M.createObjectNode();
            root.putObject("result").put("status", 0);
            root.put("source", "fct_afs_ds");
            ObjectNode afs = root.putObject("afsDs");
            afs.put("stn", match.stn());
            afs.put("tmfc1", tmfc1);
            afs.put("tmfc2", tmfc2);
            if (match.issueTime() != null) {
                afs.put("issueTime", match.issueTime());
            }
            ArrayNode sections = afs.putArray("sections");
            int i = 1;
            for (String t : match.sectionTexts()) {
                if (t == null || t.isBlank()) {
                    continue;
                }
                ObjectNode sec = sections.addObject();
                sec.put("period", i++);
                sec.put("text", compactPreview(t, 4000));
            }
            String summary = buildSummary(match.sectionTexts());
            if (!summary.isBlank()) {
                afs.put("summary", summary);
            }
            return M.writeValueAsString(root);
        } catch (Exception e) {
            return null;
        }
    }

    private static ParsedBlock extractBlock(String norm, int targetStn) {
        List<Integer> idx = new ArrayList<>();
        int p = 0;
        while (true) {
            int i = norm.indexOf("$0#", p);
            if (i < 0) {
                break;
            }
            idx.add(i);
            p = i + 3;
        }
        if (idx.isEmpty()) {
            return null;
        }
        ParsedBlock fallback = null;
        for (int s = 0; s < idx.size(); s++) {
            int start = idx.get(s);
            int end = (s + 1 < idx.size()) ? idx.get(s + 1) : norm.length();
            String chunk = norm.substring(start, end);
            ParsedBlock b = parseChunk(chunk);
            if (b == null) {
                continue;
            }
            if (b.stn() == targetStn) {
                return b;
            }
            if (fallback == null) {
                fallback = b;
            }
        }
        return fallback;
    }

    private static ParsedBlock parseChunk(String chunk) {
        Matcher mh = BLOCK_HEAD.matcher(chunk);
        if (!mh.find() || mh.start() != 0) {
            return null;
        }
        int stn = Integer.parseInt(mh.group(1));
        int lf = chunk.indexOf('\n');
        String headLine = lf > 0 ? chunk.substring(0, lf) : chunk;
        String issueTime = extractIssueTime(headLine);
        String rest = lf > 0 ? chunk.substring(lf + 1) : "";
        List<String> texts = extractSections(rest);
        if (texts.stream().allMatch(x -> x == null || x.isBlank())) {
            return null;
        }
        return new ParsedBlock(stn, issueTime, texts);
    }

    private static List<String> extractSections(String rest) {
        List<String> out = new ArrayList<>();
        int[] slots = {1, 2, 3};
        for (int i = 0; i < slots.length; i++) {
            String m = "$" + slots[i] + "#";
            int s = rest.indexOf(m);
            if (s < 0) {
                out.add("");
                continue;
            }
            int c0 = s + m.length();
            int c1 = rest.length();
            for (int j = i + 1; j < slots.length; j++) {
                String m2 = "$" + slots[j] + "#";
                int t = rest.indexOf(m2, c0);
                if (t >= 0 && t < c1) {
                    c1 = t;
                }
            }
            int t0 = rest.indexOf("$0#", c0);
            if (t0 >= 0 && t0 < c1) {
                c1 = t0;
            }
            out.add(trimSection(rest.substring(c0, c1)));
        }
        return out;
    }

    private static String extractIssueTime(String headLine) {
        String[] parts = headLine.split("#", 8);
        if (parts.length > 2 && parts[2].matches("\\d{12}")) {
            return parts[2];
        }
        return null;
    }

    private static String trimSection(String raw) {
        String t = raw.stripLeading();
        if (t.endsWith("#")) {
            t = t.substring(0, t.length() - 1).stripTrailing();
        }
        int nl = t.lastIndexOf('\n');
        if (nl >= 0 && t.substring(nl).strip().equals("=")) {
            t = t.substring(0, nl).stripTrailing();
        } else if (t.endsWith("=")) {
            t = t.substring(0, t.length() - 1).stripTrailing();
        }
        return t.strip();
    }

    private static String buildSummary(List<String> texts) {
        StringBuilder sb = new StringBuilder();
        for (String t : texts) {
            if (t == null || t.isBlank()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(compactPreview(t, 420));
            if (sb.length() > 520) {
                break;
            }
        }
        if (sb.length() > 560) {
            return sb.substring(0, 557) + "…";
        }
        return sb.toString().trim();
    }

    private static String compactPreview(String s, int max) {
        String one = s.replaceAll("\\s+", " ").trim();
        if (one.length() > max) {
            return one.substring(0, max - 1) + "…";
        }
        return one;
    }

    private record ParsedBlock(int stn, String issueTime, List<String> sectionTexts) {}
}
