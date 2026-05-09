package fast.campus.netplix.kma;

import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.net.URI;

/**
 * 기상청 API허브 호출 공통 — 비JSON/HTML/빈 응답을 표준 {@code result.status} JSON 으로 바꿔
 * 클라이언트·프록시가 동일 경로로 처리하도록 한다.
 */
final class KmaHubJson {

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

    /** 연결·읽기 타임아웃 등 1회 재시도 */
    static String getWithRetry(RestClient client, URI uri) throws Exception {
        try {
            return client.get().uri(uri).retrieve().body(String.class);
        } catch (ResourceAccessException e) {
            try {
                Thread.sleep(400);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return client.get().uri(uri).retrieve().body(String.class);
        }
    }
}
