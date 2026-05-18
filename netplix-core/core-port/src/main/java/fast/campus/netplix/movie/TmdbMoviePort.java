package fast.campus.netplix.movie;

public interface TmdbMoviePort {
    NetplixPageableMovies fetchPageable(int page);
    NetplixMovie enrichMovieDetails(NetplixMovie movie, Integer tmdbId);

    /**
     * TMDB 영화 ID 로 메타를 조회·보강한다. DB 미등록 큐레이션(예: Pet-Cinema)용.
     *
     * @param preferredMovieName 카탈로그에 저장할 한글 제목(비어 있으면 TMDB ko 제목 사용)
     */
    NetplixMovie buildFromTmdbId(int tmdbId, String preferredMovieName);
}
