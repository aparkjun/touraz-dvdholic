package fast.campus.netplix.movie;

import fast.campus.netplix.movie.download.UserMovieDownloadRoleValidator;
import fast.campus.netplix.movie.response.ContentTotalsResponse;
import fast.campus.netplix.movie.response.MoviePageableResponse;
import fast.campus.netplix.movie.response.MovieResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class MovieService implements FetchMovieUseCase, InsertMovieUseCase, DownloadMovieUseCase {

    private final List<UserMovieDownloadRoleValidator> userMovieDownloadRoleValidators;
    private final DownloadMoviePort downloadMoviePort;
    private final TmdbMoviePort tmdbMoviePort;
    private final TmdbMoviePlayingPort tmdbMoviePlayingPort;
    private final PersistenceMoviePort persistenceMoviePort;

    private static final int PAGE_SIZE = 10;

    @Override
    public MoviePageableResponse fetchFromClient(int page) {
        NetplixPageableMovies movies = tmdbMoviePort.fetchPageable(page);
        List<NetplixMovie> limited = movies.getNetplixMovies().size() > PAGE_SIZE
            ? movies.getNetplixMovies().subList(0, PAGE_SIZE)
            : movies.getNetplixMovies();
        return new MoviePageableResponse(limited, page, movies.isHasNext());
    }

    @Override
    public MoviePageableResponse fetchPlayingFromClient(int page) {
        NetplixPageableMovies playing = tmdbMoviePlayingPort.fetchPageable(page);
        List<NetplixMovie> limited = playing.getNetplixMovies().size() > PAGE_SIZE
            ? playing.getNetplixMovies().subList(0, PAGE_SIZE)
            : playing.getNetplixMovies();
        return new MoviePageableResponse(limited, page, playing.isHasNext());
    }

    @Override
    public MoviePageableResponse fetchFromDb(int page) {
        List<NetplixMovie> netplixMovies = persistenceMoviePort.fetchByContentType("dvd", page, PAGE_SIZE + 1);
        boolean hasNext = netplixMovies.size() > PAGE_SIZE;
        List<NetplixMovie> resultMovies = hasNext ? netplixMovies.subList(0, PAGE_SIZE) : netplixMovies;
        return new MoviePageableResponse(resultMovies, page, hasNext);
    }

    @Override
    public MoviePageableResponse fetchMoviesFromClient(int page) {
        List<NetplixMovie> netplixMovies = persistenceMoviePort.fetchByContentType("movie", page, PAGE_SIZE + 1);
        boolean hasNext = netplixMovies.size() > PAGE_SIZE;
        List<NetplixMovie> resultMovies = hasNext ? netplixMovies.subList(0, PAGE_SIZE) : netplixMovies;
        return new MoviePageableResponse(resultMovies, page, hasNext);
    }

    @Override
    public MoviePageableResponse fetchByCategory(String contentType, String genre, int page) {
        List<NetplixMovie> netplixMovies = persistenceMoviePort.fetchByContentTypeAndGenre(
                contentType, genre, page, PAGE_SIZE + 1);
        boolean hasNext = netplixMovies.size() > PAGE_SIZE;
        List<NetplixMovie> resultMovies = hasNext ? netplixMovies.subList(0, PAGE_SIZE) : netplixMovies;
        long totalCount = persistenceMoviePort.countByContentTypeAndGenre(contentType, genre);
        return new MoviePageableResponse(resultMovies, page, hasNext, totalCount);
    }

    @Override
    public MoviePageableResponse fetchByCategory(String contentType, String genre, String filter, int page) {
        boolean needsAdvanced = (filter != null && !filter.isBlank())
                || "all".equalsIgnoreCase(contentType)
                || (genre != null && genre.contains("|"));
        if (!needsAdvanced) {
            return fetchByCategory(contentType, genre, page);
        }
        List<NetplixMovie> netplixMovies = persistenceMoviePort.fetchAdvanced(
                contentType, genre, filter, page, PAGE_SIZE + 1);
        boolean hasNext = netplixMovies.size() > PAGE_SIZE;
        List<NetplixMovie> resultMovies = hasNext ? netplixMovies.subList(0, PAGE_SIZE) : netplixMovies;
        long totalCount = persistenceMoviePort.countAdvanced(contentType, genre, filter);
        return new MoviePageableResponse(resultMovies, page, hasNext, totalCount);
    }

    @Override
    public ContentTotalsResponse getContentTotals() {
        long movieTotal = persistenceMoviePort.countByContentTypeAndGenre("movie", null);
        long dvdTotal = persistenceMoviePort.countByContentTypeAndGenre("dvd", null);
        return new ContentTotalsResponse(movieTotal, dvdTotal);
    }

    @Override
    public MoviePageableResponse fetchByKeyword(String keyword, int page) {
        List<NetplixMovie> netplixMovies = persistenceMoviePort.fetchByKeyword(keyword, page, PAGE_SIZE + 1);
        boolean hasNext = netplixMovies.size() > PAGE_SIZE;
        List<NetplixMovie> resultMovies = hasNext ? netplixMovies.subList(0, PAGE_SIZE) : netplixMovies;
        return new MoviePageableResponse(resultMovies, page, hasNext);
    }

    @Override
    public void insert(List<NetplixMovie> movies) {
        movies.forEach(persistenceMoviePort::insert);
    }

    @Override
    public MovieResponse download(String userId, String role, String name) {
        long downloadCnt = downloadMoviePort.downloadCntToday(userId);
        boolean validate = userMovieDownloadRoleValidators.stream()
                .filter(validator -> validator.isTarget(role))
                .findFirst()
                .orElseThrow()
                .validate(downloadCnt);

        if (!validate) {
            throw new RuntimeException("No more downloads available today.");
        }

        NetplixMovie netplixMovie = persistenceMoviePort.findBy(name);

        downloadMoviePort.save(UserMovieDownload.newDownload(userId, name));

        return new MovieResponse(netplixMovie.getMovieName(), downloadCnt);
    }

    @Override
    public NetplixMovie findByName(String movieName) {
        return persistenceMoviePort.findBy(movieName);
    }

    @Override
    public NetplixMovie findByNameOrImportTmdb(String movieName, Integer tmdbId) {
        if (movieName != null && !movieName.isBlank()) {
            NetplixMovie existing = persistenceMoviePort.findBy(movieName.trim());
            if (existing != null) {
                return existing;
            }
        }
        if (tmdbId == null || tmdbId <= 0) {
            return null;
        }
        try {
            String preferred = movieName == null ? "" : movieName.trim();
            NetplixMovie imported = tmdbMoviePort.buildFromTmdbId(tmdbId, preferred);
            if (imported == null || imported.getMovieName() == null || imported.getMovieName().isBlank()) {
                return null;
            }
            insert(List.of(imported));
            return persistenceMoviePort.findBy(imported.getMovieName());
        } catch (Exception ex) {
            log.warn("[MOVIE-IMPORT] tmdbId={} name={} err={}", tmdbId, movieName, ex.getMessage());
            return null;
        }
    }
}
