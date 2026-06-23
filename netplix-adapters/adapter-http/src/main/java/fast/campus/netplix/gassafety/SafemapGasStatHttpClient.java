package fast.campus.netplix.gassafety;

import fast.campus.netplix.client.HttpClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 행정안전부 생활안전지도 가스사고발생통계(IF_0064) HTTP 어댑터.
 *
 * <p>외부: {@code https://www.safemap.go.kr/openapi2/IF_0064?serviceKey=..&returnType=XML}
 *
 * <p>응답 스키마(실제 확인): 각 {@code <item>} 은 가스사고 1건(objt_id 고유)이며 읍면동/지번 단위 레코드다.
 * 주요 필드:
 * <ul>
 *   <li>{@code ctprvn_nm} 시도명 · {@code sgg_nm} 시군구명 · {@code emd_nm} 읍면동명</li>
 *   <li>{@code tot} 사상자 합계(= {@code death}+{@code injpsn}) · {@code death} 사망 · {@code injpsn} 부상</li>
 * </ul>
 * 따라서 <b>시군구 발생건수 = 해당 시군구 item 개수</b>, <b>피해(사상자) = tot 합계</b> 로 집계한다.
 *
 * <p>전체 건수는 {@code totalCount}(약 5천 건)이고 한 페이지 최대 1000건이라 페이지네이션으로 모두 수집한다.
 * 통계는 자주 바뀌지 않아 24h in-memory 캐시. 키 미등록·필드 불일치 시 빈 목록으로 자연 degrade.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SafemapGasStatHttpClient implements GasAccidentStatPort {

    private static final long CACHE_TTL_MS = 24L * 60 * 60 * 1000;
    private static final int ROWS_PER_PAGE = 1000; // 서버가 페이지당 1000건으로 캡함
    private static final int MAX_PAGES = 12;        // 안전장치(약 5천 건 → 6페이지면 충분)
    private static final com.fasterxml.jackson.databind.ObjectMapper OBJECT_MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private final HttpClient httpClient;

    @Value("${safemap.gas-accident.base-url:https://www.safemap.go.kr/openapi2/IF_0064}")
    private String baseUrl;

    @Value("${safemap.gas-accident.api-key:}")
    private String apiKey;

    private volatile List<GasAccidentStat> cache;
    private volatile long cachedAtMs;

    @Override
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank() && baseUrl != null && !baseUrl.isBlank();
    }

    @Override
    public List<GasAccidentStat> fetchSigunguStats() {
        if (!isConfigured()) {
            log.debug("[GAS-STAT] 미설정 - 빈 결과 반환");
            return List.of();
        }
        long now = Instant.now().toEpochMilli();
        List<GasAccidentStat> cached = cache;
        if (cached != null && now - cachedAtMs < CACHE_TTL_MS) {
            return cached;
        }
        List<GasAccidentStat> fetched = normalizeAllStats(fetchAllAndAggregate());
        if (!fetched.isEmpty() && !regionsLookValid(fetched)) {
            log.warn("[GAS-STAT] 라이브 응답 한글 손상(인코딩 오류) — 스냅샷으로 폴백");
            fetched = List.of();
        }
        if (fetched.isEmpty()) {
            // safemap 은 해외(클라우드) IP 의 연결을 막는다(Connection reset). 따라서 운영 서버(미국)에서는
            // 라이브 호출이 실패하므로, 내장 스냅샷(연 1회 갱신 데이터를 한국 IP 에서 미리 수집·집계)으로 fallback.
            // 한국 IP 에서 실행되면 라이브 결과가 우선한다.
            fetched = loadSnapshot();
        }
        if (!fetched.isEmpty()) {
            cache = fetched;
            cachedAtMs = now;
        }
        return fetched;
    }

    /** 클래스패스에 내장된 시군구 집계 스냅샷(JSON)을 로드한다. */
    private List<GasAccidentStat> loadSnapshot() {
        try (java.io.InputStream is = getClass().getResourceAsStream("/gas-accident-sigungu-snapshot.json")) {
            if (is == null) {
                log.warn("[GAS-STAT] 스냅샷 리소스 없음");
                return List.of();
            }
            com.fasterxml.jackson.databind.JsonNode arr = OBJECT_MAPPER.readTree(is);
            List<GasAccidentStat> out = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode n : arr) {
                String region = n.path("region").asText(null);
                if (region == null || region.isBlank()) continue;
                int count = n.path("count").asInt(0);
                int cas = n.path("casualties").asInt(0);
                Double lat = n.hasNonNull("lat") ? n.path("lat").asDouble() : null;
                Double lon = n.hasNonNull("lon") ? n.path("lon").asDouble() : null;
                out.add(new GasAccidentStat(region, count, cas, lat, lon));
            }
            out.sort(Comparator.comparingInt(GasAccidentStat::accidentCount).reversed());
            log.info("[GAS-STAT] 스냅샷 {}개 시군구 로드", out.size());
            return normalizeAllStats(out);
        } catch (Exception e) {
            log.warn("[GAS-STAT] 스냅샷 로드 실패: {}", e.getMessage());
            return List.of();
        }
    }

    /** 전 페이지를 순회하며 시군구별로 발생건수·사상자·중심좌표를 누적한 뒤 발생건수 내림차순 정렬해 반환. */
    private List<GasAccidentStat> fetchAllAndAggregate() {
        // region -> [accidentCount, casualtySum, sumLat, sumLon, nCoords]
        Map<String, double[]> agg = new LinkedHashMap<>();
        int page = 1;
        int totalCount = Integer.MAX_VALUE;
        int collected = 0;

        while (page <= MAX_PAGES) {
            String xml = call(page);
            if (xml == null || xml.isBlank()) break;

            PageResult pr;
            try {
                pr = parsePage(xml, agg);
            } catch (Exception ex) {
                log.warn("[GAS-STAT] 파싱 실패(page={}): {}", page, ex.getMessage());
                break;
            }
            if (pr.error) break;          // resultCode != 00
            if (pr.totalCount >= 0) totalCount = pr.totalCount;
            if (pr.itemCount == 0) break; // 더 이상 없음

            collected += pr.itemCount;
            if (collected >= totalCount) break;
            page++;
        }

        List<GasAccidentStat> out = new ArrayList<>(agg.size());
        for (Map.Entry<String, double[]> e : agg.entrySet()) {
            double[] v = e.getValue();
            Double lat = v[4] > 0 ? round5(v[2] / v[4]) : null;
            Double lon = v[4] > 0 ? round5(v[3] / v[4]) : null;
            out.add(new GasAccidentStat(e.getKey(), (int) v[0], (int) v[1], lat, lon));
        }
        out.sort(Comparator.comparingInt(GasAccidentStat::accidentCount).reversed());
        log.info("[GAS-STAT] 시군구 {}개 집계(수집 {}건)", out.size(), collected);
        return out;
    }

    private static Double round5(double v) {
        return Math.round(v * 100000.0) / 100000.0;
    }

    /** EPSG:3857(Web Mercator) → WGS84 위도. */
    private static double mercToLat(double y) {
        return Math.toDegrees(Math.atan(Math.exp(y / 6378137.0)) * 2.0 - Math.PI / 2.0);
    }

    /** EPSG:3857(Web Mercator) → WGS84 경도. */
    private static double mercToLon(double x) {
        return x / 20037508.34 * 180.0;
    }

    private String call(int pageNo) {
        String url = baseUrl
                + (baseUrl.contains("?") ? "&" : "?")
                + "serviceKey=" + apiKey
                + "&returnType=XML"
                + "&numOfRows=" + ROWS_PER_PAGE
                + "&pageNo=" + pageNo;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/xml");
            ResponseEntity<byte[]> res = httpClient.requestUriBytes(URI.create(url), HttpMethod.GET, headers);
            byte[] body = res.getBody();
            if (body == null || body.length == 0) {
                return null;
            }
            return decodeSafemapXml(body, res.getHeaders());
        } catch (Exception ex) {
            log.warn("[GAS-STAT] 호출 실패(page={}): {}", pageNo, ex.getMessage());
            return null;
        }
    }

    /**
     * safemap XML 응답 charset 을 올바르게 고른다.
     * RestTemplate String 변환은 Content-Type/본문 인코딩을 놓치면 한글이 깨진 채로 파싱된다.
     */
    private static String decodeSafemapXml(byte[] b, HttpHeaders headers) {
        Charset fromHeader = charsetFromContentType(headers);
        if (fromHeader != null) {
            return new String(b, fromHeader);
        }
        Charset fromXml = encodingFromXmlDeclaration(b);
        if (fromXml != null) {
            String decoded = new String(b, fromXml);
            if (containsHangul(decoded)) {
                return decoded;
            }
        }
        String utf8 = new String(b, StandardCharsets.UTF_8);
        if (containsHangul(utf8)) {
            return utf8;
        }
        try {
            Charset euc = Charset.forName("EUC-KR");
            String eucKr = new String(b, euc);
            if (containsHangul(eucKr)) {
                return eucKr;
            }
        } catch (Exception ignored) {
            /* EUC-KR 미지원 JVM — UTF-8 그대로 */
        }
        return utf8;
    }

    private static Charset charsetFromContentType(HttpHeaders headers) {
        MediaType mt = headers.getContentType();
        if (mt == null) {
            return null;
        }
        return mt.getCharset();
    }

    /** {@code <?xml ... encoding="UTF-8"?>} 선두에서 charset 추출. */
    private static Charset encodingFromXmlDeclaration(byte[] b) {
        int len = Math.min(b.length, 256);
        String head = new String(b, 0, len, StandardCharsets.US_ASCII).toLowerCase();
        int encIdx = head.indexOf("encoding=");
        if (encIdx < 0) {
            return null;
        }
        int q = head.indexOf('"', encIdx);
        if (q < 0) {
            return null;
        }
        int q2 = head.indexOf('"', q + 1);
        if (q2 < 0) {
            return null;
        }
        String enc = head.substring(q + 1, q2).trim();
        if (enc.isEmpty()) {
            return null;
        }
        try {
            return Charset.forName(enc);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean containsHangul(String s) {
        if (s == null || s.isEmpty()) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0xAC00 && c <= 0xD7A3) {
                return true;
            }
        }
        return false;
    }

    /** 행정구역명처럼 보이는지(한글 + 시·군·구·도 등). EUC-KR 오해 디코딩의 가짜 한글은 걸러낸다. */
    private static boolean looksLikeKoreanAdminName(String s) {
        if (s == null || !containsHangul(s)) {
            return false;
        }
        if (s.contains("특별") || s.contains("광역")) {
            return true;
        }
        return s.endsWith("시") || s.endsWith("군") || s.endsWith("구") || s.endsWith("도");
    }

    /**
     * UTF-8 바이트를 ISO-8859-1 로 잘못 읽어 생긴 mojibake 복구.
     * (RestTemplate String 변환·잘못된 XML charset 시 흔함)
     */
    private static String normalizeRegionName(String raw) {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        String trimmed = raw.trim();
        if (looksLikeKoreanAdminName(trimmed)) {
            return trimmed;
        }
        try {
            String fixed = new String(trimmed.getBytes(StandardCharsets.ISO_8859_1), StandardCharsets.UTF_8);
            if (looksLikeKoreanAdminName(fixed)) {
                return fixed;
            }
        } catch (Exception ignored) {
            /* ISO-8859-1 미지원 JVM — 원문 유지 */
        }
        return trimmed;
    }

    private static List<GasAccidentStat> normalizeAllStats(List<GasAccidentStat> stats) {
        if (stats == null || stats.isEmpty()) {
            return stats == null ? List.of() : stats;
        }
        List<GasAccidentStat> out = new ArrayList<>(stats.size());
        for (GasAccidentStat s : stats) {
            out.add(new GasAccidentStat(
                    normalizeRegionName(s.regionName()),
                    s.accidentCount(),
                    s.casualtyCount(),
                    s.centerLat(),
                    s.centerLon()));
        }
        return out;
    }

    /** 집계 결과에 한글 시군구명이 포함되는지 검사(인코딩 오류 조기 감지). */
    private static boolean regionsLookValid(List<GasAccidentStat> stats) {
        if (stats == null || stats.isEmpty()) {
            return false;
        }
        int checked = Math.min(5, stats.size());
        int valid = 0;
        for (int i = 0; i < checked; i++) {
            if (looksLikeKoreanAdminName(stats.get(i).regionName())) {
                valid++;
            }
        }
        return valid >= Math.max(1, checked / 2);
    }

    private record PageResult(int totalCount, int itemCount, boolean error) { }

    /** 한 페이지 XML 을 파싱해 agg 에 누적하고, totalCount/itemCount/오류여부를 돌려준다. */
    private PageResult parsePage(String xml, Map<String, double[]> agg) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        dbf.setExpandEntityReferences(false);
        try {
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        } catch (Exception ignore) {
            /* 일부 파서 미지원 — secure processing 으로 충분 */
        }
        DocumentBuilder db = dbf.newDocumentBuilder();
        Document doc = db.parse(new InputSource(new StringReader(xml)));

        String resultCode = firstTagText(doc, "resultCode");
        if (resultCode != null && !(resultCode.equals("00") || resultCode.equals("0") || resultCode.equals("000"))) {
            log.warn("[GAS-STAT] API 오류 resultCode={} msg={}", resultCode, firstTagText(doc, "resultMsg"));
            return new PageResult(-1, 0, true);
        }

        Integer totalCount = toInt(firstTagText(doc, "totalCount"));

        NodeList items = doc.getElementsByTagName("item");
        int itemCount = 0;
        for (int i = 0; i < items.getLength(); i++) {
            Node node = items.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) continue;
            Map<String, String> f = childFields((Element) node);
            if (f.isEmpty()) continue;
            itemCount++;

            String region = extractRegion(f);
            if (region == null || region.isBlank()) continue;

            // 사상자 합계: tot 우선, 없으면 death+injpsn.
            Integer tot = toInt(f.get("tot"));
            int casualty = tot != null ? tot : (orZero(toInt(f.get("death"))) + orZero(toInt(f.get("injpsn"))));

            double[] cur = agg.computeIfAbsent(region, k -> new double[]{0, 0, 0, 0, 0});
            cur[0] += 1;          // 발생건수 = 레코드 1건
            cur[1] += casualty;   // 피해(사상자)

            // 중심좌표 누적: x/y 는 EPSG:3857 → WGS84 로 변환해 합산(나중에 평균).
            Double x = toDouble(f.get("x"));
            Double y = toDouble(f.get("y"));
            if (x != null && y != null) {
                cur[2] += mercToLat(y);
                cur[3] += mercToLon(x);
                cur[4] += 1;
            }
        }
        return new PageResult(totalCount == null ? -1 : totalCount, itemCount, false);
    }

    /** item 직속 자식 엘리먼트들을 (소문자 태그명 → 텍스트) 맵으로. */
    private static Map<String, String> childFields(Element item) {
        Map<String, String> map = new LinkedHashMap<>();
        NodeList children = item.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node c = children.item(i);
            if (c.getNodeType() != Node.ELEMENT_NODE) continue;
            String name = c.getNodeName();
            if (name == null) continue;
            String text = c.getTextContent();
            map.put(name.toLowerCase(), text == null ? "" : text.trim());
        }
        return map;
    }

    /** ctprvn_nm(시도) + sgg_nm(시군구) 조합. 표준 필드가 없으면 지명처럼 보이는 값으로 폴백. */
    private static String extractRegion(Map<String, String> f) {
        String sido = f.getOrDefault("ctprvn_nm", "").trim();
        String sigungu = f.getOrDefault("sgg_nm", "").trim();

        if (sigungu.isEmpty()) {
            for (String v : f.values()) {
                if (looksLikeSigungu(v)) { sigungu = v.trim(); break; }
            }
        }
        if (sido.isEmpty()) {
            for (String v : f.values()) {
                if (looksLikeSido(v)) { sido = v.trim(); break; }
            }
        }

        if (!sigungu.isEmpty() && !sido.isEmpty()) {
            return normalizeRegionName(sigungu.startsWith(sido) ? sigungu : (sido + " " + sigungu));
        }
        if (!sigungu.isEmpty()) return normalizeRegionName(sigungu);
        if (!sido.isEmpty()) return normalizeRegionName(sido);
        return null;
    }

    private static boolean looksLikeSido(String v) {
        if (v == null) return false;
        String s = v.trim();
        return s.endsWith("특별시") || s.endsWith("광역시") || s.endsWith("특별자치시")
                || s.endsWith("특별자치도") || (s.endsWith("도") && s.length() <= 4);
    }

    private static boolean looksLikeSigungu(String v) {
        if (v == null) return false;
        String s = v.trim();
        if (s.isEmpty() || looksLikeSido(s)) return false;
        if (s.matches(".*\\d.*")) return false; // 코드/숫자 제외
        return s.endsWith("시") || s.endsWith("군") || s.endsWith("구");
    }

    private static int orZero(Integer v) {
        return v == null ? 0 : v;
    }

    private static Integer toInt(String raw) {
        if (raw == null) return null;
        String digits = raw.replaceAll("[,\\s]", "");
        if (digits.isEmpty() || !digits.matches("-?\\d+")) return null;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Double toDouble(String raw) {
        if (raw == null) return null;
        String s = raw.replaceAll("[,\\s]", "");
        if (s.isEmpty()) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String firstTagText(Document doc, String tag) {
        NodeList nl = doc.getElementsByTagName(tag);
        if (nl.getLength() == 0) return null;
        String t = nl.item(0).getTextContent();
        return t == null ? null : t.trim();
    }
}
