package fast.campus.netplix.movie;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetMoviesForRagService implements GetMoviesForRagUseCase {

    private static final int PAGE_SIZE = 50;

    private final PersistenceMoviePort persistenceMoviePort;

    @Override
    public List<NetplixMovie> getMovies(int maxCount) {
        List<NetplixMovie> result = new ArrayList<>();
        int page = 0;
        while (result.size() < maxCount) {
            List<NetplixMovie> pageDvd = safeFetch("dvd", page);
            List<NetplixMovie> pageMovie = safeFetch("movie", page);
            if (pageDvd.isEmpty() && pageMovie.isEmpty()) {
                break;
            }
            for (NetplixMovie m : pageDvd) {
                if (result.size() >= maxCount) break;
                result.add(m);
            }
            for (NetplixMovie m : pageMovie) {
                if (result.size() >= maxCount) break;
                result.add(m);
            }
            page++;
            if (pageDvd.size() < PAGE_SIZE && pageMovie.size() < PAGE_SIZE) {
                break;
            }
        }
        log.info("RAG용 영화 목록 조회: {}편", result.size());
        return result;
    }

    private List<NetplixMovie> safeFetch(String contentType, int page) {
        try {
            return persistenceMoviePort.fetchByContentType(contentType, page, PAGE_SIZE);
        } catch (Exception e) {
            log.warn("[RAG-FETCH] {} page={} 실패: {}", contentType, page, e.getMessage());
            return List.of();
        }
    }
}
