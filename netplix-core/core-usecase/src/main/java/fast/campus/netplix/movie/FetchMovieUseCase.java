package fast.campus.netplix.movie;

import fast.campus.netplix.movie.response.ContentTotalsResponse;
import fast.campus.netplix.movie.response.MoviePageableResponse;

public interface FetchMovieUseCase {
    MoviePageableResponse fetchFromClient(int page);
    MoviePageableResponse fetchPlayingFromClient(int page);
    MoviePageableResponse fetchFromDb(int page);
    MoviePageableResponse fetchMoviesFromClient(int page);
    MoviePageableResponse fetchByCategory(String contentType, String genre, int page);
    MoviePageableResponse fetchByCategory(String contentType, String genre, String filter, int page);
    MoviePageableResponse fetchByKeyword(String keyword, int page);
    ContentTotalsResponse getContentTotals();
    NetplixMovie findByName(String movieName);

    /**
     * DB 에 없고 {@code tmdbId} 가 있으면 TMDB 에서 1회 가져와 저장 후 반환.
     */
    NetplixMovie findByNameOrImportTmdb(String movieName, Integer tmdbId);
}
