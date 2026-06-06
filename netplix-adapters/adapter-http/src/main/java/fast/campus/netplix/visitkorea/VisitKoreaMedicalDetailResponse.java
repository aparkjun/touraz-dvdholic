package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) /detailMdclTursm 응답 스키마.
 *
 * <p>외국인 환자 의사결정에 필요한 의료관광 특화 정보를 제공한다:
 * 의료기관 구분, 지원 외국어, 주요 진료과목, 특화 시술, 온라인 예약 가능 여부,
 * 외국인 코디네이터 상주, 외국인 전용 시설, 연혁, 홍보 SNS 등.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaMedicalDetailResponse {

    private Response response;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        private Body body;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private Items items;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Items {
        private List<Item> item;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String contentId;
        /** 의료기관 구분 (예: Medical Institution). */
        private String mdclTursmDivInfo;
        /** 지원 외국어 (쉼표 구분: English,Japanese,Chinese ...). */
        private String svcLangInfo;
        /** 홈페이지 URL. */
        private String hmpgInfo;
        /** 홍보 SNS (줄바꿈/쉼표 구분). */
        private String prSnsInfo;
        /** 연혁. */
        private String histrCn;
        /** 온라인 예약 가능 여부 (Y/N). */
        private String onlineRsvtPsblYn;
        /** 상담/예약 안내 URL. */
        private String gdsCnselCn;
        /** 기관 형태 (예: General Hospital, Clinic). */
        private String insttDevInfo;
        /** 주요 진료과목 (쉼표 구분). 주의: KTO 필드명이 mainMdlcSubjInfo(오탈자 포함). */
        private String mainMdlcSubjInfo;
        /** 특화 시술/전문 진료 (줄바꿈 구분). */
        private String specProcMdlcInfo;
        /** 외국인 코디네이터 상주 여부 (Y/N). */
        private String coorResidYn;
        /** 외국인 전용 시설/편의 (줄바꿈 구분). */
        private String specFcltyInfo;
        /** 협력 병원 정보. */
        private String corprHsptlInfo;
        /** 진료 상품 종류 정보. */
        private String trtmntGdsKndInfo;
    }
}
