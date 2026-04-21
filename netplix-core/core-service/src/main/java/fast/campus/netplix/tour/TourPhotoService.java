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

    private int sanitizeLimit(int limit) {
        if (limit <= 0) return 6;
        return Math.min(limit, 50);
    }
}
