package fast.campus.netplix.tour;

import java.util.List;

/**
 * 한국관광공사 관광공모전(사진) 수상작 조회 Port.
 * 어댑터 측에서 24시간 in-memory 캐시로 전체(현 시점 약 95건)를 보관하며, 필터는 메모리에서 수행.
 * - 일일 호출 쿼터(개발계정 1,000회) 고려
 * - 응답 개수가 작아 페이지네이션이 아닌 전량 로딩이 효율적
 */
public interface TourPhotoPort {

    /**
     * 법정동 광역코드 기준 필터링 (예: 11=서울, 26=부산, 48=경남).
     *
     * @param lDongRegnCd {@link #ldongCodes()} 에서 제공되는 2자리 코드
     * @param limit       최대 반환 개수 (권장 6~12)
     * @return 이미지 URL 이 존재하는 항목만. 미설정/오류 시 빈 리스트.
     */
    List<TourPhoto> fetchByLDongRegnCd(String lDongRegnCd, int limit);

    /**
     * KorService2 areaCode (1~8, 31~39) 기준 필터링. 내부에서 lDongRegnCd 로 매핑 후 조회.
     */
    List<TourPhoto> fetchByAreaCode(String areaCode, int limit);

    /**
     * 제목/촬영지/키워드 기반 키워드 검색 (대소문자 무시, 부분일치).
     */
    List<TourPhoto> fetchByKeyword(String keyword, int limit);

    /**
     * 전체 수상작 상위 N개 (최근 등록일 순).
     */
    List<TourPhoto> fetchAll(int limit);

    /**
     * 포토 API 가 호출 가능한 상태인지 (serviceKey 설정 여부).
     */
    boolean isConfigured();
}
