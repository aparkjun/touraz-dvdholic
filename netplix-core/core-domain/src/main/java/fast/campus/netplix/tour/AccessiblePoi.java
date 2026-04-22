package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

import java.util.Map;

/**
 * 한국관광공사 무장애 여행정보(KorWithService2) POI.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/KorWithService2/areaBasedList2}
 *
 * <p>공모전 사진({@link TourPhoto})이 "스팟 이미지" 중심이라면 이 도메인은
 * 실제 방문 가능한 시설 정보(관광지/숙박/음식점/문화시설/여행코스/쇼핑)를 담는다.
 *
 * <p>접근성 필드는 detailWithTour2 호출로 보강되며, 해당 호출을 하지 않은 행에서는
 * 모든 {@code *Accessible} 필드가 null 이다. UI 에서는 null 을 "정보 없음" 으로 표시.
 *
 * <p>contentTypeId (KorService2 체계와 동일):
 * <ul>
 *   <li>12 관광지</li>
 *   <li>14 문화시설</li>
 *   <li>15 축제공연행사</li>
 *   <li>25 여행코스</li>
 *   <li>28 레포츠</li>
 *   <li>32 숙박</li>
 *   <li>38 쇼핑</li>
 *   <li>39 음식점</li>
 * </ul>
 */
@Getter
@Builder(toBuilder = true)
public class AccessiblePoi {

    private final String contentId;
    private final String contentTypeId;
    private final String title;
    private final String addr1;
    private final String addr2;
    private final String areaCode;
    private final String sigunguCode;
    private final String firstImage;
    private final String firstImageThumb;
    private final String tel;
    private final Double mapX; // longitude
    private final Double mapY; // latitude
    private final String overview;

    // 접근성 편의 요약 (detailWithTour2 보강시에만 값이 들어옴).
    private final String parkingAccessible;      // 장애인 전용 주차장
    private final String restroomAccessible;     // 장애인 화장실
    private final String wheelchairRental;       // 휠체어 대여
    private final String elevatorAccessible;     // 엘리베이터
    private final String blindHandicapEtc;       // 시각장애인 편의
    private final String hearingHandicapEtc;     // 청각장애인 편의
    private final String auditoriumAccessible;   // 강당/홀 접근성
    private final String publicTransport;        // 대중교통 접근
    private final String signGuide;              // 수어/안내 표지
    private final String videoGuide;             // 수어 비디오 가이드
    private final String brailleBlock;           // 점자블록
    private final String helpDog;                // 장애인 안내견 가능 여부
    private final String strollerRental;         // 유모차 대여
    private final String lactationRoom;          // 수유실
    private final String babySparechair;         // 유아동반 의자

    /**
     * detailInfo2 에서 내려온 반복정보 (infoname -> infotext).
     *
     * <p>KTO 무장애 API 는 편의시설 항목이 계속 확장되므로, 고정 필드 매핑 대신
     * 맵 형태로 원문 라벨과 값을 그대로 보관해 UI 가 자유롭게 렌더링하도록 한다.
     */
    private final Map<String, String> accessibilityDetail;

    /**
     * 장애 유형별 접근성 요약 비트. UI 에서 빠르게 칩으로 표시할 때 사용.
     * - 해당 필드가 "있음/가능/Y" 류 문자열이거나 URL/설명 형태로 내려오면 true.
     * - KTO 응답이 자유 텍스트라 약한 휴리스틱 사용.
     */
    public boolean hasPhysicalAccess() {
        return positive(parkingAccessible) || positive(restroomAccessible)
                || positive(wheelchairRental) || positive(elevatorAccessible)
                || positive(helpDog);
    }

    public boolean hasVisualAccess() {
        return positive(blindHandicapEtc) || positive(brailleBlock) || positive(signGuide);
    }

    public boolean hasHearingAccess() {
        return positive(hearingHandicapEtc) || positive(videoGuide);
    }

    public boolean hasFamilyAccess() {
        return positive(strollerRental) || positive(lactationRoom) || positive(babySparechair);
    }

    private static boolean positive(String v) {
        if (v == null) return false;
        String s = v.trim();
        if (s.isEmpty()) return false;
        // "없음/불가/해당없음" 만 false 로 취급 (KTO 자유 텍스트 대응)
        String lower = s.toLowerCase();
        return !(lower.startsWith("없") || lower.startsWith("불") || lower.contains("해당없"));
    }
}
