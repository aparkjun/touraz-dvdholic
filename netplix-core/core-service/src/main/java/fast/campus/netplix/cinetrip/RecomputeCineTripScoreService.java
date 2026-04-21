package fast.campus.netplix.cinetrip;

import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MovieRegionMapping 의 trending_score 를 최신 관광 스냅샷 기반으로 재계산한다.
 *
 * 공식 (데모용):
 *   score = 10 * confidence
 *         + 0.30 * tourDemandIdx
 *         + 0.20 * culturalResourceDemand
 *         + 0.15 * tourResourceDemand
 *         + 0.005 * searchVolume
 *   + mappingType bonus (SHOT +5, BACKGROUND +3, THEME +1)
 *
 * 실제 CineTrip 스코어링이 확정되면 가중치/피처만 교체하면 된다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecomputeCineTripScoreService implements RecomputeCineTripScoreUseCase {

    private final MovieRegionMappingPort movieRegionMappingPort;
    private final TourIndexRepositoryPort tourIndexRepositoryPort;

    @Override
    public int recomputeAll() {
        List<MovieRegionMapping> all = movieRegionMappingPort.findAll();
        if (all.isEmpty()) {
            log.warn("[CINETRIP-SCORE] 매핑 0건 - 재계산 스킵");
            return 0;
        }

        Map<String, TourIndex> byArea = indexByArea(tourIndexRepositoryPort.findLatestPerRegion());
        if (byArea.isEmpty()) {
            log.warn("[CINETRIP-SCORE] 최신 관광 스냅샷 0건 - 관광 피처 없이 confidence 기반만 계산");
        }

        List<MovieRegionMapping> updated = new ArrayList<>(all.size());
        for (MovieRegionMapping m : all) {
            TourIndex ti = byArea.get(m.getAreaCode());
            double score = compute(m, ti);
            updated.add(MovieRegionMapping.builder()
                    .id(m.getId())
                    .movieName(m.getMovieName())
                    .areaCode(m.getAreaCode())
                    .regionName(m.getRegionName())
                    .mappingType(m.getMappingType())
                    .evidence(m.getEvidence())
                    .confidence(m.getConfidence())
                    .trendingScore(round2(score))
                    .build());
        }

        int count = movieRegionMappingPort.upsertAll(updated);
        log.info("[CINETRIP-SCORE] 재계산 완료 - {} 건 upsert (최신 스냅샷 지자체 {}개)",
                count, byArea.size());
        return count;
    }

    private Map<String, TourIndex> indexByArea(List<TourIndex> list) {
        Map<String, TourIndex> map = new HashMap<>();
        for (TourIndex ti : list) {
            if (ti.getAreaCode() != null) map.put(ti.getAreaCode(), ti);
        }
        return map;
    }

    private double compute(MovieRegionMapping m, TourIndex ti) {
        int confidence = m.getConfidence() == null ? 3 : m.getConfidence();
        double score = 10.0 * confidence + typeBonus(m.getMappingType());
        if (ti != null) {
            score += 0.30 * nz(ti.getTourDemandIdx())
                   + 0.20 * nz(ti.getCulturalResourceDemand())
                   + 0.15 * nz(ti.getTourResourceDemand())
                   + 0.005 * nz(ti.getSearchVolume());
        }
        return score;
    }

    private double typeBonus(String type) {
        if (type == null) return 0.0;
        return switch (type.toUpperCase()) {
            case "SHOT"       -> 5.0;
            case "BACKGROUND" -> 3.0;
            case "THEME"      -> 1.0;
            default            -> 0.0;
        };
    }

    private double nz(Number n) { return n == null ? 0.0 : n.doubleValue(); }
    private double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
