package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Optional;

/**
 * {@code nph-dfs_vsrt_grd} JSON 에서 특정 격자점(nx, ny)의 기온·PTY 를 탐색해 추출.
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class KmaVsrtGrdResponseParser {

    public static boolean isUpstreamError(String raw, ObjectMapper mapper) {
        if (raw == null || raw.isBlank()) {
            return true;
        }
        try {
            JsonNode root = mapper.readTree(raw);
            JsonNode status = root.path("result").path("status");
            if (status.isMissingNode()) {
                return false;
            }
            if (status.isNumber()) {
                return status.intValue() != 0;
            }
            if (status.isTextual()) {
                return !"0".equals(status.asText());
            }
        } catch (Exception e) {
            return true;
        }
        return false;
    }

    public static Optional<VsrtCell> extractCell(String raw, int nx, int ny, ObjectMapper mapper) {
        if (raw == null || raw.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonNode root = mapper.readTree(raw);
            if (isUpstreamError(raw, mapper)) {
                return Optional.empty();
            }
            return dfsMatchGrid(root, nx, ny, 0);
        } catch (Exception e) {
            log.debug("vsrt_grd JSON 파싱 실패: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static Optional<VsrtCell> dfsMatchGrid(JsonNode node, int nx, int ny, int depth) {
        if (depth > 28 || node == null || node.isNull()) {
            return Optional.empty();
        }
        if (node.isObject()) {
            Integer gx = gridX(node);
            Integer gy = gridY(node);
            if (gx != null && gy != null && gx == nx && gy == ny) {
                Double t1h = readTemp(node);
                if (t1h != null) {
                    return Optional.of(new VsrtCell(t1h, readPty(node)));
                }
            }
            var it = node.fields();
            while (it.hasNext()) {
                Optional<VsrtCell> got = dfsMatchGrid(it.next().getValue(), nx, ny, depth + 1);
                if (got.isPresent()) {
                    return got;
                }
            }
        } else if (node.isArray()) {
            for (JsonNode el : node) {
                Optional<VsrtCell> got = dfsMatchGrid(el, nx, ny, depth + 1);
                if (got.isPresent()) {
                    return got;
                }
            }
        }
        return Optional.empty();
    }

    private static Integer gridX(JsonNode o) {
        Integer v = intOrNull(o.get("nx"));
        if (v != null) {
            return v;
        }
        v = intOrNull(o.get("x"));
        return v != null ? v : intOrNull(o.get("X"));
    }

    private static Integer gridY(JsonNode o) {
        Integer v = intOrNull(o.get("ny"));
        if (v != null) {
            return v;
        }
        v = intOrNull(o.get("y"));
        return v != null ? v : intOrNull(o.get("Y"));
    }

    private static Double readTemp(JsonNode o) {
        Double v = doubleOrNull(o.get("T1H"));
        if (v != null) {
            return v;
        }
        v = doubleOrNull(o.get("TMP"));
        return v != null ? v : doubleOrNull(o.get("t1h"));
    }

    private static Integer readPty(JsonNode o) {
        return intOrNull(o.get("PTY"));
    }

    private static Integer intOrNull(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) {
            return null;
        }
        if (n.isInt()) {
            return n.intValue();
        }
        if (n.isNumber()) {
            double d = n.doubleValue();
            return d == Math.floor(d) ? (int) d : null;
        }
        if (n.isTextual()) {
            try {
                return Integer.parseInt(n.asText().replaceAll("[^0-9.-]", ""));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static Double doubleOrNull(JsonNode n) {
        if (n == null || n.isNull() || n.isMissingNode()) {
            return null;
        }
        if (n.isNumber()) {
            return n.doubleValue();
        }
        if (n.isTextual()) {
            try {
                return Double.parseDouble(n.asText().replaceAll("[^0-9.+-]", ""));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    public record VsrtCell(Double t1h, Integer pty) {
    }
}
