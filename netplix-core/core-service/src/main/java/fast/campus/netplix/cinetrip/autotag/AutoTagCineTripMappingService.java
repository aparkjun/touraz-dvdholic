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
        // 3) 옵션 A — 외국영화 안전망:
        //    TMDB `production_countries` 에 KR 이 포함되어 있거나 spoken_languages 에
        //    한국어가 포함된 외국영화, 또는 overview/title 에 "Korea / Korean / South Korea /
        //    한국" 이 포함된 작품을 낮은 confidence(=2) 로 서울 Pending 후보에 올린다.
        //    confidence<AUTO_APPROVE_THRESHOLD(=3) 이므로 `pending_mapping_reviews` 큐로
        //    들어가 관리자 승인 후 실제 매핑으로 승격.
        List<MovieRegionSuggestion> safetyNet = List.of();
        if (ruleHits.isEmpty() && llmHits.isEmpty()) {
            safetyNet = matchKoreaSafetyNet(m);
        }

        List<MovieRegionSuggestion> all =
                new ArrayList<>(ruleHits.size() + llmHits.size() + safetyNet.size());
        all.addAll(ruleHits);
        all.addAll(llmHits);
        all.addAll(safetyNet);
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

    /**
     * 옵션 A — "한국 배경 외국영화" 안전망.
     * 어떤 광역도 매칭되지 않은 경우에도 다음 중 하나를 만족하면
     * 서울(1) 을 낮은 신뢰도(=2, Pending 큐) 로 후보에 올린다:
     *
     *  1) TMDB production_countries 에 "KR" 이 포함 (외국 제작사와의 합작 포함)
     *  2) TMDB spoken_languages 에 한국어("ko"/"korean"/"한국어") 포함
     *  3) haystack(제목/태그라인/개요) 에 범용 한국 키워드 포함:
     *     "korea", "korean", "south korea", "한국", "서울 스토리"
     *
     * 서울을 기본값으로 두는 이유: 대표성이 가장 높고 Pending 큐 단계에서
     * 관리자가 실제 지역으로 교정할 수 있음. 지역별 구체 매핑은
     * `RegionKeywordDictionary` 룰에서 이미 처리됨.
     */
    private List<MovieRegionSuggestion> matchKoreaSafetyNet(NetplixMovie m) {
        boolean hit = false;
        String reason = null;

        // 1) production_countries
        String countries = normalize(m.getProductionCountries());
        if (!countries.isEmpty() &&
                (containsToken(countries, "kr") || containsToken(countries, "korea") ||
                 containsToken(countries, "south korea") || countries.contains("대한민국"))) {
            hit = true;
            reason = "production_countries=KR (외국 제작 + 한국 합작/배경)";
        }

        // 2) spoken_languages
        if (!hit) {
            String langs = normalize(m.getSpokenLanguages());
            if (!langs.isEmpty() &&
                    (containsToken(langs, "ko") || containsToken(langs, "korean") ||
                     langs.contains("한국어"))) {
                hit = true;
                reason = "spoken_languages=ko (한국어 대사 포함)";
            }
        }

        // 3) haystack 범용 키워드
        if (!hit) {
            String haystack = buildHaystack(m);
            if (!haystack.isEmpty() &&
                    (haystack.contains("south korea") ||
                     haystack.contains(" korea") || haystack.contains("korean") ||
                     haystack.contains("한국"))) {
                hit = true;
                reason = "개요/제목에 Korea/Korean/한국 언급";
            }
        }

        if (!hit) return List.of();

        return List.of(MovieRegionSuggestion.builder()
                .movieName(m.getMovieName())
                .areaCode("1")
                .regionName("서울")
                .mappingType("BACKGROUND")
                .evidence("[안전망] " + reason + " — 관리자 승인 필요")
                .confidence(2) // < AUTO_APPROVE_THRESHOLD → pending 큐
                .source("RULE")
                .build());
    }

    /** "KR", "ko", "en" 등 대소문자/공백 정규화. null 허용. */
    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT);
    }

    /** 콤마/공백 구분 토큰 포함 여부(부분 문자열 오탐 방지). */
    private static boolean containsToken(String hay, String token) {
        String h = " " + hay.replace(',', ' ') + " ";
        return h.contains(" " + token + " ");
    }
}
