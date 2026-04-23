package fast.campus.netplix.tour;

import java.util.List;

/**
 * 두루누비(코리아둘레길) 코스/길 조회 유스케이스.
 */
public interface GetDurunubiUseCase {

    List<DurunubiCourse> courses(String brdDiv, String routeIdx, String keyword, int limit);

    List<DurunubiRoute> routes(int limit);

    boolean isConfigured();
}
