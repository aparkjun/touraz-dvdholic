package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.kma.KmaFcstZoneInfoHttpClient;
import fast.campus.netplix.kma.KmaShortRegFetchResult;
import fast.campus.netplix.kma.KmaShortRegHttpClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
@DisplayName("기상청 단기예보 프록시 API")
class WeatherControllerTest {

    private MockMvc mockMvc;
    private WeatherController weatherController;

    @Mock
    private KmaShortRegHttpClient kmaShortRegHttpClient;

    @Mock
    private KmaFcstZoneInfoHttpClient kmaFcstZoneInfoHttpClient;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        lenient().when(kmaShortRegHttpClient.isApiKeyConfigured()).thenReturn(true);
        lenient().when(kmaFcstZoneInfoHttpClient.isConfigured()).thenReturn(false);
        weatherController = new WeatherController(kmaShortRegHttpClient, kmaFcstZoneInfoHttpClient, objectMapper);
        ReflectionTestUtils.setField(weatherController, "defaultReg", "11B10101");
        mockMvc = MockMvcBuilders.standaloneSetup(weatherController)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .build();
    }

    @Test
    void shortReg_returnsSeries_whenKmaReturnsOkJson() throws Exception {
        String body = """
                {"result":{"status":0},"response":{"body":{"items":[{"TMP":18,"POP":30,"SKY":"1","PTY":"0","fcstTime":"1200","fcstDate":"20240509"},{"TMP":17,"POP":40,"fcstTime":"1500","fcstDate":"20240509"}]}}}
                """;
        when(kmaShortRegHttpClient.fetchWithDiagnostics(eq("11B10101"), any()))
                .thenReturn(new KmaShortRegFetchResult(body, null, null, null, 1, 0));

        mockMvc.perform(get("/api/v1/weather/short-reg"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.configured").value(true))
                .andExpect(jsonPath("$.data.reg").value("11B10101"))
                .andExpect(jsonPath("$.data.series.length()").value(2))
                .andExpect(jsonPath("$.data.series[0].TMP").exists());
    }

    @Test
    void shortReg_upstream403_whenKmaRejects() throws Exception {
        String body = "{\"result\":{\"status\":403,\"message\":\"활용신청이 필요한 API 입니다.\"}}";
        when(kmaShortRegHttpClient.fetchWithDiagnostics(eq("11B10101"), any()))
                .thenReturn(new KmaShortRegFetchResult(body, null, null, null, 1, 0));

        mockMvc.perform(get("/api/v1/weather/short-reg"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upstreamError").value(true))
                .andExpect(jsonPath("$.data.upstreamStatus").value(403));
    }

    @Test
    void shortReg_upstream403_noGridSupplement_whenLatLngProvided() throws Exception {
        String errBody = "{\"result\":{\"status\":403,\"message\":\"활용신청이 필요한 API 입니다.\"}}";
        when(kmaShortRegHttpClient.fetchWithDiagnostics(any(), any()))
                .thenReturn(new KmaShortRegFetchResult(errBody, null, null, null, 1, 0));

        mockMvc.perform(get("/api/v1/weather/short-reg").param("lat", "35.18").param("lng", "129.08"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upstreamError").value(true))
                .andExpect(jsonPath("$.data.upstreamStatus").value(403))
                .andExpect(jsonPath("$.data.shortRegSupplementedByShrtGrid").doesNotExist());
    }

    @Test
    void fcstZone_returnsItems_whenHubReturnsXml() throws Exception {
        String xml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?><response><header><resultCode>00</resultCode>"
                        + "<resultMsg>NORMAL_SERVICE</resultMsg></header><body><items><item>"
                        + "<regId>11A00101</regId><regName>백령도</regName></item></items>"
                        + "<pageNo>1</pageNo><totalCount>1</totalCount></body></response>";
        when(kmaFcstZoneInfoHttpClient.isConfigured()).thenReturn(true);
        when(kmaFcstZoneInfoHttpClient.fetchGetFcstZoneCdXml(eq("11A00101"), eq(1), eq(10)))
                .thenReturn(xml);

        mockMvc.perform(get("/api/v1/weather/fcst-zone").param("regId", "11A00101"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.resultCode").value("00"))
                .andExpect(jsonPath("$.data.items[0].regId").value("11A00101"))
                .andExpect(jsonPath("$.data.items[0].regName").value("백령도"));
    }

    @Test
    void shortReg_usesNearestReg_whenLatLngProvided() throws Exception {
        when(kmaShortRegHttpClient.fetchWithDiagnostics(eq("11H20201"), any()))
                .thenReturn(
                        new KmaShortRegFetchResult(
                                "{\"result\":{\"status\":0},\"row\":[{\"TMP\":22,\"POP\":10,\"fcstTime\":\"0900\"}]}",
                                null,
                                null,
                                null,
                                1,
                                0));

        mockMvc.perform(get("/api/v1/weather/short-reg")
                        .param("lat", "35.18")
                        .param("lng", "129.08"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reg").value("11H20201"))
                .andExpect(jsonPath("$.data.regFromGeo").value(true))
                .andExpect(jsonPath("$.data.regLabel").value("부산"));
    }
}
