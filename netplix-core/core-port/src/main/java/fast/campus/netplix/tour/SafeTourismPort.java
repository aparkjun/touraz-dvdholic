package fast.campus.netplix.tour;

/**
 * 한국관광공사 비대면 안심관광지 목록(api.odcloud.kr) 조회 Port.
 */
public interface SafeTourismPort {

    boolean isConfigured();

    SafeTourismPage fetchPage(int page, int perPage);
}
