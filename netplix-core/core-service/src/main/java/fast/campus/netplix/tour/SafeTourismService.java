package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SafeTourismService implements GetSafeTourismSpotsUseCase {

    private final SafeTourismPort safeTourismPort;

    @Override
    public SafeTourismPage list(int page, int perPage, String areaKeyword, String q) {
        int safePage = Math.max(1, page);
        int safePerPage = Math.min(Math.max(1, perPage), 50);
        if (!safeTourismPort.isConfigured()) {
            return SafeTourismPage.builder()
                    .items(List.of())
                    .page(safePage)
                    .perPage(safePerPage)
                    .totalCount(0)
                    .build();
        }

        SafeTourismPage raw = safeTourismPort.fetchPage(safePage, safePerPage);
        List<SafeTourismSpot> filtered = raw.getItems().stream()
                .filter(s -> matchesArea(s, areaKeyword))
                .filter(s -> matchesKeyword(s, q))
                .toList();

        return SafeTourismPage.builder()
                .items(filtered)
                .page(raw.getPage())
                .perPage(raw.getPerPage())
                .totalCount(raw.getTotalCount())
                .build();
    }

    private static boolean matchesArea(SafeTourismSpot s, String areaKeyword) {
        if (areaKeyword == null || areaKeyword.isBlank()) return true;
        String needle = areaKeyword.trim().toLowerCase(Locale.ROOT);
        return contains(s.getAreaName(), needle)
                || contains(s.getSignguName(), needle)
                || contains(s.getAddress(), needle);
    }

    private static boolean matchesKeyword(SafeTourismSpot s, String keyword) {
        if (keyword == null || keyword.isBlank()) return true;
        String needle = keyword.trim().toLowerCase(Locale.ROOT);
        return contains(s.getName(), needle)
                || contains(s.getTheme(), needle)
                || contains(s.getSeason(), needle)
                || contains(s.getIntro(), needle)
                || contains(s.getAreaName(), needle)
                || contains(s.getSignguName(), needle);
    }

    private static boolean contains(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle);
    }
}
