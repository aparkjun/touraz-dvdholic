package fast.campus.netplix.controller.audioguide;

import fast.campus.netplix.audioguide.AudioGuideItem;
import fast.campus.netplix.audioguide.GetAudioGuideItemsUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트:
 * <ul>
 *   <li>GET /api/v1/audio-guide/meta - Odii 키 설정 여부·표본 건수(원인 안내, 키 미노출)</li>
 *   <li>GET /api/v1/audio-guide?type=theme|story&lang=ko|en|zh|ja&limit= - 전체</li>
 *   <li>GET /api/v1/audio-guide/nearby?type=&lang=&lat=&lon=&radius=&limit= - 좌표 주변</li>
 *   <li>GET /api/v1/audio-guide/search?type=&lang=&q=&limit= - 키워드 검색</li>
 * </ul>
 *
 * <p>type 미지정 시 theme 로 간주. lang 미지정 시 ko. 키 미승인/쿼터 초과 시 어댑터가 빈 리스트 반환.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/audio-guide")
@RequiredArgsConstructor
public class AudioGuideController {

    private final GetAudioGuideItemsUseCase useCase;

    /** Odii 키·표본 건수 — 목록 0건일 때 원인 구분 (키 값은 내려가지 않음) */
    @GetMapping("/meta")
    public NetplixApiResponse<Map<String, Object>> meta() {
        var m = useCase.odiiMeta();
        Map<String, Object> body = new HashMap<>();
        body.put("odiiApiKeyConfigured", m.odiiApiKeyConfigured());
        body.put("themeKoSampleCount", m.themeKoSampleCount());
        return NetplixApiResponse.ok(body);
    }

    @GetMapping
    public NetplixApiResponse<List<AudioGuideItemResponse>> list(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(defaultValue = "true") boolean lite) {
        List<AudioGuideItemResponse> body = useCase.all(parseType(type), lang, limit).stream()
                .map(i -> AudioGuideItemResponse.from(i, lite)).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<AudioGuideItemResponse>> nearby(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10000") int radius,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "true") boolean lite) {
        List<AudioGuideItemResponse> body = useCase.nearby(parseType(type), lang, lat, lon, radius, limit).stream()
                .map(i -> AudioGuideItemResponse.from(i, lite)).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<AudioGuideItemResponse>> search(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam String q,
            @RequestParam(defaultValue = "24") int limit,
            @RequestParam(defaultValue = "true") boolean lite) {
        List<AudioGuideItemResponse> body = useCase.byKeyword(parseType(type), lang, q, limit).stream()
                .map(i -> AudioGuideItemResponse.from(i, lite)).toList();
        return NetplixApiResponse.ok(body);
    }

    /**
     * 단일 아이템 상세 조회 — description(해설 대본) 포함 풀 응답.
     *
     * <p>리스트는 응답 크기 절감을 위해 기본 lite 모드(description 제외)로 내려가므로,
     * 모달 등 상세 UI 에서 이 엔드포인트로 script 를 보강한다.
     * 내부적으로 어댑터 캐시에서 id 로 찾으므로 추가 외부 호출은 발생하지 않는다.
     */
    @GetMapping("/detail")
    public NetplixApiResponse<AudioGuideItemResponse> detail(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam String id) {
        AudioGuideItem.Type t = parseType(type);
        String target = id == null ? "" : id.trim();
        // 캐시된 전체 리스트에서 id 매칭 탐색. limit=0 → 무제한(캐시 전체).
        AudioGuideItemResponse found = useCase.all(t, lang, 0).stream()
                .filter(i -> target.equals(i.getId()))
                .findFirst()
                .map(i -> AudioGuideItemResponse.from(i, false))
                .orElse(null);
        return NetplixApiResponse.ok(found);
    }

    /**
     * 특정 관광지(THEME)에 연결된 해설 이야기(STORY) 목록 조회.
     *
     * <p>Odii API 특성상 THEME 응답에는 해설 대본(script)이 없고, 각 STORY 가 tid 로 THEME 과
     * 연결된다. 프런트 모달에서 THEME 카드 클릭 시 이 엔드포인트로 연관 이야기들을 불러와
     * 각 스토리를 TTS(Web Speech API)로 재생할 수 있도록 제공한다.
     */
    @GetMapping("/stories-by-theme")
    public NetplixApiResponse<List<AudioGuideItemResponse>> storiesByTheme(
            @RequestParam String themeId,
            @RequestParam(required = false) String themeTitle,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam(defaultValue = "20") int limit) {
        List<AudioGuideItemResponse> body = useCase.storiesByTheme(themeId, themeTitle, lang, limit).stream()
                .map(AudioGuideItemResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    private AudioGuideItem.Type parseType(String raw) {
        if (raw == null) return AudioGuideItem.Type.THEME;
        String n = raw.trim().toLowerCase(Locale.ROOT);
        if ("story".equals(n)) return AudioGuideItem.Type.STORY;
        return AudioGuideItem.Type.THEME;
    }
}
