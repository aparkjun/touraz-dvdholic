package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * 기상청 API허브 호출 공통 — 비JSON/HTML/빈 응답을 표준 {@code result.status} JSON 으로 바꿔
 * 클라이언트·프록시가 동일 경로로 처리하도록 한다.
 */
public final class KmaHubJson {

    private static final ObjectMapper OM = new ObjectMapper();

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
                return !hubResultStatusIndicatesFailure(r.get("status"));
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * {@code afsDs} 등 유효 페이로드 없이 {@code result.status} 만 실패인 JSON 이면 true — 다음 tmfc/호출을 시도한다.
     */
    static boolean isHubJsonOnlyErrorEnvelope(String body) {
        if (!looksLikeJson(body)) {
            return false;
        }
        try {
            JsonNode root = OM.readTree(body);
            if (root.has("afsDs")) {
                return false;
            }
            JsonNode r = root.get("result");
            if (r != null && r.has("status")) {
                return hubResultStatusIndicatesFailure(r.get("status"));
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 허브 {@code result.status} 가 숫자·문자열 0 이외면 실패로 본다 ({@code "0"}, {@code "00"} 등은 성공).
     */
    public static boolean hubResultStatusIndicatesFailure(JsonNode status) {
        if (status == null || status.isNull() || status.isMissingNode()) {
            return false;
        }
        if (status.isNumber()) {
            return status.intValue() != 0;
        }
        if (status.isTextual()) {
            String s = status.asText().trim();
            if (s.isEmpty() || s.matches("0+")) {
                return false;
            }
            try {
                return Integer.parseInt(s) != 0;
            } catch (NumberFormatException e) {
                return true;
            }
        }
        return true;
    }

    /**
     * 연결·읽기 타임아웃 등 1회 재시도.
     * 허브 격자 일부가 {@code Content-Type: text/plain} 으로 내려오며 {@code body(String.class)} 가 변환 예외를 낼 수 있어
     * 원시 바이트로 읽는다. 응답 헤더 charset·본문 종류에 따라 UTF-8 / EUC-KR 을 고른다 (무조건 UTF-8 만 쓰면 한글 깨짐).
     */
    static String getWithRetry(RestClient client, URI uri) throws Exception {
        try {
            return getBodyDecoded(client, uri);
        } catch (ResourceAccessException e) {
            try {
                Thread.sleep(400);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw e;
            }
            return getBodyDecoded(client, uri);
        }
    }

    private static String getBodyDecoded(RestClient client, URI uri) {
        ResponseEntity<byte[]> res = client.get().uri(uri).retrieve().toEntity(byte[].class);
        byte[] b = res.getBody();
        if (b == null || b.length == 0) {
            return "";
        }
        return decodeBody(b, res.getHeaders());
    }

    /**
     * {@code Content-Type} 의 charset 우선. 없으면 JSON 바이트는 UTF-8 우선 후 파싱 검증,
     * 그 외(text/plain 등)는 UTF-8 에서 U+FFFD 가 나오면 EUC-KR 재시도 (구형 허브 응답).
     */
    private static String decodeBody(byte[] b, HttpHeaders headers) {
        Charset fromHeader = charsetFromContentType(headers);
        if (fromHeader != null) {
            return new String(b, fromHeader);
        }
        MediaType mt = headers.getContentType();
        if (mt != null && mt.getCharset() == null && mt.isMoreSpecific(MediaType.APPLICATION_JSON)) {
            return new String(b, StandardCharsets.UTF_8);
        }
        if (looksLikeJsonBytes(b)) {
            String utf8 = new String(b, StandardCharsets.UTF_8);
            if (jsonParsesCleanly(utf8)) {
                return utf8;
            }
            try {
                Charset euc = Charset.forName("EUC-KR");
                String alt = new String(b, euc);
                if (jsonParsesCleanly(alt)) {
                    return alt;
                }
            } catch (Exception ignored) {
            }
            return utf8;
        }
        String utf8 = new String(b, StandardCharsets.UTF_8);
        if (utf8.indexOf('\uFFFD') < 0) {
            return utf8;
        }
        try {
            return new String(b, Charset.forName("EUC-KR"));
        } catch (Exception e) {
            return utf8;
        }
    }

    private static Charset charsetFromContentType(HttpHeaders headers) {
        MediaType mt = headers.getContentType();
        if (mt == null) {
            return null;
        }
        Charset cs = mt.getCharset();
        return cs;
    }

    private static boolean looksLikeJsonBytes(byte[] b) {
        int i = 0;
        if (b.length >= 3
                && (b[0] & 0xFF) == 0xEF
                && (b[1] & 0xFF) == 0xBB
                && (b[2] & 0xFF) == 0xBF) {
            i = 3;
        }
        while (i < b.length && (b[i] == ' ' || b[i] == '\n' || b[i] == '\r' || b[i] == '\t')) {
            i++;
        }
        return i < b.length && (b[i] == '{' || b[i] == '[');
    }

    private static boolean jsonParsesCleanly(String s) {
        if (s == null || s.isBlank()) {
            return false;
        }
        try {
            OM.readTree(s);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
