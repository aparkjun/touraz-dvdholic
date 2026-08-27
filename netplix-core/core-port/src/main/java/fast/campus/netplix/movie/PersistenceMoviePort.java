package fast.campus.netplix.movie;

import java.util.List;

public interface PersistenceMoviePort {
    List<NetplixMovie> fetchBy(int page, int size);

    List<NetplixMovie> fetchByContentType(String contentType, int page, int size);

    List<NetplixMovie> fetchByContentTypeAndGenre(String contentType, String genre, int page, int size);

    List<NetplixMovie> fetchByKeyword(String keyword, int page, int size);

    List<NetplixMovie> fetchByMovieNames(List<String> movieNames);

    NetplixMovie findBy(String movieName);

    String insert(NetplixMovie netplixMovie);

    void updateNepaliCopy(String movieName, String overviewNe, String taglineNe);

    void deleteByContentType(String contentType);

    List<NetplixMovie> fetchByGenresExcludingMovieNames(String contentType, List<String> genres, List<String> excludeMovieNames, int limit);

    long countByContentTypeAndGenre(String contentType, String genre);

    List<NetplixMovie> fetchAdvanced(String contentType, String genre, String filter, int page, int size);

    long countAdvanced(String contentType, String genre, String filter);
}
