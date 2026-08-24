package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 일문 관광정보(JpnService2) 조회 서비스.
 *
 * <p>{@link EngTourService} 의 일본어 대응. 캐시는 어댑터
 * ({@link fast.campus.netplix.visitkorea.VisitKoreaJpnHttpClient}) 내부에서 관리되므로
 * 서비스 계층은 limit 바운더리만 통제하고 나머지는 위임한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JpnTourService implements GetJpnTourUseCase {

    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 30;

    private final JpnTourPort port;

    @Override
    public List<JpnTourPoi> byArea(String areaCode, String contentTypeId, int limit) {
        return port.fetchByArea(areaCode, contentTypeId, sanitize(limit));
    }

    @Override
    public List<JpnTourPoi> byLocation(double mapX, double mapY, int radius,
                                       String contentTypeId, int limit) {
        return port.fetchByLocation(mapX, mapY, radius, contentTypeId, sanitize(limit));
    }

    @Override
    public List<JpnTourPoi> byKeyword(String keyword, String contentTypeId, int limit) {
        return port.fetchByKeyword(keyword, contentTypeId, sanitize(limit));
    }

    @Override
    public Optional<JpnTourPoi> detail(String contentId, String contentTypeId) {
        return port.fetchDetail(contentId, contentTypeId);
    }

    @Override
    public boolean isConfigured() {
        return port.isConfigured();
    }

    private int sanitize(int limit) {
        if (limit <= 0) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }
}
