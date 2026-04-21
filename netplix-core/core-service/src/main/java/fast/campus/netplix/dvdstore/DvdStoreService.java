package fast.campus.netplix.dvdstore;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class DvdStoreService implements DvdStoreUseCase {

    private final DvdStorePort dvdStorePort;

    @Override
    public List<DvdStore> getAllStores() {
        return dvdStorePort.findAll();
    }

    @Override
    public List<DvdStore> getOperatingStores() {
        return dvdStorePort.findByStatusCode("01");
    }

    @Override
    public List<DvdStore> search(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return dvdStorePort.findByStatusCode("01");
        }
        return dvdStorePort.searchByKeyword(keyword.trim());
    }

    @Override
    public List<DvdStore> findNearby(double lat, double lon, double radiusKm) {
        List<DvdStore> stores = dvdStorePort.findNearby(lat, lon, radiusKm);
        for (DvdStore s : stores) {
            if (s.getLatitude() != null && s.getLongitude() != null) {
                s.setDistance(haversine(lat, lon, s.getLatitude(), s.getLongitude()));
            }
        }
        return stores;
    }

    @Override
    public long getStoreCount() {
        return dvdStorePort.count();
    }

    @Override
    public List<DvdStoreRegionStat> getRegionStats() {
        return dvdStorePort.aggregateByRegion();
    }

    private static double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    @Override
    public String loadFromCsvContent(String csvContent) {
        if (csvContent.startsWith("\uFEFF")) csvContent = csvContent.substring(1);
        csvContent = csvContent.replace("\r\n", "\n").replace("\r", "\n");
        String[] allLines = csvContent.split("\n", -1);

        StringBuilder diag = new StringBuilder();
        diag.append("lines=").append(allLines.length);

        if (allLines.length < 2) {
            return "줄 수 부족: " + allLines.length;
        }

        String[] headers = parseCsvLine(allLines[0]);
        diag.append(", headerCols=").append(headers.length);

        Map<String, Integer> hmap = new LinkedHashMap<>();
        for (int h = 0; h < headers.length; h++) {
            hmap.put(headers[h].trim(), h);
        }

        int COL_MGMT = col(hmap, -1, "관리번호");
        diag.append(", mgmtIdx=").append(COL_MGMT);
        diag.append(", mgmtFromMap=").append(hmap.containsKey("관리번호"));

        int COL_AREA = col(hmap, -1, "개방자치단체코드");
        int COL_LICENSE = col(hmap, -1, "인허가일자");
        int COL_STATUS_NAME = col(hmap, -1, "영업상태명");
        int COL_CLOSURE = col(hmap, -1, "폐업일자");
        int COL_POSTAL_OLD = col(hmap, -1, "소재지우편번호");
        int COL_POSTAL = col(hmap, -1, "도로명우편번호");
        int COL_NAME = col(hmap, -1, "사업장명");
        int COL_ROAD_ADDR = col(hmap, -1, "도로명주소", "도로명전체주소");
        int COL_FACILITY = col(hmap, -1, "시설면적");
        int COL_STATUS_CODE = col(hmap, -1, "영업상태코드", "영업상태구분코드");
        int COL_PHONE = col(hmap, -1, "전화번호", "소재지전화");
        int COL_GAME = col(hmap, -1, "제공게임물명");
        int COL_PRODUCT = col(hmap, -1, "제작취급품목내용");
        int COL_COORD_X = col(hmap, -1, "좌표정보(X)", "좌표정보x(epsg5174)");
        int COL_COORD_Y = col(hmap, -1, "좌표정보(Y)", "좌표정보y(epsg5174)");
        int COL_SURROUND = col(hmap, -1, "주변환경명");
        int COL_JIBUN_ADDR = col(hmap, -1, "지번주소", "소재지전체주소");
        int COL_FLOOR_ABOVE = col(hmap, -1, "지상층수");
        int COL_REGION = col(hmap, -1, "지역구분명");
        int COL_FLOOR_BELOW = col(hmap, -1, "지하층수");
        int COL_FLOOR_TOTAL = col(hmap, -1, "총층수");
        int COL_LAST_MOD = col(hmap, -1, "최종수정시점");
        int COL_LICENSE_CANCEL = col(hmap, -1, "인허가취소일자");
        int COL_SUSPEND_START = col(hmap, -1, "휴업시작일자");
        int COL_SUSPEND_END = col(hmap, -1, "휴업종료일자");
        int COL_BUILDING_USAGE = col(hmap, -1, "건물용도명");
        int COL_DATA_UPDATE = col(hmap, -1, "데이터갱신시점", "데이터갱신일자");
        int COL_DATA_UPDATE_TYPE = col(hmap, -1, "데이터갱신구분");
        int COL_PREV_GAME_BIZ = col(hmap, -1, "기존게임업외업종명");
        int COL_CULTURAL_BIZ = col(hmap, -1, "문화사업자구분명");
        int COL_BIZ_TYPE = col(hmap, -1, "문화체육업종명");
        int COL_DETAIL_STATUS_NAME = col(hmap, -1, "상세영업상태명");
        int COL_DETAIL_STATUS_CODE = col(hmap, -1, "상세영업상태코드");

        Map<String, DvdStore> dedup = new LinkedHashMap<>();
        int totalLines = 0, blankMgmt = 0, errorLines = 0, fewCols = 0;

        for (int i = 1; i < allLines.length; i++) {
            String line = allLines[i];
            if (line.isBlank()) continue;
            totalLines++;
            try {
                String[] cols = parseCsvLine(line);
                if (cols.length < 2) { fewCols++; continue; }
                String mgmtNo = cols.length > COL_MGMT ? cols[COL_MGMT].trim() : "";
                if (mgmtNo.isBlank()) { blankMgmt++; continue; }

                String postal = cols.length > COL_POSTAL ? cols[COL_POSTAL].trim() : "";
                if (postal.isBlank() && cols.length > COL_POSTAL_OLD) {
                    postal = cols[COL_POSTAL_OLD].trim();
                }

                    String areaCode = safeGet(cols, COL_AREA);
                    String dedupKey = areaCode + "|" + mgmtNo;

                    String cxStr = safeGet(cols, COL_COORD_X).trim();
                    String cyStr = safeGet(cols, COL_COORD_Y).trim();
                    Double latitude = null;
                    Double longitude = null;
                    if (!cxStr.isEmpty() && !cyStr.isEmpty()) {
                        try {
                            double tmX = Double.parseDouble(cxStr);
                            double tmY = Double.parseDouble(cyStr);
                            double[] latLon = tmToWgs84(tmX, tmY);
                            latitude = latLon[0];
                            longitude = latLon[1];
                        } catch (NumberFormatException ignored) {}
                    }

                    dedup.put(dedupKey, DvdStore.builder()
                        .managementNo(mgmtNo)
                        .areaCode(safeGet(cols, COL_AREA))
                        .businessName(safeGet(cols, COL_NAME))
                        .statusName(safeGet(cols, COL_STATUS_NAME))
                        .statusCode(safeGet(cols, COL_STATUS_CODE))
                        .roadAddress(safeGet(cols, COL_ROAD_ADDR))
                        .jibunAddress(safeGet(cols, COL_JIBUN_ADDR))
                        .phone(safeGet(cols, COL_PHONE))
                        .postalCode(postal)
                        .licenseDate(safeGet(cols, COL_LICENSE))
                        .closureDate(safeGet(cols, COL_CLOSURE))
                        .coordinateX(cxStr)
                        .coordinateY(cyStr)
                        .productInfo(safeGet(cols, COL_PRODUCT))
                        .facilityArea(safeGet(cols, COL_FACILITY))
                        .lastDataModified(safeGet(cols, COL_LAST_MOD))
                        .latitude(latitude)
                        .longitude(longitude)
                        .businessType(safeGet(cols, COL_BIZ_TYPE))
                        .detailStatusName(safeGet(cols, COL_DETAIL_STATUS_NAME))
                        .detailStatusCode(safeGet(cols, COL_DETAIL_STATUS_CODE))
                        .suspendStartDate(safeGet(cols, COL_SUSPEND_START))
                        .suspendEndDate(safeGet(cols, COL_SUSPEND_END))
                        .licenseCancelDate(safeGet(cols, COL_LICENSE_CANCEL))
                        .dataUpdateDate(safeGet(cols, COL_DATA_UPDATE))
                        .buildingUsage(safeGet(cols, COL_BUILDING_USAGE))
                        .floorAbove(safeGet(cols, COL_FLOOR_ABOVE))
                        .floorBelow(safeGet(cols, COL_FLOOR_BELOW))
                        .floorTotal(safeGet(cols, COL_FLOOR_TOTAL))
                        .regionType(safeGet(cols, COL_REGION))
                        .gameName(safeGet(cols, COL_GAME))
                        .surroundingEnv(safeGet(cols, COL_SURROUND))
                        .dataUpdateType(safeGet(cols, COL_DATA_UPDATE_TYPE))
                        .previousGameBusinessType(safeGet(cols, COL_PREV_GAME_BIZ))
                        .culturalBusinessType(safeGet(cols, COL_CULTURAL_BIZ))
                        .build());
            } catch (Exception e) {
                errorLines++;
            }
        }

        diag.append(", data=").append(totalLines);
        diag.append(", blank=").append(blankMgmt);
        diag.append(", fewCols=").append(fewCols);
        diag.append(", err=").append(errorLines);
        diag.append(", dedup=").append(dedup.size());

        List<DvdStore> stores = new ArrayList<>(dedup.values());
        if (stores.isEmpty()) {
            return "파싱 결과 0건. " + diag;
        }

        dvdStorePort.deleteAll();
        dvdStorePort.saveAll(stores);
        return "적재 완료: " + stores.size() + "건. [" + diag + "]";
    }

    private static final String CSV_ZIP_URL =
            "http://www.localdata.go.kr/datafile/each/03_10_02_P_CSV.zip";

    @Override
    public int refreshFromApi() {
        log.info("[DVD-STORE] === 공공데이터 CSV 자동 갱신 시작 ===");
        try {
            HttpClient httpClient = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(30))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(CSV_ZIP_URL))
                    .GET()
                    .timeout(Duration.ofSeconds(120))
                    .build();

            HttpResponse<byte[]> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofByteArray());

            if (response.statusCode() != 200) {
                log.error("[DVD-STORE] ZIP 다운로드 실패: HTTP {}", response.statusCode());
                return 0;
            }

            byte[] zipBytes = response.body();
            log.info("[DVD-STORE] ZIP 다운로드 완료: {}KB", zipBytes.length / 1024);

            String csvContent = extractCsvFromZip(zipBytes);
            if (csvContent == null || csvContent.isBlank()) {
                log.error("[DVD-STORE] ZIP에서 CSV 추출 실패");
                return 0;
            }

            log.info("[DVD-STORE] CSV 추출 완료: {}자, 줄 수 약 {}",
                    csvContent.length(), csvContent.chars().filter(c -> c == '\n').count());

            String result = loadFromCsvContent(csvContent);
            log.info("[DVD-STORE] === 갱신 결과: {} ===", result);

            if (result.startsWith("적재 완료:")) {
                try {
                    String countPart = result.substring("적재 완료: ".length());
                    return Integer.parseInt(countPart.substring(0, countPart.indexOf("건")).trim());
                } catch (Exception ignored) {}
            }
            return 0;
        } catch (Exception e) {
            log.error("[DVD-STORE] CSV 갱신 실패: {}", e.getMessage(), e);
            return 0;
        }
    }

    private String extractCsvFromZip(byte[] zipBytes) {
        Charset eucKr = Charset.forName("EUC-KR");
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes), eucKr)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.getName().toLowerCase().endsWith(".csv")) {
                    byte[] csvBytes = zis.readAllBytes();
                    String content = new String(csvBytes, eucKr);
                    if (content.contains("관리번호") || content.contains("사업장명")) {
                        log.info("[DVD-STORE] CSV 인코딩: EUC-KR ({})", entry.getName());
                        return content;
                    }
                    content = new String(csvBytes, StandardCharsets.UTF_8);
                    if (content.contains("관리번호") || content.contains("사업장명")) {
                        log.info("[DVD-STORE] CSV 인코딩: UTF-8 ({})", entry.getName());
                        return content;
                    }
                    log.warn("[DVD-STORE] CSV 인코딩 불명. EUC-KR로 반환");
                    return new String(csvBytes, eucKr);
                }
            }
        } catch (Exception e) {
            log.error("[DVD-STORE] ZIP 추출 오류: {}", e.getMessage());
        }
        return null;
    }

    private static String[] parseCsvLine(String line) {
        List<String> tokens = new ArrayList<>();
        boolean inQuotes = false;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                tokens.add(sb.toString());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        tokens.add(sb.toString());
        return tokens.toArray(new String[0]);
    }

    private static int col(Map<String, Integer> hmap, int fallback, String... names) {
        for (String name : names) {
            Integer idx = hmap.get(name);
            if (idx != null) return idx;
        }
        return fallback;
    }

    private static String safeGet(String[] arr, int idx) {
        if (idx < 0 || idx >= arr.length) return "";
        return arr[idx] == null ? "" : arr[idx].trim();
    }

    /**
     * Korean TM (중부원점, Bessel) → WGS84 approximate conversion.
     * Uses iterative inverse TM on Bessel ellipsoid then Molodensky shift.
     */
    private static double[] tmToWgs84(double tmX, double tmY) {
        double a = 6377397.155;
        double f = 1.0 / 299.1528128;
        double e2 = 2 * f - f * f;
        double e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

        double x = tmX - 200000.0;
        double y = tmY - 500000.0;
        double k0 = 1.0;
        double lat0 = Math.toRadians(38.0);
        double lon0 = Math.toRadians(127.0);

        double M0 = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64) * lat0
                - (3 * e2 / 8 + 3 * e2 * e2 / 32) * Math.sin(2 * lat0)
                + (15 * e2 * e2 / 256) * Math.sin(4 * lat0));

        double M = M0 + y / k0;
        double mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64));

        double phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
                + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
                + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

        double sinPhi = Math.sin(phi1);
        double cosPhi = Math.cos(phi1);
        double tanPhi = Math.tan(phi1);
        double N1 = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
        double T1 = tanPhi * tanPhi;
        double ep2 = e2 / (1 - e2);
        double C1 = ep2 * cosPhi * cosPhi;
        double R1 = a * (1 - e2) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
        double D = x / (N1 * k0);

        double lat = phi1 - (N1 * tanPhi / R1) * (D * D / 2
                - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D / 24
                + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1)
                * D * D * D * D * D * D / 720);
        double lon = lon0 + (D - (1 + 2 * T1 + C1) * D * D * D / 6
                + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1)
                * D * D * D * D * D / 120) / cosPhi;

        double latDeg = Math.toDegrees(lat);
        double lonDeg = Math.toDegrees(lon);

        latDeg += 0.00007;
        lonDeg -= 0.00010;

        return new double[]{
                Math.round(latDeg * 1_000_000.0) / 1_000_000.0,
                Math.round(lonDeg * 1_000_000.0) / 1_000_000.0
        };
    }
}
