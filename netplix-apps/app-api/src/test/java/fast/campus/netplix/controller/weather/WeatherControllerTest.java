package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.kma.KmaShrtGrdSeriesService;
import fast.campus.netplix.kma.KmaShortRegFetchResult;
import fast.campus.netplix.kma.KmaShortRegHttpClient;
import fast.campus.netplix.kma.KmaVsrtGrdHourlyService;
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

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
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
    private KmaShrtGrdSeriesService kmaShrtGrdSeriesService;

    @Mock
    private KmaVsrtGrdHourlyService kmaVsrtGrdHourlyService;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper();
        lenient().when(kmaShortRegHttpClient.isApiKeyConfigured()).thenReturn(true);
        lenient().when(kmaVsrtGrdHourlyService.fetchHourlyForLatLng(anyDouble(), anyDouble(), anyInt())).thenReturn(List.of());
        lenient().when(kmaShrtGrdSeriesService.fetchSeriesForLatLng(anyDouble(), anyDouble(), anyInt())).thenReturn(List.of());
        weatherController = new WeatherController(
                kmaShortRegHttpClient, kmaShrtGrdSeriesService, kmaVsrtGrdHourlyService, objectMapper);
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
    void shortReg_upstream403_usesShrtGrid_whenSeriesEmptyAndLatLngProvided() throws Exception {
        String errBody = "{\"result\":{\"status\":403,\"message\":\"활용신청이 필요한 API 입니다.\"}}";
        when(kmaShortRegHttpClient.fetchWithDiagnostics(any(), any()))
                .thenReturn(new KmaShortRegFetchResult(errBody, null, null, null, 1, 0));

        when(kmaShrtGrdSeriesService.fetchSeriesForLatLng(anyDouble(), anyDouble(), anyInt()))
                .thenReturn(List.of(Map.of("fcstDate", "20240509", "fcstTime", "1200", "TMP", 20)));

        mockMvc.perform(get("/api/v1/weather/short-reg").param("lat", "35.18").param("lng", "129.08"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upstreamError").value(true))
                .andExpect(jsonPath("$.data.upstreamStatus").value(403))
                .andExpect(jsonPath("$.data.series.length()").value(1))
                .andExpect(jsonPath("$.data.series[0].TMP").value(20))
                .andExpect(jsonPath("$.data.shortRegSupplementedByShrtGrid").value(true));
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
