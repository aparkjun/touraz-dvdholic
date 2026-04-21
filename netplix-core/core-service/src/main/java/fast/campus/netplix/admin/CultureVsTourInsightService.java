package fast.campus.netplix.admin;

import fast.campus.netplix.dvdstore.DvdStorePort;
import fast.campus.netplix.dvdstore.DvdStoreRegionStat;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CultureVsTourInsightService implements CultureVsTourInsightUseCase {

    private final DvdStorePort dvdStorePort;
    private final TourIndexUseCase tourIndexUseCase;

    @Override
    public List<CultureVsTourRow> getRows() {
        List<DvdStoreRegionStat> dvdStats = safeDvdStats();
        List<TourIndex> tourStats = safeTourStats();

        Map<String, DvdStoreRegionStat> dvdByArea = new HashMap<>();
        for (DvdStoreRegionStat s : dvdStats) {
            if (s.getAreaCode() != null) dvdByArea.put(s.getAreaCode(), s);
        }
        Map<String, TourIndex> tourByArea = new HashMap<>();
        for (TourIndex t : tourStats) {
            if (t.getAreaCode() != null) tourByArea.put(t.getAreaCode(), t);
        }
        Set<String> areas = new LinkedHashSet<>();
        areas.addAll(dvdByArea.keySet());
        areas.addAll(tourByArea.keySet());

        List<CultureVsTourRow> rows = new ArrayList<>(areas.size());
        for (String area : areas) {
            DvdStoreRegionStat d = dvdByArea.get(area);
            TourIndex t = tourByArea.get(area);
            long total = d != null ? d.getTotalCount() : 0L;
            long op = d != null ? d.getOperatingCount() : 0L;
            long cl = d != null ? d.getClosedCount() : 0L;
            Double closureRate = total > 0 ? (double) cl / (double) total : null;
            String regionName = t != null ? t.getRegionName() : null;
            rows.add(CultureVsTourRow.builder()
                    .areaCode(area)
                    .regionName(regionName)
                    .totalStores(total)
                    .operatingStores(op)
                    .closedStores(cl)
                    .closureRate(closureRate)
                    .tourDemandIdx(t != null ? t.getTourDemandIdx() : null)
                    .tourCompetitiveness(t != null ? t.getTourCompetitiveness() : null)
                    .culturalResourceDemand(t != null ? t.getCulturalResourceDemand() : null)
                    .searchVolume(t != null ? t.getSearchVolume() : null)
                    .build());
        }
        rows.sort(Comparator.comparing(CultureVsTourRow::getAreaCode,
                Comparator.nullsLast(Comparator.naturalOrder())));
        return rows;
    }

    private List<DvdStoreRegionStat> safeDvdStats() {
        try {
            return dvdStorePort.aggregateByRegion();
        } catch (Exception e) {
            log.warn("DVD 매장 지역 집계 실패, 빈 목록으로 계속: {}", e.getMessage());
            return List.of();
        }
    }

    private List<TourIndex> safeTourStats() {
        try {
            return tourIndexUseCase.getLatestPerRegion();
        } catch (Exception e) {
            log.warn("관광 지표 스냅샷 조회 실패, 빈 목록으로 계속: {}", e.getMessage());
            return List.of();
        }
    }
}
