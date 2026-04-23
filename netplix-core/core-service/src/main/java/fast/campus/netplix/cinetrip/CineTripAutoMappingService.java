package fast.campus.netplix.cinetrip;

import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * TMDB 에 이미 enrichment 된 영화 메타 → 한국 지역 자동 매핑 배치.
 *
 * <p>매핑 키 = (movieName, areaCode, mappingType). 자동 생성물은 {@code mappingType="AUTO"} 로
 * 저장해 MANUAL(SHOT/BACKGROUND/THEME) 과 유니크키가 충돌하지 않는다.
 *
 * <p>스코어링:
 * <ul>
 *   <li>제목(movieName/originalTitle/movieNameEn) 매칭: +5 (가장 강함)</li>
 *   <li>tagline/taglineEn 매칭: +2</li>
 *   <li>overview/overviewEn 매칭: +1 (복수 매칭은 max 3)</li>
 *   <li>strongAliases(랜드마크) 매칭: +1 추가 가산</li>
 * </ul>
 * 영화당 상위 {@code maxPerMovie} 개 지역만 저장(기본 3). 임계값 {@code MIN_SCORE} 미만은 버림.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CineTripAutoMappingService {

    /** 이 점수 이상이어야 AUTO 매핑으로 인정. 너무 낮추면 노이즈 폭증. */
    private static final int MIN_SCORE = 3;

    /** 페이징 배치 크기. DB 한번 호출당 처리 건수. */
    private static final int PAGE_SIZE = 200;

    /** 전체 페이지를 무한히 돌지 않도록 상한. (200 * 200 = 40,000편) */
    private static final int MAX_PAGES = 200;

    /** AUTO 매핑에 부여할 trendingScore — MANUAL 시드(0.5~2.0)보다 낮게 둔다. */
    private static final double AUTO_TRENDING_SCORE = 0.2;

    /** AUTO 매핑의 confidence (1~5 스케일 중 최저). MANUAL 기본값 3 보다 낮다. */
    private static final int AUTO_CONFIDENCE = 1;

    /** AUTO 매핑 타입 태그. */
    public static final String MAPPING_TYPE_AUTO = "AUTO";

    private final PersistenceMoviePort moviePort;
    private final MovieRegionMappingPort mappingPort;
    private final AutoMappingProgressHolder progress;

    /**
     * UseCase 에서 호출하는 비동기 진입점.
     * tryStart() 성공 시에만 @Async 백그라운드 실행을 예약하고 true 반환, 이미 실행 중이면 false.
     */
    public boolean startAsync(int maxPerMovie) {
        if (!progress.tryStart()) {
            log.warn("[CINE-TRIP-AUTO] 이미 실행 중이라 새 요청을 무시합니다.");
            return false;
        }
        runAsyncInternal(maxPerMovie);
        return true;
    }

    /** 현재 진행 상태를 UseCase 레벨 DTO 로 변환해 반환. */
    public CineTripUseCase.AutoMappingProgress progressSnapshot() {
        AutoMappingProgressHolder.Snapshot s = progress.snapshot();
        return new CineTripUseCase.AutoMappingProgress(
                toUseCasePhase(s.phase),
                s.scannedMovies,
                s.moviesWithMatch,
                s.generatedMappings,
                s.skippedDueToManual,
                s.totalMappingsAfter,
                s.startedAt != null ? s.startedAt.toString() : null,
                s.finishedAt != null ? s.finishedAt.toString() : null,
                s.errorMessage
        );
    }

    private static CineTripUseCase.AutoMappingPhase toUseCasePhase(AutoMappingProgressHolder.Phase p) {
        switch (p) {
            case RUNNING: return CineTripUseCase.AutoMappingPhase.RUNNING;
            case COMPLETED: return CineTripUseCase.AutoMappingPhase.COMPLETED;
            case FAILED: return CineTripUseCase.AutoMappingPhase.FAILED;
            case IDLE:
            default: return CineTripUseCase.AutoMappingPhase.IDLE;
        }
    }

    /**
     * 실제 @Async 실행 본체. 외부 호출 대신 {@link #startAsync(int)} 를 통해 진입해야
     * tryStart() 락을 우회해 중복 실행되지 않는다. (@Async 는 self-invocation 에서 동작하지 않으므로
     * 외부에서 Spring-managed 빈으로 호출될 때만 프록시가 작동한다.)
     */
    @Async
    public void runAsyncInternal(int maxPerMovie) {
        try {
            run(maxPerMovie);
        } catch (RuntimeException e) {
            log.error("[CINE-TRIP-AUTO] 실행 실패", e);
            progress.markFailed(e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    /**
     * 전체 영화를 스캔해 AUTO 매핑을 생성/업서트한다.
     * 기존 MANUAL 매핑이 존재하는 (movie, area) 조합은 건너뛴다.
     */
    public CineTripUseCase.AutoMappingReport run(int maxPerMovie) {
        int cap = Math.max(1, Math.min(maxPerMovie, 5));

        int scanned = 0;
        int withMatch = 0;
        int generated = 0;
        int skipped = 0;

        Map<String, KoreaRegionDictionary.RegionDef> regions = KoreaRegionDictionary.regions();

        List<MovieRegionMapping> batch = new ArrayList<>();

        for (int page = 0; page < MAX_PAGES; page++) {
            List<NetplixMovie> movies = moviePort.fetchBy(page, PAGE_SIZE);
            if (movies == null || movies.isEmpty()) break;

            for (NetplixMovie movie : movies) {
                scanned++;
                if (movie.getMovieName() == null || movie.getMovieName().isBlank()) continue;

                Map<String, Integer> scores = scoreAllRegions(movie, regions);
                if (scores.isEmpty()) continue;
                withMatch++;

                List<Map.Entry<String, Integer>> topRegions = scores.entrySet().stream()
                        .filter(e -> e.getValue() >= MIN_SCORE)
                        .sorted(Comparator.<Map.Entry<String, Integer>>comparingInt(Map.Entry::getValue).reversed())
                        .limit(cap)
                        .toList();

                if (topRegions.isEmpty()) continue;

                Set<String> manualAreas = loadManualAreas(movie.getMovieName());

                for (Map.Entry<String, Integer> entry : topRegions) {
                    String areaCode = entry.getKey();
                    if (manualAreas.contains(areaCode)) {
                        skipped++;
                        continue;
                    }
                    KoreaRegionDictionary.RegionDef def = regions.get(areaCode);
                    batch.add(MovieRegionMapping.builder()
                            .movieName(movie.getMovieName())
                            .areaCode(areaCode)
                            .regionName(def != null ? def.getRegionName() : null)
                            .mappingType(MAPPING_TYPE_AUTO)
                            .evidence("auto-extracted from TMDB metadata (score=" + entry.getValue() + ")")
                            .confidence(AUTO_CONFIDENCE)
                            .trendingScore(AUTO_TRENDING_SCORE)
                            .build());
                }

                // 메모리 절약: 1,000건 쌓이면 중간 flush
                if (batch.size() >= 1000) {
                    generated += mappingPort.upsertAll(batch);
                    batch.clear();
                }
            }

            progress.updateProgress(scanned, withMatch, generated, skipped);

            if (movies.size() < PAGE_SIZE) break; // 마지막 페이지
        }

        if (!batch.isEmpty()) {
            generated += mappingPort.upsertAll(batch);
            batch.clear();
        }

        long total = mappingPort.count();
        progress.markCompleted(scanned, withMatch, generated, skipped, total);
        CineTripUseCase.AutoMappingReport report = new CineTripUseCase.AutoMappingReport(
                scanned, withMatch, generated, skipped, total);
        log.info("[CINE-TRIP-AUTO] 완료 scanned={} matched={} generated={} skippedManual={} total={}",
                scanned, withMatch, generated, skipped, total);
        return report;
    }

    /** 영화의 텍스트 코퍼스에 대해 모든 areaCode 별 매칭 점수를 산출. 점수 0 은 맵에 넣지 않음. */
    private Map<String, Integer> scoreAllRegions(NetplixMovie movie,
                                                 Map<String, KoreaRegionDictionary.RegionDef> regions) {
        String titleCorpus = joinNonBlank(movie.getMovieName(), movie.getOriginalTitle(), movie.getMovieNameEn());
        String taglineCorpus = joinNonBlank(movie.getTagline(), movie.getTaglineEn());
        String overviewCorpus = joinNonBlank(movie.getOverview(), movie.getOverviewEn());

        Map<String, Integer> scores = new HashMap<>();
        for (Map.Entry<String, KoreaRegionDictionary.RegionDef> e : regions.entrySet()) {
            KoreaRegionDictionary.RegionDef def = e.getValue();
            int s = 0;

            if (matchesAny(titleCorpus, def)) s += 5;
            if (matchesAny(taglineCorpus, def)) s += 2;
            if (containsHits(overviewCorpus, def) > 0) {
                s += Math.min(3, containsHits(overviewCorpus, def));
            }
            if (matchesStrongAliases(titleCorpus + " " + taglineCorpus + " " + overviewCorpus, def)) {
                s += 1;
            }

            if (s > 0) scores.put(e.getKey(), s);
        }
        return scores;
    }

    /** 한글 aliases contains OR 영문 aliases \b 경계 매칭 — 하나라도 있으면 true. */
    private boolean matchesAny(String text, KoreaRegionDictionary.RegionDef def) {
        if (text == null || text.isEmpty()) return false;
        for (String ha : def.getHangulAliases()) {
            if (text.contains(ha)) return true;
        }
        for (var pat : def.getEnglishPatterns()) {
            if (pat.matcher(text).find()) return true;
        }
        return false;
    }

    /** 랜드마크/부지역명 매칭 (한글은 contains, 영문은 \b 경계). */
    private boolean matchesStrongAliases(String text, KoreaRegionDictionary.RegionDef def) {
        if (text == null || text.isEmpty()) return false;
        for (String a : def.getStrongAliases()) {
            if (a == null || a.isEmpty()) continue;
            if (isAscii(a)) {
                // 단어 경계 매칭
                var pat = java.util.regex.Pattern.compile("\\b" + java.util.regex.Pattern.quote(a) + "\\b",
                        java.util.regex.Pattern.CASE_INSENSITIVE);
                if (pat.matcher(text).find()) return true;
            } else {
                if (text.contains(a)) return true;
            }
        }
        return false;
    }

    private int containsHits(String text, KoreaRegionDictionary.RegionDef def) {
        if (text == null || text.isEmpty()) return 0;
        int count = 0;
        for (String ha : def.getHangulAliases()) {
            int idx = 0;
            while ((idx = text.indexOf(ha, idx)) >= 0) {
                count++;
                idx += ha.length();
                if (count >= 3) return count;
            }
        }
        for (var pat : def.getEnglishPatterns()) {
            var m = pat.matcher(text);
            while (m.find()) {
                count++;
                if (count >= 3) return count;
            }
        }
        return count;
    }

    private boolean isAscii(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) > 127) return false;
        }
        return true;
    }

    private String joinNonBlank(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(p);
        }
        return sb.toString();
    }

    /**
     * 이 영화에 대해 이미 MANUAL 매핑이 존재하는 areaCode 집합.
     * AUTO 타입은 제외하여, 같은 영화-지역에 AUTO 갱신은 허용하되 MANUAL 은 보존한다.
     */
    private Set<String> loadManualAreas(String movieName) {
        List<MovieRegionMapping> existing = mappingPort.findByMovieName(movieName);
        if (existing == null || existing.isEmpty()) return Set.of();
        Set<String> out = new HashSet<>();
        for (MovieRegionMapping m : existing) {
            if (m == null) continue;
            if (MAPPING_TYPE_AUTO.equalsIgnoreCase(m.getMappingType())) continue;
            if (m.getAreaCode() != null) out.add(m.getAreaCode());
        }
        return out;
    }
}
