package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 관광지 오디오 가이드정보(Odii) 공통 응답 스키마.
 *
 * <p>/themeBasedList · /storyBasedList · /themeLocationBasedList · /storyLocationBasedList ·
 *    /themeSearchList · /storySearchList 6개 오퍼레이션 공용 item.
 *
 * <p>Odii 는 Wellness/MdclTursm 같은 신규 KTO 패밀리로 camelCase 필드가 우세하지만,
 * 구 KorService 계열 snake_case(addr1/mapx 등) 로 내려오는 경우도 있어
 * {@link JsonAlias} 로 다중 후보를 허용해 방어적으로 파싱한다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaOdiiResponse {

    private Response response;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        private Header header;
        private Body body;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Header {
        private String resultCode;
        private String resultMsg;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private Items items;
        private Integer numOfRows;
        private Integer pageNo;
        private Integer totalCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Items {
        private List<Item> item;
    }

    /**
     * Odii theme/story item 공용 구조.
     * 실제 스펙 공개 전까지 여러 후보명을 동시 수용한다.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        /** 관광지 ID (theme 기본키 후보군). */
        @JsonAlias({"tid", "contentid", "contentId", "themeId", "THID"})
        private String tid;

        /** 이야기 ID (story 기본키 후보군). */
        @JsonAlias({"stid", "storyId", "storyid", "sTID"})
        private String stid;

        @JsonAlias({"tTitle", "storyTitle", "name"})
        private String title;

        /** 오디오 트랙 제목 (스토리/테마 모두 보유 가능). */
        @JsonAlias({"storyAudioTitle", "tAudioTitle", "audioTtl", "audioName"})
        private String audioTitle;

        /** 오디오 파일(mp3) URL — 플레이어 재생 대상. */
        @JsonAlias({"audioURL", "storyAudioUrl", "tAudioUrl", "audio_url", "mediaUrl"})
        private String audioUrl;

        /** 재생 시간 (mm:ss 또는 초). */
        @JsonAlias({"playTime", "storyPlayTime", "tPlayTime", "audioPlayTime", "playTm"})
        private String playTimeText;

        /** 스토리 스크립트/설명. storyBasedList 실제 응답에서는 "script" 로 내려옴. */
        @JsonAlias({"script", "storyDesc", "tDesc", "overview", "description", "scriptDesc"})
        private String description;

        @JsonAlias({"imgPath", "image", "firstimage", "tImage", "storyImage", "thumbImage", "orgImage"})
        private String imageUrl;

        /** 1차 주소 (예: 충청남도). Odii 는 addr1 + addr2 분리 제공. */
        @JsonAlias({"basicAddress", "addr1", "baseAddr", "roadAddr", "tAddr"})
        private String baseAddr;

        /** 2차 주소 (예: 부여군). 도메인 매핑 시 baseAddr 와 결합. */
        @JsonAlias({"addr2", "detailAddr"})
        private String detailAddr;

        @JsonAlias({"mapx", "mapX", "longitude", "lng"})
        private String mapX;

        @JsonAlias({"mapy", "mapY", "latitude", "lat"})
        private String mapY;

        /** 테마 카테고리. */
        @JsonAlias({"themeCategory", "themeGb", "categoryName", "cat1", "cat3", "themeNm"})
        private String themeCategory;

        /** 콘텐츠 언어. */
        @JsonProperty("langCode")
        @JsonAlias({"langDivCd", "languageCode", "lang"})
        private String langCode;

        /** locationBasedList 에서 내려주는 거리(m). */
        @JsonAlias({"dist", "distance"})
        private String dist;

        /** 법정동 코드 (선택적 노출, 일부 오퍼레이션에만 존재). */
        @JsonProperty("lDongRegnCd")
        @JsonAlias({"areacode"})
        private String lDongRegnCd;

        @JsonProperty("lDongSignguCd")
        @JsonAlias({"sigungucode"})
        private String lDongSignguCd;
    }
}
