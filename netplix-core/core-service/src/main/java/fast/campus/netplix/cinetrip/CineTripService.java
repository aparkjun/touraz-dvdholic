package fast.campus.netplix.cinetrip;

import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexRepositoryPort;
import fast.campus.netplix.tour.TourPhoto;
import fast.campus.netplix.tour.TourPhotoPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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

    // 결과 개수 상한 없음. limit <= 0 이면 전체 반환 (clampLimit 참고).

    private final MovieRegionMappingPort mappingPort;
    private final PersistenceMoviePort moviePort;
    private final TourIndexRepositoryPort tourIndexPort;
    private final CineTripAutoMappingService autoMappingService;
    /** Optional 주입: TourPhotoPort 빈이 없어도 서비스는 정상 기동 (포스터 폴백만 비활성화). */
    @Autowired(required = false)
    private TourPhotoPort tourPhotoPort;

    @Override
    @Cacheable(value = "cineTripCuration", key = "'default:' + #limit")
    public List<CineTripItem> curate(int limit) {
        int safe = clampLimit(limit);
        // limit<=0(전체): JPA Pageable.MAX 를 쓰지 않고 전 행을 같은 정렬로 로드해 영화 단위 큐레이션을 빠짐없이 만든다.
        List<MovieRegionMapping> top = (limit <= 0)
                ? mappingPort.findAllOrderByTrending()
                : mappingPort.findTopTrending((safe > Integer.MAX_VALUE / 3) ? Integer.MAX_VALUE : safe * 3);
        if (top.isEmpty()) return List.of();

        Map<String, List<MovieRegionMapping>> byMovie = groupByMovie(top);
        Map<String, NetplixMovie> movieMap = loadMovies(byMovie.keySet());
        Map<String, TourIndex> tourByArea = loadToursForMappings(top);
        List<String> fallbackPosters = loadFallbackPostersAll(byMovie.size());
        int posterIdx = 0;

        List<CineTripItem> result = new ArrayList<>();
        for (Map.Entry<String, List<MovieRegionMapping>> e : byMovie.entrySet()) {
            NetplixMovie movie = movieMap.get(e.getKey());
            if (movie == null) {
                String fallback = nextPoster(fallbackPosters, posterIdx++);
                movie = stubMovie(e.getKey(), fallback);
            }
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
        List<String> fallbackPosters = loadFallbackPostersForArea(areaCode, byMovie.size());
        int posterIdx = 0;

        List<CineTripItem> result = new ArrayList<>();
        for (Map.Entry<String, List<MovieRegionMapping>> e : byMovie.entrySet()) {
            NetplixMovie movie = movieMap.get(e.getKey());
            if (movie == null) {
                String fallback = nextPoster(fallbackPosters, posterIdx++);
                movie = stubMovie(e.getKey(), fallback);
            }
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
        // 트렌딩 스코어 내림차순 정렬 (스텁 포함 전체 결과)
        result.sort((a, b) -> Double.compare(
                b.getTrendingScore() == null ? 0.0 : b.getTrendingScore(),
                a.getTrendingScore() == null ? 0.0 : a.getTrendingScore()));
        log.info("[CINE-TRIP] curateByRegion area={} -> {}건 (매핑 {}건, 포스터폴백 {}장)",
                areaCode, result.size(), regional.size(), fallbackPosters.size());
        return result;
    }

    @Override
    public List<CineTripItem> getByMovieName(String movieName) {
        if (movieName == null || movieName.isBlank()) return List.of();
        List<MovieRegionMapping> byMovie = mappingPort.findByMovieName(movieName);
        if (byMovie.isEmpty()) return List.of();
        NetplixMovie movie = moviePort.findBy(movieName);
        if (movie == null) {
            String anchorArea = byMovie.get(0).getAreaCode();
            List<String> posters = loadFallbackPostersForArea(anchorArea, 1);
            movie = stubMovie(movieName, nextPoster(posters, 0));
        }
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

    /**
     * TMDB 영화 DB 에 해당 제목이 없을 때 CSV 매핑 정보만으로 구성한 최소 영화 객체.
     * posterPath 가 제공되면 KTO 관광공모전 수상작 이미지로 카드 썸네일을 채운다.
     */
    private NetplixMovie stubMovie(String movieName, String posterPath) {
        return NetplixMovie.builder()
                .movieName(movieName)
                .contentType("movie")
                .posterPath(posterPath)
                .build();
    }

    /**
     * 지역 코드로 KTO 관광공모전 수상작 이미지 URL 을 수집.
     * 1차: 해당 지역 수상작 → 2차(비어있을 때): 전국 수상작 폴백.
     * 대전/광주/세종처럼 KTO 수상작이 없는 광역시도 카드 이미지가 비지 않도록 보장.
     */
    private List<String> loadFallbackPostersForArea(String areaCode, int demand) {
        if (tourPhotoPort == null || demand <= 0) return List.of();
        List<String> regional = List.of();
        if (areaCode != null && !areaCode.isBlank()) {
            try {
                regional = toImageUrls(tourPhotoPort.fetchByAreaCode(areaCode, Math.max(demand, 6)));
            } catch (Exception ex) {
                log.warn("[CINE-TRIP] 지역 포토 폴백 실패 area={} : {}", areaCode, ex.getMessage());
            }
        }
        if (!regional.isEmpty()) return regional;
        // 2차 폴백: 전국 수상작
        try {
            return toImageUrls(tourPhotoPort.fetchAll(Math.max(demand, 12)));
        } catch (Exception ex) {
            log.warn("[CINE-TRIP] 전국 포토 2차 폴백 실패 area={} : {}", areaCode, ex.getMessage());
            return List.of();
        }
    }

    /** 전국 큐레이션용 폴백. areaCode 없는 curate() 경로에서 사용. */
    private List<String> loadFallbackPostersAll(int demand) {
        if (tourPhotoPort == null || demand <= 0) return List.of();
        try {
            List<TourPhoto> photos = tourPhotoPort.fetchAll(Math.max(demand, 12));
            return toImageUrls(photos);
        } catch (Exception ex) {
            log.warn("[CINE-TRIP] 전체 포토 폴백 실패: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<String> toImageUrls(List<TourPhoto> photos) {
        if (photos == null || photos.isEmpty()) return List.of();
        List<String> out = new ArrayList<>(photos.size());
        for (TourPhoto p : photos) {
            String url = p.getImageUrl();
            if (url == null || url.isBlank()) url = p.getThumbnailUrl();
            if (url != null && !url.isBlank()) out.add(url);
        }
        return out;
    }

    /** 주어진 인덱스로 폴백 이미지 라운드로빈 선택. 리스트 비어있으면 null. */
    private String nextPoster(List<String> posters, int idx) {
        if (posters == null || posters.isEmpty()) return null;
        return posters.get(idx % posters.size());
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

    @Override
    public CineTripUseCase.AutoMappingReport runAutoMapping(int maxPerMovie) {
        return autoMappingService.run(maxPerMovie);
    }

    @Override
    public boolean startAutoMappingAsync(int maxPerMovie) {
        return autoMappingService.startAsync(maxPerMovie);
    }

    @Override
    public CineTripUseCase.AutoMappingProgress getAutoMappingProgress() {
        return autoMappingService.progressSnapshot();
    }

    @Override
    public CineTripUseCase.CineTripCatalogStats catalogStats() {
        return new CineTripUseCase.CineTripCatalogStats(
                mappingPort.count(), mappingPort.countDistinctMovieNames());
    }

    @Override
    public List<String> listAllMappedMovieTitles() {
        return mappingPort.findDistinctMovieNamesOrdered();
    }

    private int clampLimit(int limit) {
        // limit <= 0 → 상한 없음(전체 반환).
        if (limit <= 0) return Integer.MAX_VALUE;
        return limit;
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
