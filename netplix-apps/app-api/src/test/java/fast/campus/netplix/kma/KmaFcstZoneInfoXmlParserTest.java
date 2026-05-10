package fast.campus.netplix.kma;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class KmaFcstZoneInfoXmlParserTest {

    @Test
    void parsesSampleFcstZoneCdXml() {
        String xml =
                """
                <?xml version="1.0" encoding="UTF-8"?>
                <response><header><resultCode>00</resultCode><resultMsg>NORMAL_SERVICE</resultMsg></header>\
                <body><dataType>XML</dataType><items><item><regId>11A00101</regId>\
                <lat>37.966099</lat><lon>124.630447</lon><regEn>Baengnyeongdo</regEn>\
                <regName>백령도</regName><regSp>C</regSp><regUp>11A00100</regUp><seq>1</seq>\
                <stnF3>102</stnF3><tmEd>210012310000</tmEd><tmSt>201610131800</tmSt>\
                </item></items><numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>1</totalCount>\
                </body></response>\
                """;

        var p = KmaFcstZoneInfoXmlParser.parse(xml);
        assertThat(p).isPresent();
        KmaFcstZoneInfoXmlParser.FcstZoneCdParse d = p.get();
        assertThat(d.isOk()).isTrue();
        assertThat(d.items()).hasSize(1);
        Map<String, Object> row = d.items().get(0);
        assertThat(row.get("regId")).isEqualTo("11A00101");
        assertThat(row.get("regName")).isEqualTo("백령도");
        assertThat(row.get("lat")).isEqualTo(37.966099);
        assertThat(d.totalCount()).isEqualTo(1);
    }
}
