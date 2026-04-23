package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 두루누비 코스/길 조회 서비스. 캐시는 어댑터에서 관리, 서비스는 limit 바운더리 + 위임.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DurunubiService implements GetDurunubiUseCase {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    private final DurunubiPort port;

    @Override
    public List<DurunubiCourse> courses(String brdDiv, String routeIdx, String keyword, String areaCode, int limit) {
        return port.fetchCourses(brdDiv, routeIdx, keyword, areaCode, sanitize(limit));
    }

    @Override
    public List<DurunubiRoute> routes(int limit) {
        return port.fetchRoutes(sanitize(limit));
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
