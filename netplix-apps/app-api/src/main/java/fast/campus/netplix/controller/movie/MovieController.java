package fast.campus.netplix.controller.movie;

import fast.campus.netplix.authentication.token.JwtTokenProvider;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.movie.DownloadMovieUseCase;
import fast.campus.netplix.movie.FetchMovieUseCase;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.OwnerRecommendUseCase;
import fast.campus.netplix.movie.PromptRecommendUseCase;
import fast.campus.netplix.movie.RagRecommendUseCase;
import fast.campus.netplix.movie.RecommendMovieUseCase;
import fast.campus.netplix.movie.response.ContentTotalsResponse;
import fast.campus.netplix.movie.response.MoviePageableResponse;
import fast.campus.netplix.movie.response.MovieResponse;
import fast.campus.netplix.movie.response.MovieWithRecommendReason;
import fast.campus.netplix.notification.NotificationUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/movie")
@RequiredArgsConstructor
public class MovieController {

    private final JwtTokenProvider jwtTokenProvider;
    private final FetchMovieUseCase fetchMovieUseCase;
    private final DownloadMovieUseCase downloadMovieUseCase;
    private final RecommendMovieUseCase recommendMovieUseCase;
    private final RagRecommendUseCase ragRecommendUseCase;
    private final PromptRecommendUseCase promptRecommendUseCase;
    private final OwnerRecommendUseCase ownerRecommendUseCase;
    private final NotificationUseCase notificationUseCase;

    @PostMapping("/search")
    public NetplixApiResponse<MoviePageableResponse> search(@RequestParam int page) {
        // DB에서 DVD 목록 조회 (매일 새벽 2시 배치로 업데이트됨)
        MoviePageableResponse fetch = fetchMovieUseCase.fetchFromDb(page);
        return NetplixApiResponse.ok(fetch);
    }

    @PostMapping("/playing/search")
    public NetplixApiResponse<MoviePageableResponse> searchMovies(@RequestParam int page) {
        // DB에서 영화 목록 조회 (매일 새벽 2시 30분 배치로 업데이트됨)
        MoviePageableResponse fetch = fetchMovieUseCase.fetchMoviesFromClient(page);
        return NetplixApiResponse.ok(fetch);
    }

    @PostMapping("/keyword/search")
    public NetplixApiResponse<MoviePageableResponse> searchByKeyword(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page) {
        MoviePageableResponse fetch = fetchMovieUseCase.fetchByKeyword(q, page);
        return NetplixApiResponse.ok(fetch);
    }

    /**
     * 카테고리별 영화 조회 (Netflix 스타일)
     * contentType: dvd | movie | all
     * genre: Action, Comedy 등 (파이프로 OR 결합 가능: Mystery|Thriller)
     * filter: korean, classics, new, blockbuster, hidden (특수 필터)
     */
    @PostMapping("/category/search")
    public NetplixApiResponse<MoviePageableResponse> searchByCategory(
            @RequestParam String contentType,
            @RequestParam(required = false) String genre,
            @RequestParam(required = false) String filter,
            @RequestParam(defaultValue = "0") int page) {
        MoviePageableResponse fetch = fetchMovieUseCase.fetchByCategory(contentType, genre, filter, page);
        return NetplixApiResponse.ok(fetch);
    }

    /**
     * DB 기준 영화/DVD 총 편수 (대시보드 총 콘텐츠 수 표시용)
     */
    @GetMapping("/totals")
    public NetplixApiResponse<ContentTotalsResponse> getContentTotals() {
        return NetplixApiResponse.ok(fetchMovieUseCase.getContentTotals());
    }

    @GetMapping("/{movieName}/detail")
    public NetplixApiResponse<NetplixMovie> getMovieDetail(@PathVariable String movieName) {
        NetplixMovie movie = fetchMovieUseCase.findByName(movieName);
        return NetplixApiResponse.ok(movie);
    }

    @PostMapping("/{movieName}/download")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<MovieResponse> download(@PathVariable String movieName) {
        String userId = jwtTokenProvider.getUserId();
        String role = jwtTokenProvider.getRole();
        return NetplixApiResponse.ok(downloadMovieUseCase.download(userId, role, movieName));
    }

    @GetMapping("/recommend")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<List<NetplixMovie>> getRecommendations(
            @RequestParam(defaultValue = "dvd") String contentType,
            @RequestParam(defaultValue = "10") int limit) {
        String userId = jwtTokenProvider.getUserId();
        List<NetplixMovie> recommendations = recommendMovieUseCase.getRecommendedMovies(userId, contentType, limit);
        return NetplixApiResponse.ok(recommendations);
    }

    /**
     * Spring AI RAG 기반 추천: 질의와 유사한 영화를 벡터 검색으로 반환.
     * OpenAI API 키가 설정된 경우에만 동작하며, 미설정 시 빈 목록을 반환한다.
     */
    @GetMapping("/recommend/rag")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<List<NetplixMovie>> getRagRecommendations(
            @RequestParam String q,
            @RequestParam(defaultValue = "movie") String contentType,
            @RequestParam(defaultValue = "10") int limit) {
        List<NetplixMovie> list = ragRecommendUseCase.recommendByQuery(q, contentType, limit);
        return NetplixApiResponse.ok(list);
    }

    /**
     * OpenAI 기반 프롬프트 추천 (질의 + 기분 + 동행).
     * 로그인 없이 호출 가능 (둘러보기 사용자 포함).
     */
    @GetMapping("/recommend/prompt")
    public NetplixApiResponse<List<MovieWithRecommendReason>> getPromptRecommendations(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String mood,
            @RequestParam(required = false) String companion,
            @RequestParam(defaultValue = "movie") String contentType,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) String areaCode) {
        int safeLimit = Math.min(Math.max(limit, 1), 50);
        String safeContentType = "dvd".equalsIgnoreCase(contentType) ? "dvd" : "movie";
        boolean travelMode = "travel".equalsIgnoreCase(mode);
        List<MovieWithRecommendReason> list = promptRecommendUseCase.recommendByPrompt(
                q, mood, companion, safeContentType, safeLimit, travelMode, areaCode);
        // 로그인 사용자면 추천 알림 1건 발송 (첫 번째 추천 작품 기준)
        try {
            String userId = jwtTokenProvider.getUserId();
            if (userId != null && !userId.isEmpty() && !list.isEmpty()) {
                MovieWithRecommendReason first = list.get(0);
                String movieName = first.getMovie().getMovieName();
                notificationUseCase.sendRecommendationNotification(userId, movieName, movieName);
            }
        } catch (Exception ignored) {
            // 비로그인 또는 토큰 없음
        }
        return NetplixApiResponse.ok(list);
    }

    /**
     * 주인장추천: DVD방 사장님 페르소나 + TMDB 트렌딩 RAG 기반 추천.
     * 로그인 없이 호출 가능.
     */
    @GetMapping("/recommend/owner")
    public NetplixApiResponse<List<MovieWithRecommendReason>> getOwnerRecommendations(
            @RequestParam String q,
            @RequestParam(defaultValue = "dvd") String contentType,
            @RequestParam(defaultValue = "15") int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 30);
        String safeContentType = "movie".equalsIgnoreCase(contentType) ? "movie" : "dvd";
        List<MovieWithRecommendReason> list = ownerRecommendUseCase.recommendByOwner(q, safeContentType, safeLimit);
        return NetplixApiResponse.ok(list);
    }
}
