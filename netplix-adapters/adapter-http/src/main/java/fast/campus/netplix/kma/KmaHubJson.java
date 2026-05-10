package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * 기상청 API허브 호출 공통 — 비JSON/HTML/빈 응답을 표준 {@code result.status} JSON 으로 바꿔
 * 클라이언트·프록시가 동일 경로로 처리하도록 한다.
 */
final class KmaHubJson {

    private static final ObjectMapper OM = new ObjectMapper();
    private static final Charset MS949 = Charset.forName("MS949");

    private KmaHubJson() {}

    static String syntheticResult(int status, String message) {
        return "{\"result\":{\"status\":" + status + ",\"message\":\"" + jsonEscape(message) + "\"}}";
    }

    static String jsonEscape(String s) {
        if (s == null) {
            return "";
        }
        int cap = 480;
        StringBuilder sb = new StringBuilder(Math.min(s.length(), cap + 24));
        for (int i = 0; i < s.length() && sb.length() < cap; i++) {
            char c = s.charAt(i);
            if (c == '\\' || c == '"') {
                sb.append('\\').append(c);
            } else if (c < 0x20) {
                sb.append(' ');
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    static String previewSnippet(String b) {
        if (b == null || b.isEmpty()) {
            return "(empty)";
        }
        String p = (b.length() > 400 ? b.substring(0, 400) + "…" : b).replaceAll("\\s+", " ").trim();
        return p;
    }

    static boolean looksLikeJson(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String t = body.stripLeading();
        return t.startsWith("{") || t.startsWith("[");
    }

    /**
     * {@code result.status==0} 이거나 단기 개황({@code afsDs}) 등 성공 응답인지 — 실패용 합성 JSON({@code status!=0})은 false.
     */
    static boolean isHubSuccessEnvelope(String body) {
        if (!looksLikeJson(body)) {
            return false;
        }
        try {
            JsonNode root = OM.readTree(body);
            if (root.has("afsDs")) {
                return true;
            }
            JsonNode r = root.get("result");
            if (r != null && r.has("status")) {
                return r.get("status").asInt(-1) == 0;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 허브 typ01 텍스트는 EUC-KR/MS949 로 내려오는 경우가 많다. UTF-8 만으로 읽으면 한글·키워드가 깨져
     * {@code 단기예보 개황} 매칭·{@code $0#} 파싱이 실패할 수 있다. JSON 응답은 UTF-8 우선.
     */
    static String decodeKmaHubBody(byte[] raw) {
        if (raw == null || raw.length == 0) {
            return "";
        }
        String asUtf8 = new String(raw, StandardCharsets.UTF_8);
        String head = asUtf8.stripLeading();
        if (head.startsWith("{") || head.startsWith("[")) {
            return asUtf8;
        }
        // 단기 개황·통보문 블록 — UTF-8 로 이미 올 때가 많음. $0# 기준으로 잡히면 UTF-8 유지.
        if (asUtf8.contains("$0#")) {
            return asUtf8;
        }
        String asMs949 = new String(raw, MS949);
        if (countHangulSyllables(asMs949) > countHangulSyllables(asUtf8)) {
            return asMs949;
        }
        return asUtf8;
    }

    private static int countHangulSyllables(String s) {
        if (s == null || s.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                n++;
            }
        }
        return n;
    }

    /** 연결·읽기 타임아웃 등 1회 재시도 */
    static String getWithRetry(RestClient client, URI uri) throws Exception {
        try {
            byte[] raw = client.get().uri(uri).retrieve().body(byte[].class);
            return decodeKmaHubBody(raw);
        } catch (ResourceAccessException e) {
            try {
                Thread.sleep(400);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            byte[] raw = client.get().uri(uri).retrieve().body(byte[].class);
            return decodeKmaHubBody(raw);
        }
    }
}
