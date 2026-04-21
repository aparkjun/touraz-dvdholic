package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TourIndexService implements TourIndexUseCase {

    private final VisitKoreaDataLabPort visitKoreaDataLabPort;
    private final TourIndexRepositoryPort tourIndexRepositoryPort;

    @Override
    public int syncFromApi(LocalDate baseDate) {
        if (!visitKoreaDataLabPort.isConfigured()) {
            log.warn("[TOUR-INDEX] VisitKorea 서비스키 미설정 - sync 건너뜀");
            return 0;
        }
        LocalDate target = baseDate != null ? baseDate : LocalDate.now().minusDays(1);
        List<TourIndex> indices = visitKoreaDataLabPort.fetchIndicesForDate(target);
        if (indices.isEmpty()) {
            log.warn("[TOUR-INDEX] 응답 0건 - 저장 생략");
            return 0;
        }
        tourIndexRepositoryPort.upsertAll(indices);
        log.info("[TOUR-INDEX] {} 개 지자체 스냅샷 upsert (baseDate={})", indices.size(), target);
        return indices.size();
    }

    @Override
    @Cacheable(value = "tourIndex:latestPerRegion", unless = "#result == null || #result.isEmpty()")
    public List<TourIndex> getLatestPerRegion() {
        return tourIndexRepositoryPort.findLatestPerRegion();
    }

    @Override
    public Optional<TourIndex> getLatestByAreaCode(String areaCode) {
        return tourIndexRepositoryPort.findLatestByAreaCode(areaCode);
    }

    @Override
    @Cacheable(value = "tourIndex:topSearchVolume", key = "#limit", unless = "#result == null || #result.isEmpty()")
    public List<TourIndex> getTopBySearchVolume(int limit) {
        return tourIndexRepositoryPort.findTopBySearchVolume(limit);
    }
}
