package fast.campus.netplix.repository.movie;

import fast.campus.netplix.entity.movie.MovieEntity;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Repository
@RequiredArgsConstructor
public class MovieRepository implements PersistenceMoviePort {

    private final MovieJpaRepository movieJpaRepository;

    @Override
    @Transactional
    public List<NetplixMovie> fetchBy(int page, int size) {
        return movieJpaRepository.search(PageRequest.of(page, size)).stream().map(MovieEntity::toDomain).toList();
    }

    @Override
    @Transactional
    public List<NetplixMovie> fetchByContentType(String contentType, int page, int size) {
        return movieJpaRepository.searchByContentType(contentType, PageRequest.of(page, size))
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional
    public List<NetplixMovie> fetchByContentTypeAndGenre(String contentType, String genre, int page, int size) {
        return movieJpaRepository.searchByContentTypeAndGenre(contentType, genre, PageRequest.of(page, size))
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NetplixMovie> fetchByKeyword(String keyword, int page, int size) {
        return movieJpaRepository.searchByKeyword(keyword, PageRequest.of(page, size))
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<NetplixMovie> fetchByMovieNames(List<String> movieNames) {
        if (movieNames == null || movieNames.isEmpty()) return List.of();
        return movieJpaRepository.findByMovieNameIn(movieNames)
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    public NetplixMovie findBy(String movieName) {
        return movieJpaRepository.findByMovieName(movieName)
                .map(MovieEntity::toDomain)
                .orElseThrow();
    }

    @Override
    @Transactional
    public String insert(NetplixMovie netplixMovie) {
        MovieEntity entity = MovieEntity.toEntity(netplixMovie);
        Optional<MovieEntity> byMovieName = movieJpaRepository.findByMovieName(netplixMovie.getMovieName());

        if (byMovieName.isEmpty()) {
            log.info("Adding new movie: {}", netplixMovie.getMovieName());
            movieJpaRepository.save(entity);
            return entity.getMovieId();
        } else {
            MovieEntity existingEntity = byMovieName.get();
            
            // Skip if detailed info already exists
            if (existingEntity.getCast() != null && existingEntity.getDirector() != null) {
                log.info("Skipping movie (already has details): {}", netplixMovie.getMovieName());
                return existingEntity.getMovieId();
            }
            
            log.info("Updating existing movie: {}", netplixMovie.getMovieName());

            // 기존 firstSeenAt 을 보존하여 재삽입 (업데이트 경로에서도 NEW 판정 안정성 유지)
            if (existingEntity.getFirstSeenAt() != null) {
                entity.setFirstSeenAt(existingEntity.getFirstSeenAt());
            }

            // Delete old and insert new to ensure all fields are updated
            movieJpaRepository.delete(existingEntity);
            movieJpaRepository.flush();
            movieJpaRepository.save(entity);
            return entity.getMovieId();
        }
    }

    @Override
    @Transactional
    public void deleteByContentType(String contentType) {
        log.info("Deleting all movies with contentType: {}", contentType);
        movieJpaRepository.deleteByContentType(contentType);
        movieJpaRepository.flush();
        log.info("Deleted all movies with contentType: {}", contentType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NetplixMovie> fetchByGenresExcludingMovieNames(String contentType, List<String> genres, List<String> excludeMovieNames, int limit) {
        return movieJpaRepository.findByGenresExcludingMovieNames(contentType, genres, excludeMovieNames, limit)
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countByContentTypeAndGenre(String contentType, String genre) {
        return movieJpaRepository.countByContentTypeAndGenre(contentType, genre);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NetplixMovie> fetchAdvanced(String contentType, String genre, String filter, int page, int size) {
        return movieJpaRepository.searchAdvanced(contentType, genre, filter, PageRequest.of(page, size))
                .stream()
                .map(MovieEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countAdvanced(String contentType, String genre, String filter) {
        return movieJpaRepository.countAdvanced(contentType, genre, filter);
    }
}
