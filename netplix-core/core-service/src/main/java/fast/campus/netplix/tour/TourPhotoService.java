package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 관광공모전(사진) 수상작 조회 서비스.
 * 캐시는 어댑터 내부 (VisitKoreaPhokoHttpClient) 에서 관리하므로 여기선 단순 위임.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TourPhotoService implements GetTourPhotosUseCase {

    private final TourPhotoPort tourPhotoPort;

    @Override
    public List<TourPhoto> byAreaCode(String areaCode, int limit) {
        return tourPhotoPort.fetchByAreaCode(areaCode, sanitizeLimit(limit));
    }

    @Override
    public List<TourPhoto> byLDongRegnCd(String lDongRegnCd, int limit) {
        return tourPhotoPort.fetchByLDongRegnCd(lDongRegnCd, sanitizeLimit(limit));
    }

    @Override
    public List<TourPhoto> byKeyword(String keyword, int limit) {
        return tourPhotoPort.fetchByKeyword(keyword, sanitizeLimit(limit));
    }

    @Override
    public List<TourPhoto> all(int limit) {
        return tourPhotoPort.fetchAll(sanitizeLimit(limit));
    }

    // 어댑터가 KTO totalCount 만큼 전 페이지를 메모리에 적재하므로 서비스 레벨의
    // 인위적 캡(이전 200) 을 제거. limit <= 0 이면 어댑터에서 캐시 전량 반환.
    // 양수가 들어오면 그대로 어댑터에 전달해 상위 limit 만 슬라이스.
    private int sanitizeLimit(int limit) {
        if (limit <= 0) return Integer.MAX_VALUE;
        return limit;
    }
}
