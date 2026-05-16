package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class SafeTourismPage {

    private final List<SafeTourismSpot> items;
    private final int page;
    private final int perPage;
    private final long totalCount;
}
