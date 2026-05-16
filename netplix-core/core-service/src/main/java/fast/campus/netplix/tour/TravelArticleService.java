package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TravelArticleService implements GetTravelArticlesUseCase {

    private final TravelArticlePort travelArticlePort;

    @Override
    public TravelArticlePage list(int page, int perPage, String areaCode, String keyword) {
        int safePage = Math.max(1, page);
        int safePerPage = Math.min(Math.max(1, perPage), 50);
        if (!travelArticlePort.isConfigured()) {
            return TravelArticlePage.builder()
                    .items(List.of())
                    .page(safePage)
                    .perPage(safePerPage)
                    .totalCount(0)
                    .build();
        }

        TravelArticlePage raw = travelArticlePort.fetchPage(safePage, safePerPage);
        List<TravelArticle> filtered = raw.getItems().stream()
                .filter(a -> matchesArea(a, areaCode))
                .filter(a -> matchesKeyword(a, keyword))
                .toList();

        return TravelArticlePage.builder()
                .items(filtered)
                .page(raw.getPage())
                .perPage(raw.getPerPage())
                .totalCount(raw.getTotalCount())
                .build();
    }

    private static boolean matchesArea(TravelArticle a, String areaCode) {
        if (areaCode == null || areaCode.isBlank()) return true;
        if (a.getAreaCode() == null) {
            String name = a.getAreaName();
            return name != null && name.contains(areaCode.trim());
        }
        try {
            return a.getAreaCode().equals(Integer.parseInt(areaCode.trim()));
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static boolean matchesKeyword(TravelArticle a, String keyword) {
        if (keyword == null || keyword.isBlank()) return true;
        String q = keyword.trim().toLowerCase(Locale.ROOT);
        return contains(a.getTitle(), q)
                || contains(a.getAreaName(), q)
                || contains(a.getSignguName(), q)
                || contains(a.getCategoryName(), q);
    }

    private static boolean contains(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle);
    }
}
