package fast.campus.netplix.cinetrip;

import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CineTripService implements CineTripUseCase {

    private static final int MAX_LIMIT = 50;

    private final MovieRegionMappingPort mappingPort;
    private final PersistenceMoviePort moviePort;
    private final TourIndexRepositoryPort tourIndexPort;

    @Override
    @Cacheable(value = "cineTripCuration", key = "'default:' + #limit")
    public List<CineTripItem> curate(int limit) {
        int safe = clampLimit(limit);
        List<MovieRegionMapping> top = mappingPort.findTopTrending(safe * 2);
        if (top.isEmpty()) return List.of();

        Map<String, List<MovieRegionMapping>> byMovie = groupByMovie(top);
        Map<String, NetplixMovie> movieMap = loadMovies(byMovie.keySet());
        Map<String, TourIndex> tourByArea = loadToursForMappings(top);

        List<CineTripItem> result = new ArrayList<>();
        for (Map.Entry<String, List<MovieRegionMapping>> e : byMovie.entrySet()) {
            NetplixMovie movie = movieMap.get(e.getKey());
            if (movie == null) continue;
            List<TourIndex> indices = new ArrayList<>();
            double score = 0.0;
            for (MovieRegionMapping m : e.getValue()) {
                TourIndex ti = tourByArea.get(m.getAreaCode());
                if (ti != null) indices.add(ti);
                if (m.getTrendingScore() != null) score += m.getTrendingScore();
            }
            result.add(CineTripItem.builder()
                    .movie(movie)
                    .mappings(e.getValue())
                    .regionIndices(indices)
                    .trendingScore(score)
                    .build());
            if (result.size() >= safe) break;
        }
        result.sort((a, b) -> Double.compare(
                b.getTrendingScore() == null ? 0.0 : b.getTrendingScore(),
                a.getTrendingScore() == null ? 0.0 : a.getTrendingScore()));
        log.info("[CINE-TRIP] curate limit={} -> {}건", safe, result.size());
        return result;
    }

    @Override
    public List<CineTripItem> curateByRegion(String areaCode, int limit) {
        if (areaCode == null || areaCode.isBlank()) return List.of();
        int safe = clampLimit(limit);
        List<MovieRegionMapping> regional = mappingPort.findByAreaCode(areaCode);
        if (regional.isEmpty()) return List.of();

        Map<String, List<MovieRegionMapping>> byMovie = groupByMovie(regional);
        Map<String, NetplixMovie> movieMap = loadMovies(byMovie.keySet());
        Optional<TourIndex> latest = tourIndexPort.findLatestByAreaCode(areaCode);

        List<CineTripItem> result = new ArrayList<>();
        for (Map.Entry<String, List<MovieRegionMapping>> e : byMovie.entrySet()) {
            NetplixMovie movie = movieMap.get(e.getKey());
            if (movie == null) continue;
            List<TourIndex> indices = latest.map(List::of).orElse(List.of());
            double score = e.getValue().stream()
                    .mapToDouble(m -> m.getTrendingScore() == null ? 0.0 : m.getTrendingScore())
                    .sum();
            result.add(CineTripItem.builder()
                    .movie(movie)
                    .mappings(e.getValue())
                    .regionIndices(indices)
                    .trendingScore(score)
                    .build());
            if (result.size() >= safe) break;
        }
        return result;
    }

    @Override
    public List<CineTripItem> getByMovieName(String movieName) {
        if (movieName == null || movieName.isBlank()) return List.of();
        List<MovieRegionMapping> byMovie = mappingPort.findByMovieName(movieName);
        if (byMovie.isEmpty()) return List.of();
        NetplixMovie movie = moviePort.findBy(movieName);
        if (movie == null) return List.of();
        List<TourIndex> indices = new ArrayList<>();
        for (MovieRegionMapping m : byMovie) {
            tourIndexPort.findLatestByAreaCode(m.getAreaCode()).ifPresent(indices::add);
        }
        double score = byMovie.stream()
                .mapToDouble(m -> m.getTrendingScore() == null ? 0.0 : m.getTrendingScore())
                .sum();
        return List.of(CineTripItem.builder()
                .movie(movie)
                .mappings(byMovie)
                .regionIndices(indices)
                .trendingScore(score)
                .build());
    }

    @Override
    public int upsertMappings(List<MovieRegionMapping> mappings) {
        return mappingPort.upsertAll(mappings);
    }

    @Override
    public int importFromCsv(String csvText) {
        if (csvText == null || csvText.isBlank()) return 0;
        List<MovieRegionMapping> parsed = new ArrayList<>();
        String[] lines = csvText.split("\\r?\\n");
        boolean headerSkipped = false;
        for (String line : lines) {
            if (line == null) continue;
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
            if (!headerSkipped && trimmed.toLowerCase().startsWith("movie_name")) {
                headerSkipped = true;
                continue;
            }
            headerSkipped = true;
            String[] cols = splitCsv(trimmed);
            if (cols.length < 4) continue;
            try {
                parsed.add(MovieRegionMapping.builder()
                        .movieName(cols[0].trim())
                        .areaCode(cols[1].trim())
                        .regionName(cols.length > 2 ? cols[2].trim() : null)
                        .mappingType(cols[3].trim().toUpperCase())
                        .evidence(cols.length > 4 ? cols[4].trim() : null)
                        .confidence(parseInt(cols.length > 5 ? cols[5].trim() : null, 3))
                        .trendingScore(parseDouble(cols.length > 6 ? cols[6].trim() : null, 0.0))
                        .build());
            } catch (Exception ex) {
                log.warn("[CINE-TRIP] CSV 라인 파싱 실패: {} ({})", line, ex.getMessage());
            }
        }
        return mappingPort.upsertAll(parsed);
    }

    @Override
    public long count() {
        return mappingPort.count();
    }

    private int clampLimit(int limit) {
        if (limit <= 0) return 12;
        return Math.min(limit, MAX_LIMIT);
    }

    private Map<String, List<MovieRegionMapping>> groupByMovie(List<MovieRegionMapping> src) {
        Map<String, List<MovieRegionMapping>> out = new HashMap<>();
        for (MovieRegionMapping m : src) {
            out.computeIfAbsent(m.getMovieName(), k -> new ArrayList<>()).add(m);
        }
        return out;
    }

    private Map<String, NetplixMovie> loadMovies(java.util.Set<String> names) {
        if (names.isEmpty()) return Collections.emptyMap();
        List<NetplixMovie> fetched = moviePort.fetchByMovieNames(new ArrayList<>(names));
        Map<String, NetplixMovie> out = new HashMap<>();
        for (NetplixMovie m : fetched) {
            if (m.getMovieName() != null) out.put(m.getMovieName(), m);
        }
        return out;
    }

    private Map<String, TourIndex> loadToursForMappings(List<MovieRegionMapping> mappings) {
        Map<String, TourIndex> out = new HashMap<>();
        for (MovieRegionMapping m : mappings) {
            if (m.getAreaCode() == null || out.containsKey(m.getAreaCode())) continue;
            tourIndexPort.findLatestByAreaCode(m.getAreaCode()).ifPresent(ti -> out.put(m.getAreaCode(), ti));
        }
        return out;
    }

    private String[] splitCsv(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuote = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuote = !inQuote;
                continue;
            }
            if (c == ',' && !inQuote) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out.toArray(new String[0]);
    }

    private int parseInt(String s, int fallback) {
        if (s == null || s.isBlank()) return fallback;
        try { return Integer.parseInt(s); } catch (Exception e) { return fallback; }
    }

    private double parseDouble(String s, double fallback) {
        if (s == null || s.isBlank()) return fallback;
        try { return Double.parseDouble(s); } catch (Exception e) { return fallback; }
    }
}
