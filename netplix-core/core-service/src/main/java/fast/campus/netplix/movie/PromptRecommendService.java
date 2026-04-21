package fast.campus.netplix.movie;

import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.movie.response.MovieWithRecommendReason;
import fast.campus.netplix.movie.response.MovieWithRecommendReason.RegionContext;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * OpenAI API로 프롬프트+기분+동행 기반 추천.
 * DB 영화 목록을 프롬프트에 넣어, 우리 보유 작품만 추천하도록 한다.
 * travelMode=true 이면 한국관광공사 지역 스냅샷을 system context 로 주입한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PromptRecommendService implements PromptRecommendUseCase {

    private static final int MAX_CATALOG = 500;
    private static final int MAX_INPUT_LENGTH = 200;
    private static final int TRAVEL_REGION_TOP_N = 10;
    private static final String LINE_SEP = "\n";
    private static final String TITLE_REASON_DELIM = " - ";

    private final OpenAiClientPort openAiClientPort;
    private final PersistenceMoviePort persistenceMoviePort;
    private final TourIndexUseCase tourIndexUseCase;
    private final MovieRegionMappingPort movieRegionMappingPort;

    @Override
    public List<MovieWithRecommendReason> recommendByPrompt(
            String q, String mood, String companion, String contentType, int limit,
            boolean travelMode, String areaCode) {
        String safeQ = truncate(q, MAX_INPUT_LENGTH);
        String safeMood = truncate(mood, MAX_INPUT_LENGTH);
        String safeCompanion = truncate(companion, MAX_INPUT_LENGTH);
        List<String> catalogNames = collectMovieNames(contentType, MAX_CATALOG);
        if (catalogNames.isEmpty()) {
            log.warn("추천할 영화 목록이 비어 있음");
            return List.of();
        }

        List<TourIndex> tourContext = travelMode ? loadTourContext(areaCode) : List.of();
        String systemPrompt = buildSystemPrompt(limit, travelMode, tourContext);
        String userPrompt = buildUserPrompt(catalogNames, safeQ, safeMood, safeCompanion, limit);
        String response = openAiClientPort.chat(systemPrompt, userPrompt);
        if (response == null || response.isBlank()) {
            return List.of();
        }

        Map<String, String> titleToReason = parseResponseLines(response);
        List<String> orderedTitles = new ArrayList<>(titleToReason.keySet());
        if (orderedTitles.isEmpty()) {
            return List.of();
        }

        List<NetplixMovie> allCatalog = new ArrayList<>();
        int p = 0;
        while (true) {
            List<NetplixMovie> batch = persistenceMoviePort.fetchByContentType(contentType, p, 50);
            if (batch.isEmpty()) break;
            allCatalog.addAll(batch);
            if (batch.size() < 50) break;
            p++;
        }

        Map<String, RegionContext> regionCtxByMovie = travelMode
                ? buildRegionContextByMovie(tourContext)
                : Map.of();

        List<MovieWithRecommendReason> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (String title : orderedTitles) {
            if (result.size() >= limit) break;
            String normalizedTitle = normalize(title);
            NetplixMovie movie = allCatalog.stream()
                    .filter(m -> normalize(m.getMovieName()).equals(normalizedTitle))
                    .findFirst()
                    .orElse(allCatalog.stream()
                            .filter(m -> normalize(m.getMovieName()).contains(normalizedTitle)
                                    || normalizedTitle.contains(normalize(m.getMovieName())))
                            .findFirst()
                            .orElse(null));
            if (movie == null || !seen.add(movie.getMovieName())) {
                continue;
            }
            String reason = titleToReason.getOrDefault(title, "추천 영화입니다.");
            RegionContext ctx = travelMode ? regionCtxByMovie.get(movie.getMovieName()) : null;
            result.add(new MovieWithRecommendReason(movie, reason, ctx));
        }
        log.info("OpenAI 프롬프트 추천: {}편 반환 (travelMode={}, areaCode={})",
                result.size(), travelMode, areaCode);
        return result;
    }

    private List<TourIndex> loadTourContext(String areaCode) {
        try {
            if (areaCode != null && !areaCode.isBlank()) {
                return tourIndexUseCase.getLatestByAreaCode(areaCode)
                        .map(List::of)
                        .orElseGet(() -> tourIndexUseCase.getTopBySearchVolume(TRAVEL_REGION_TOP_N));
            }
            return tourIndexUseCase.getTopBySearchVolume(TRAVEL_REGION_TOP_N);
        } catch (Exception e) {
            log.warn("여행 모드 컨텍스트 로드 실패, 빈 컨텍스트로 계속: {}", e.getMessage());
            return List.of();
        }
    }

    private Map<String, RegionContext> buildRegionContextByMovie(List<TourIndex> tourContext) {
        if (tourContext == null || tourContext.isEmpty()) return Map.of();
        Map<String, TourIndex> byAreaCode = new HashMap<>();
        for (TourIndex ti : tourContext) {
            if (ti.getAreaCode() != null) {
                byAreaCode.put(ti.getAreaCode(), ti);
            }
        }
        Map<String, RegionContext> out = new HashMap<>();
        try {
            for (String areaCode : byAreaCode.keySet()) {
                List<MovieRegionMapping> mappings = movieRegionMappingPort.findByAreaCode(areaCode);
                for (MovieRegionMapping m : mappings) {
                    if (m.getMovieName() == null) continue;
                    TourIndex ti = byAreaCode.get(areaCode);
                    out.putIfAbsent(m.getMovieName(), toRegionContext(ti));
                }
            }
        } catch (Exception e) {
            log.warn("영화-지역 매핑 로드 실패: {}", e.getMessage());
        }
        return out;
    }

    private RegionContext toRegionContext(TourIndex ti) {
        if (ti == null) return null;
        String summary = buildRegionSummary(ti);
        return new RegionContext(
                ti.getAreaCode(),
                ti.getRegionName(),
                ti.getTourDemandIdx(),
                ti.getCulturalResourceDemand(),
                ti.getSearchVolume(),
                summary
        );
    }

    private String buildRegionSummary(TourIndex ti) {
        StringBuilder sb = new StringBuilder();
        if (ti.getSearchVolume() != null) {
            sb.append("🔥 검색 ").append(ti.getSearchVolume());
        }
        if (ti.getTourDemandIdx() != null) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append("관광수요 ").append(formatNumber(ti.getTourDemandIdx()));
        }
        if (ti.isDecliningRegion()) {
            if (sb.length() > 0) sb.append(" · ");
            sb.append("⚠️ 소멸위기 지역");
        }
        return sb.toString();
    }

    private String buildSystemPrompt(int limit, boolean travelMode, List<TourIndex> tourContext) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert movie recommender. You must recommend ONLY from the given list of movie titles. ")
          .append("Reply in Korean. You MUST list at least ").append(limit).append(" movies (or every possible match). ")
          .append("Think broadly: consider genre, mood, atmosphere, theme, director style, actors, and storyline relevance. ")
          .append("Write ONE line per movie with format: \"Exact Movie Title - reason in one short sentence.\" ")
          .append("Do not number the lines. Copy the exact title character-by-character from the list. Do NOT modify the title at all.");
        if (travelMode && tourContext != null && !tourContext.isEmpty()) {
            sb.append("\n\n[한국관광공사 지역 지표 컨텍스트]\n");
            for (TourIndex ti : tourContext) {
                sb.append("- ").append(ti.getRegionName() != null ? ti.getRegionName() : ti.getAreaCode())
                  .append(": ");
                if (ti.getTourDemandIdx() != null) sb.append("관광수요 ").append(formatNumber(ti.getTourDemandIdx())).append(", ");
                if (ti.getCulturalResourceDemand() != null) sb.append("문화자원 ").append(formatNumber(ti.getCulturalResourceDemand())).append(", ");
                if (ti.getSearchVolume() != null) sb.append("검색량 ").append(ti.getSearchVolume());
                sb.append("\n");
            }
            sb.append("\n여행/로드트립/풍경을 감상할 수 있는 영화를 우선 고려하고, 가능하면 위 지역의 분위기·계절·테마와 어울리는 작품을 추천하세요. ")
              .append("reason 문장에 지역명이나 지표 숫자(예: 검색량·관광수요)를 자연스럽게 포함하세요.");
        }
        return sb.toString();
    }

    private List<String> collectMovieNames(String contentType, int max) {
        List<String> names = new ArrayList<>();
        int page = 0;
        int pageSize = 50;
        while (names.size() < max) {
            List<NetplixMovie> pageList = persistenceMoviePort.fetchByContentType(contentType, page, pageSize);
            if (pageList.isEmpty()) break;
            for (NetplixMovie m : pageList) {
                if (m.getMovieName() != null && !m.getMovieName().isBlank()) {
                    names.add(m.getMovieName());
                    if (names.size() >= max) break;
                }
            }
            page++;
            if (pageList.size() < pageSize) break;
        }
        return names;
    }

    private String buildUserPrompt(List<String> catalogNames, String q, String mood, String companion, int limit) {
        String catalog = String.join(", ", catalogNames);
        StringBuilder sb = new StringBuilder();
        sb.append("Available movies (recommend ONLY from this list): ").append(catalog).append("\n\n");
        if (q != null && !q.isBlank()) sb.append("User request: ").append(q).append("\n");
        if (mood != null && !mood.isBlank()) sb.append("Mood: ").append(mood).append("\n");
        if (companion != null && !companion.isBlank()) sb.append("Watching with: ").append(companion).append("\n");
        sb.append("Pick at least ").append(limit).append(" movies that match. Be generous — include any movie that could remotely fit the request. ")
          .append("Reply with one line per movie: \"Exact Movie Title - reason in Korean.\"");
        return sb.toString();
    }

    private Map<String, String> parseResponseLines(String response) {
        Map<String, String> map = new LinkedHashMap<>();
        for (String line : response.split(LINE_SEP)) {
            line = line.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            line = line.replaceFirst("^\\d+[.)]\\s*", "");
            int idx = line.indexOf(TITLE_REASON_DELIM);
            String title = idx >= 0 ? line.substring(0, idx).trim() : line;
            String reason = idx >= 0 ? line.substring(idx + TITLE_REASON_DELIM.length()).trim() : "추천 영화입니다.";
            if (!title.isEmpty()) {
                map.put(title, reason);
            }
        }
        return map;
    }

    private static String normalize(String s) {
        if (s == null) return "";
        return s.replaceAll("[\\s\\p{Punct}]", "").toLowerCase();
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) return null;
        value = value.trim();
        return value.length() <= maxLen ? value : value.substring(0, maxLen);
    }

    private static String formatNumber(Double d) {
        if (d == null) return "-";
        if (d == Math.floor(d)) return String.valueOf(d.intValue());
        return String.format(Locale.ROOT, "%.1f", d);
    }
}
