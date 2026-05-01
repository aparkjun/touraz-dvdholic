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
 *   <li>GET /api/v1/tour/trekking/courses?brdDiv=DNWW&routeIdx=...&keyword=해운대&limit=48 — 코스 목록</li>
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
            @RequestParam(required = false) String areaCode,
            @RequestParam(defaultValue = "48") int limit) {
        List<DurunubiCourseResponse> body = useCase.courses(brdDiv, routeIdx, keyword, areaCode, limit).stream()
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
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(15_000);
            // 두루누비 WAF 가 기본/비표준 User-Agent 를 차단하므로 일반 브라우저처럼 보이게 요청
            conn.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                            + "Chrome/124.0.0.0 Safari/537.36");
            conn.setRequestProperty("Accept", "application/gpx+xml, application/xml, text/xml, */*;q=0.8");
            conn.setRequestProperty("Accept-Language", "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7");
            conn.setRequestProperty("Referer", "https://www.durunubi.kr/");
            conn.setRequestProperty("Cache-Control", "no-cache");

            int status = conn.getResponseCode();
            if (status / 100 != 2) {
                conn.disconnect();
                log.warn("[DURUNUBI-GPX] 업스트림 비정상 상태 status={} url={}", status, url);
                return ResponseEntity.status(502).build();
            }

            String upstreamCt = conn.getContentType();
            byte[] bytes;
            try (InputStream in = conn.getInputStream()) {
                bytes = in.readAllBytes();
            } finally {
                conn.disconnect();
            }

            // WAF 가 차단 시 Content-Type: text/html 로 짧은 HTML 을 내려주는 케이스 방어
            boolean looksLikeGpx = bytes.length > 200 && startsWithGpx(bytes);
            if (!looksLikeGpx) {
                log.warn("[DURUNUBI-GPX] GPX 가 아닌 응답 감지 contentType={} size={} url={}",
                        upstreamCt, bytes.length, url);
                return ResponseEntity.status(502).build();
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
            return ResponseEntity.status(502).build();
        }
    }

    /**
     * 응답 본문이 실제 GPX(XML) 로 시작하는지 헤더 바이트만 빠르게 스캔.
     * WAF 차단 응답은 보통 {@code <br>} / {@code <html>} / {@code <center>} 로 시작한다.
     */
    private static boolean startsWithGpx(byte[] bytes) {
        int n = Math.min(bytes.length, 512);
        String head = new String(bytes, 0, n, StandardCharsets.UTF_8).trim().toLowerCase();
        if (head.startsWith("\ufeff")) head = head.substring(1);
        return head.startsWith("<?xml") || head.startsWith("<gpx");
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
