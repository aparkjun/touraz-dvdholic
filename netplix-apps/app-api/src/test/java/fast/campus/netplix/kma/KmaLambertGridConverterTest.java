package fast.campus.netplix.kma;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("기상청 동네예보 격자 변환")
class KmaLambertGridConverterTest {

    @Test
    void gangnamApproximateGrid() {
        int[] g = KmaLambertGridConverter.toGrid(37.498, 127.028);
        assertThat(g[0]).isBetween(58, 64);
        assertThat(g[1]).isBetween(124, 130);
    }

    @Test
    void busanApproximateGrid() {
        int[] g = KmaLambertGridConverter.toGrid(35.179, 129.075);
        assertThat(g[0]).isBetween(94, 102);
        assertThat(g[1]).isBetween(72, 78);
    }
}
