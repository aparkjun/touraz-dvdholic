package fast.campus.netplix.cinetrip.autotag;

import fast.campus.netplix.cinetrip.AutoTagCineTripMappingUseCase;
import fast.campus.netplix.cinetrip.LlmMappingPort;
import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.cinetrip.MovieRegionSuggestion;
import fast.campus.netplix.cinetrip.PendingMappingReviewPort;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * LLM 기반 촬영지 자동 태깅 서비스.
 * @see AutoTagCineTripMappingUseCase
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AutoTagCineTripMappingService implements AutoTagCineTripMappingUseCase {

    private static final int PAGE_SIZE = 50;
    private static final int MAX_PAGES = 20;            // 안전 상한 = 1,000편
    private static final int AUTO_APPROVE_THRESHOLD = 3;

    private final PersistenceMoviePort persistenceMoviePort;
    private final MovieRegionMappingPort movieRegionMappingPort;
    private final LlmMappingPort llmMappingPort;
    private final PendingMappingReviewPort pendingMappingReviewPort;

    @Override
    public Result runAll() {
        int scanned = 0;
        int auto = 0;
        int pending = 0;
        int skipped = 0;

        for (int page = 1; page <= MAX_PAGES; page++) {
            List<NetplixMovie> batch = persistenceMoviePort.fetchBy(page, PAGE_SIZE);
            if (batch == null || batch.isEmpty()) break;

            for (NetplixMovie m : batch) {
                scanned++;
                ProcessResult r = process(m);
                auto += r.auto;
                pending += r.pending;
                skipped += r.skipped;
            }
        }
        log.info("[AUTOTAG] 스캔 {} / 자동승인 {} / 대기 {} / 스킵 {}", scanned, auto, pending, skipped);
        return new Result(scanned, auto, pending, skipped);
    }

    @Override
    public Result runOne(String movieName) {
        if (movieName == null || movieName.isBlank()) return new Result(0, 0, 0, 0);
        NetplixMovie m = persistenceMoviePort.findBy(movieName);
        if (m == null) return new Result(0, 0, 0, 0);
        ProcessResult r = process(m);
        return new Result(1, r.auto, r.pending, r.skipped);
    }

    // ---------- 내부 처리 ----------

    private record ProcessResult(int auto, int pending, int skipped) {
        static ProcessResult skip() { return new ProcessResult(0, 0, 1); }
    }

    private ProcessResult process(NetplixMovie m) {
        if (m == null || m.getMovieName() == null || m.getMovieName().isBlank()) return ProcessResult.skip();

        // 증분 — 이미 매핑이 있는 영화는 스킵 (중복 호출 비용 방지)
        List<MovieRegionMapping> existing = movieRegionMappingPort.findByMovieName(m.getMovieName());
        if (existing != null && !existing.isEmpty()) return ProcessResult.skip();

        // 1) 룰 기반 매칭
        List<MovieRegionSuggestion> ruleHits = matchByRule(m);
        // 2) 룰 0건 + 한국영화면 LLM 시도
        List<MovieRegionSuggestion> llmHits = List.of();
        if (ruleHits.isEmpty() && llmMappingPort.isAvailable()) {
            llmHits = llmMappingPort.suggest(m);
        }

        List<MovieRegionSuggestion> all = new ArrayList<>(ruleHits.size() + llmHits.size());
        all.addAll(ruleHits);
        all.addAll(llmHits);
        if (all.isEmpty()) return ProcessResult.skip();

        // area_code 중복 제거 — 룰 매칭 우선
        Map<String, MovieRegionSuggestion> dedup = new LinkedHashMap<>();
        for (MovieRegionSuggestion s : all) {
            dedup.putIfAbsent(s.getAreaCode(), s);
        }

        List<MovieRegionMapping> toUpsert = new ArrayList<>();
        List<MovieRegionSuggestion> toQueue = new ArrayList<>();
        for (MovieRegionSuggestion s : dedup.values()) {
            int conf = s.getConfidence() == null ? 3 : s.getConfidence();
            if (conf >= AUTO_APPROVE_THRESHOLD) {
                toUpsert.add(MovieRegionMapping.builder()
                        .movieName(s.getMovieName())
                        .areaCode(s.getAreaCode())
                        .regionName(s.getRegionName())
                        .mappingType(s.getMappingType())
                        .evidence(s.getEvidence())
                        .confidence(conf)
                        .trendingScore(0.0)  // RecomputeCineTripScoreBatch 가 채움
                        .build());
            } else {
                toQueue.add(s);
            }
        }

        int autoCount = 0;
        if (!toUpsert.isEmpty()) {
            autoCount = movieRegionMappingPort.upsertAll(toUpsert);
        }
        int pendingCount = 0;
        if (!toQueue.isEmpty()) {
            pendingCount = pendingMappingReviewPort.saveAll(toQueue);
        }
        return new ProcessResult(autoCount, pendingCount, 0);
    }

    /**
     * RegionKeywordDictionary 기반 1차 매칭.
     * - overview / movieName / originalTitle / tagline 모두 lower-case 화한 뒤 부분 문자열 일치.
     * - 매칭된 지역은 mappingType=BACKGROUND, confidence=4, evidence="키워드 'xxx' 일치".
     */
    private List<MovieRegionSuggestion> matchByRule(NetplixMovie m) {
        String haystack = buildHaystack(m);
        if (haystack.isEmpty()) return List.of();

        List<MovieRegionSuggestion> hits = new ArrayList<>();
        for (RegionKeywordDictionary.Region r : RegionKeywordDictionary.all().values()) {
            for (String kw : r.keywords()) {
                String needle = kw.toLowerCase(Locale.ROOT);
                if (needle.length() < 2) continue;
                if (haystack.contains(needle)) {
                    hits.add(MovieRegionSuggestion.builder()
                            .movieName(m.getMovieName())
                            .areaCode(r.areaCode())
                            .regionName(r.regionName())
                            .mappingType("BACKGROUND")
                            .evidence("키워드 '" + kw + "' 일치")
                            .confidence(4)
                            .source("RULE")
                            .build());
                    break; // 지역별 첫 히트만
                }
            }
        }
        return hits;
    }

    private String buildHaystack(NetplixMovie m) {
        StringBuilder sb = new StringBuilder(512);
        appendLower(sb, m.getMovieName());
        appendLower(sb, m.getOriginalTitle());
        appendLower(sb, m.getTagline());
        appendLower(sb, m.getOverview());
        return sb.toString();
    }

    private void appendLower(StringBuilder sb, String s) {
        if (s == null || s.isBlank()) return;
        sb.append(' ').append(s.toLowerCase(Locale.ROOT));
    }
}
