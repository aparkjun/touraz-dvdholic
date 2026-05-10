package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KmaFctAfsDlParserTest {

    private static final ObjectMapper M = new ObjectMapper();

    @Test
    void tabularTextToSeriesJson_extractsRowsForReg() throws Exception {
        String line =
                "11H20201 202605101700 202605101800 1 0 155 0 0 0 0 0 0 18 30 1 0 text a b";
        String json = KmaFctAfsDlParser.tabularTextToSeriesJson("header\n" + line, "11H20201");
        assertThat(json).isNotNull();
        JsonNode root = M.readTree(json);
        assertThat(root.path("result").path("status").asInt()).isEqualTo(0);
        List<Map<String, Object>> rows = KmaForecastSeriesExtractor.extractRows(root);
        assertThat(rows).isNotEmpty();
        assertThat(rows.get(0)).containsEntry("fcstDate", "20260510");
        assertThat(rows.get(0)).containsEntry("fcstTime", "1800");
        assertThat(rows.get(0).get("TMP")).isNotNull();
    }
}
