package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.GetDurunubiUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) 걷기여행 공개 API.
 *
 * <p>엔드포인트 (비로그인 노출 가능, SecurityConfig 의 {@code /api/v1/tour/**} permitAll 규칙 적용):
 * <ul>
 *   <li>GET /api/v1/tour/trekking/routes?limit=20 — 길(해파랑/남파랑/서해랑/DMZ 등) 목록</li>
 *   <li>GET /api/v1/tour/trekking/courses?brdDiv=DNWW&routeIdx=...&keyword=해운대&limit=30 — 코스 목록</li>
 *   <li>GET /api/v1/tour/trekking/status — serviceKey 및 URL 설정 여부</li>
 * </ul>
 *
 * <p>TourAPI Guide v4.1 기준 공식 오퍼레이션은 2종({@code courseList}, {@code routeList}) 뿐이며,
 * 각 응답에 GPX 경로·지역·난이도·거리·주요 경유지가 포함되어 상세 카드 렌더링까지 커버된다.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour/trekking")
@RequiredArgsConstructor
public class TrekkingController {

    private final GetDurunubiUseCase useCase;

    @GetMapping("/routes")
    public NetplixApiResponse<List<DurunubiRouteResponse>> routes(
            @RequestParam(defaultValue = "20") int limit) {
        List<DurunubiRouteResponse> body = useCase.routes(limit).stream()
                .map(DurunubiRouteResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/courses")
    public NetplixApiResponse<List<DurunubiCourseResponse>> courses(
            @RequestParam(required = false) String brdDiv,
            @RequestParam(required = false) String routeIdx,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "24") int limit) {
        List<DurunubiCourseResponse> body = useCase.courses(brdDiv, routeIdx, keyword, limit).stream()
                .map(DurunubiCourseResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/status")
    public NetplixApiResponse<StatusResponse> status() {
        return NetplixApiResponse.ok(new StatusResponse(useCase.isConfigured()));
    }

    /**
     * 두루누비 GPX 파일을 서버 사이드에서 프록시하여, 코스명 기반의 제대로 된
     * {@code Content-Disposition} 헤더와 함께 내려준다.
     *
     * <p>두루누비 원본 URL({@code https://www.durunubi.kr/editImgUp.do?filePath=...}) 은
     * Content-Disposition 을 내려주지 않아 브라우저가 모든 코스를 {@code editImgUp.do}
     * 라는 동일한 이름으로 저장/덮어쓰는 문제가 있다. 이 엔드포인트를 경유하면
     * 코스별 개별 파일로 저장된다.</p>
     *
     * <p>SSRF 방지를 위해 외부 호스트는 {@code www.durunubi.kr} 화이트리스트로만 허용한다.</p>
     */
    @GetMapping("/gpx")
    public ResponseEntity<byte[]> downloadGpx(
            @RequestParam("url") String url,
            @RequestParam(value = "name", required = false) String name) {
        if (url == null || url.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().build();
        }
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                || !host.equalsIgnoreCase("www.durunubi.kr")) {
            log.warn("[DURUNUBI-GPX] 허용되지 않은 호스트 차단 host={}", host);
            return ResponseEntity.badRequest().build();
        }

        try {
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(15_000);
            conn.setRequestProperty("User-Agent", "touraz-dvdholic/1.0");
            int status = conn.getResponseCode();
            if (status / 100 != 2) {
                conn.disconnect();
                return ResponseEntity.status(status).build();
            }
            byte[] bytes;
            try (InputStream in = conn.getInputStream()) {
                bytes = in.readAllBytes();
            } finally {
                conn.disconnect();
            }

            String safeBase = sanitizeFilename(name);
            String filename = (safeBase.isBlank() ? "durunubi-course" : safeBase) + ".gpx";
            ContentDisposition disposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentDisposition(disposition);
            headers.setContentType(MediaType.parseMediaType("application/gpx+xml"));
            headers.setCacheControl("public, max-age=3600");
            headers.set("X-Suggested-Filename", URLEncoder.encode(filename, StandardCharsets.UTF_8));

            return ResponseEntity.ok().headers(headers).body(bytes);
        } catch (Exception ex) {
            log.warn("[DURUNUBI-GPX] 프록시 실패 url={} err={}", url, ex.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    private static String sanitizeFilename(String s) {
        if (s == null) return "";
        String trimmed = s.trim();
        if (trimmed.length() > 80) trimmed = trimmed.substring(0, 80);
        return trimmed
                .replace('\\', '_')
                .replace('/', '_')
                .replace(':', '_')
                .replace('*', '_')
                .replace('?', '_')
                .replace('"', '_')
                .replace('<', '_')
                .replace('>', '_')
                .replace('|', '_')
                .trim();
    }

    public record StatusResponse(boolean configured) {}
}
