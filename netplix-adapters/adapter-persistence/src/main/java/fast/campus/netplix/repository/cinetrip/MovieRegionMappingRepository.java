package fast.campus.netplix.repository.cinetrip;

import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.entity.cinetrip.MovieRegionMappingEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MovieRegionMappingRepository implements MovieRegionMappingPort {

    private final MovieRegionMappingJpaRepository jpa;

    @Override
    @Transactional
    public int upsertAll(List<MovieRegionMapping> mappings) {
        if (mappings == null || mappings.isEmpty()) return 0;
        int count = 0;
        for (MovieRegionMapping m : mappings) {
            if (m.getMovieName() == null || m.getAreaCode() == null || m.getMappingType() == null) continue;
            Optional<MovieRegionMappingEntity> existing = jpa.findByMovieNameAndAreaCodeAndMappingType(
                    m.getMovieName(), m.getAreaCode(), m.getMappingType());
            if (existing.isPresent()) {
                existing.get().updateFrom(m);
            } else {
                jpa.save(MovieRegionMappingEntity.fromDomain(m));
            }
            count++;
        }
        return count;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MovieRegionMapping> findByMovieName(String movieName) {
        return jpa.findByMovieName(movieName).stream().map(MovieRegionMappingEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MovieRegionMapping> findByAreaCode(String areaCode) {
        return jpa.findByAreaCode(areaCode).stream().map(MovieRegionMappingEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MovieRegionMapping> findTopTrending(int limit) {
        // 내부 상한 1000 (CineTripService 쪽 MAX_LIMIT 과 여유있게 정렬)
        int safe = Math.max(1, Math.min(limit, 1000));
        return jpa.findTopTrending(PageRequest.of(0, safe))
                .stream().map(MovieRegionMappingEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<MovieRegionMapping> findAll() {
        return jpa.findAll().stream().map(MovieRegionMappingEntity::toDomain).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long count() {
        return jpa.count();
    }
}
