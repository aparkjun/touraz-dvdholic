package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("초단기 격자 JSON 파싱")
class KmaVsrtGrdResponseParserTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void extractsT1h_whenNxNyMatch() {
        String raw = """
                {"result":{"status":0},"row":{"nx":61,"ny":126,"T1H":18.5,"PTY":0}}
                """;
        Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = KmaVsrtGrdResponseParser.extractCell(raw, 61, 126, mapper);
        assertThat(cell).isPresent();
        assertThat(cell.get().t1h()).isEqualTo(18.5);
        assertThat(cell.get().pty()).isZero();
    }

    @Test
    void empty_whenStatusNonZero() {
        String raw = "{\"result\":{\"status\":401,\"message\":\"키\"}}";
        assertThat(KmaVsrtGrdResponseParser.extractCell(raw, 61, 126, mapper)).isEmpty();
    }
}
