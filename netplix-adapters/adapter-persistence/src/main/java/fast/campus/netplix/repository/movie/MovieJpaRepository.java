package fast.campus.netplix.repository.movie;

import fast.campus.netplix.entity.movie.MovieEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MovieJpaRepository extends JpaRepository<MovieEntity, String>, MovieCustomRepository {
    Optional<MovieEntity> findByMovieName(String movieName);

    /**
     * 동일 제목 다수 존재 시 한국어 원어 작품 우선, 평점 내림차순.
     * ex) "괴물" → Bong Joon-ho's The Host (ko) preferred over Carpenter's The Thing (en).
     */
    @Query("SELECT m FROM MovieEntity m WHERE m.movieName = :name " +
            "ORDER BY CASE WHEN m.originalLanguage = 'ko' THEN 0 ELSE 1 END, " +
            "COALESCE(m.voteAverage, 0) DESC")
    List<MovieEntity> findByMovieNamePreferKorean(@Param("name") String name, Pageable pageable);

    void deleteByContentType(String contentType);
}
