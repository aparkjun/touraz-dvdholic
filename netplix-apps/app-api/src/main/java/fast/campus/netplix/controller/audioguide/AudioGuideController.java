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

import java.util.List;
import java.util.Locale;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) 공용 조회 API.
 *
 * <p>퍼블릭 엔드포인트:
 * <ul>
 *   <li>GET /api/v1/audio-guide?type=theme|story&lang=ko|en&limit= - 전체</li>
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

    @GetMapping
    public NetplixApiResponse<List<AudioGuideItemResponse>> list(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam(defaultValue = "24") int limit) {
        List<AudioGuideItemResponse> body = useCase.all(parseType(type), lang, limit).stream()
                .map(AudioGuideItemResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<AudioGuideItemResponse>> nearby(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10000") int radius,
            @RequestParam(defaultValue = "50") int limit) {
        List<AudioGuideItemResponse> body = useCase.nearby(parseType(type), lang, lat, lon, radius, limit).stream()
                .map(AudioGuideItemResponse::from).toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<AudioGuideItemResponse>> search(
            @RequestParam(defaultValue = "theme") String type,
            @RequestParam(defaultValue = "ko") String lang,
            @RequestParam String q,
            @RequestParam(defaultValue = "24") int limit) {
        List<AudioGuideItemResponse> body = useCase.byKeyword(parseType(type), lang, q, limit).stream()
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
