package fast.campus.netplix.kma;

/**
 * 기상청 단기예보(일반특보 구역) reg 코드 다수 — 대표 좌표(행정 중심 근사).
 * 사용자 위치와의 거리로 최근접 reg 를 고를 때만 사용한다.
 */
public enum KmaRegCentroid {
    SEOUL_GANGNAM("11B10101", "서울(강남)", 37.498, 127.028),
    SEOUL_JONGNO("11B10103", "서울(종로)", 37.573, 126.979),
    INCHEON("11B20201", "인천", 37.456, 126.705),
    SUWON("11B20605", "수원", 37.263, 127.029),
    CHUNCHEON("11B20405", "춘천", 37.881, 127.729),
    GANGNEUNG("11B20403", "강릉", 37.751, 128.876),
    DAEJEON("11C20401", "대전", 36.350, 127.384),
    DAEGU("11H10701", "대구", 35.871, 128.601),
    ULSAN("11H10201", "울산", 35.538, 129.311),
    BUSAN("11H20201", "부산", 35.179, 129.075),
    CHANGWON("11H20301", "창원", 35.228, 128.681),
    GWANGJU("11F20501", "광주", 35.159, 126.852),
    JEONJU("11F10201", "전주", 35.824, 127.148),
    MOKPO("11F20801", "목포", 34.811, 126.392),
    JEJU("11G00201", "제주", 33.499, 126.531),
    POHANG("11H10301", "포항", 36.019, 129.343),
    ANDONG("11H10501", "안동", 36.568, 128.729),
    JEONGEUP("11F10301", "정읍", 35.570, 126.856),
    CHEONGJU("11C10301", "청주", 36.642, 127.489),
    SEJONG("11C10304", "세종", 36.480, 127.289);

    private final String reg;
    private final String label;
    private final double lat;
    private final double lng;

    KmaRegCentroid(String reg, String label, double lat, double lng) {
        this.reg = reg;
        this.label = label;
        this.lat = lat;
        this.lng = lng;
    }

    public String reg() {
        return reg;
    }

    public String label() {
        return label;
    }

    public double lat() {
        return lat;
    }

    public double lng() {
        return lng;
    }
}
