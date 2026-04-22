package fast.campus.netplix.tour;

import java.util.List;
import java.util.Optional;

/**
 * 한국관광공사 반려동물 동반여행 조회 유스케이스. REST 컨트롤러에서 사용.
 */
public interface GetPetFriendlyPoiUseCase {

    List<PetFriendlyPoi> byArea(String areaCode, String contentTypeId, int limit);

    Optional<PetFriendlyPoi> detail(String contentId, String contentTypeId);

    List<PetFriendlyPoi> byLocation(double mapX, double mapY, int radius,
                                    String contentTypeId, int limit);

    List<PetFriendlyPoi> byKeyword(String keyword, String contentTypeId, int limit);

    boolean isConfigured();
}
