package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.SafeTourismPage;

import java.util.List;

public record SafeTourismListResponse(
        List<SafeTourismSpotResponse> items,
        int page,
        int perPage,
        long totalCount,
        boolean configured
) {
    public static SafeTourismListResponse from(SafeTourismPage page, boolean configured) {
        return new SafeTourismListResponse(
                page.getItems().stream().map(SafeTourismSpotResponse::from).toList(),
                page.getPage(),
                page.getPerPage(),
                page.getTotalCount(),
                configured
        );
    }
}
