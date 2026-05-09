package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 기상청 API허브 단기예보 JSON 에서 시계열 행을 최대한 추출 (스키마 변동 대비 깊이 우선 탐색).
 */
public final class KmaForecastSeriesExtractor {

    private KmaForecastSeriesExtractor() {
    }

    public static List<Map<String, Object>> extractRows(JsonNode root) {
        List<Map<String, Object>> found = new ArrayList<>();
        if (root == null || !root.isObject()) {
            return found;
        }
        collectForecastObjects(root, found, 0);
        // 중복 제거: fcstDate+fcstTime+TMP+POP 조합 키
        Map<String, Map<String, Object>> dedup = new LinkedHashMap<>();
        for (Map<String, Object> row : found) {
            String k = String.valueOf(row.getOrDefault("fcstDate", "")) + "|"
                    + String.valueOf(row.getOrDefault("fcstTime", "")) + "|"
                    + String.valueOf(row.getOrDefault("TMX", row.get("TMP"))) + "|"
                    + String.valueOf(row.getOrDefault("POP", ""));
            dedup.putIfAbsent(k, row);
        }
        return new ArrayList<>(dedup.values());
    }

    private static void collectForecastObjects(JsonNode node, List<Map<String, Object>> out, int depth) {
        if (depth > 14 || node == null) {
            return;
        }
        if (node.isObject()) {
            Map<String, Object> asMap = objectToStringMap(node);
            if (scoreForecastRow(asMap) >= 2) {
                out.add(asMap);
            }
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                collectForecastObjects(it.next().getValue(), out, depth + 1);
            }
        } else if (node.isArray()) {
            for (JsonNode el : node) {
                collectForecastObjects(el, out, depth + 1);
            }
        }
    }

    private static Map<String, Object> objectToStringMap(JsonNode obj) {
        Map<String, Object> m = new LinkedHashMap<>();
        obj.fields().forEachRemaining(e -> {
            JsonNode v = e.getValue();
            if (v.isNumber()) {
                m.put(e.getKey(), v.numberValue());
            } else if (v.isTextual()) {
                m.put(e.getKey(), v.asText());
            } else if (v.isBoolean()) {
                m.put(e.getKey(), v.asBoolean());
            }
        });
        return m;
    }

    /** 예보 행으로 보이는 정도 (필드 많을수록 높음) */
    private static int scoreForecastRow(Map<String, Object> m) {
        int s = 0;
        String[] keys = {"TMP", "TMN", "TMX", "POP", "REH", "SKY", "PTY", "PCP", "SNO",
                "WSD", "VEC", "VVV", "UUU", "fcstTime", "fcstDate", "TM", "Rn", "hr3"};
        for (String k : keys) {
            if (m.containsKey(k) && m.get(k) != null && !m.get(k).toString().isBlank()) {
                s++;
            }
        }
        return s;
    }
}
