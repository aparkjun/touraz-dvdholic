package fast.campus.netplix.tour;

import java.util.List;

/**
 * 한국관광공사 두루누비(B551011/Durunubi) 조회 Port.
 *
 * <p>TourAPI Guide v4.1 기준 2종 오퍼레이션을 포트로 노출한다:
 * <ul>
 *   <li>courseList — 코스 목록 정보 조회 (코리아둘레길 284개 코스)</li>
 *   <li>routeList  — 길 목록 정보 조회 (해파랑/남파랑/서해랑/DMZ 평화의 길 등)</li>
 * </ul>
 *
 * <p>단일 {@code VISITKOREA_SERVICE_KEY} 를 다른 KTO 서비스와 공유하므로
 * QPS 여유를 위해 어댑터 내부에서 TTL 캐시를 유지한다.
 */
public interface DurunubiPort {

    /**
     * 두루누비 코스 목록 조회.
     *
     * @param brdDiv    길 구분 코드(예: DNWW/DNBW/DNHW/DNJJ). null/blank 이면 전체.
     * @param routeIdx  특정 길(route) 고유번호. null/blank 이면 전체 길.
     * @param keyword   코스명 부분 검색 키워드. null/blank 이면 미적용.
     * @param limit     최대 반환 개수.
     */
    List<DurunubiCourse> fetchCourses(String brdDiv, String routeIdx, String keyword, int limit);

    /** 두루누비 길(route) 목록 조회. */
    List<DurunubiRoute> fetchRoutes(int limit);

    /** 어댑터 호출 가능 상태(serviceKey + URL 설정) 여부. */
    boolean isConfigured();
}
