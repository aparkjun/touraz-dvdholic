package fast.campus.netplix.gassafety;

import fast.campus.netplix.client.HttpClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
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
 *  - 응답 XML 의 각 {@code <item>} 를 읽어 "시군구 명칭 + 발생건수"로 환원한다.
 *  - 통계는 자주 바뀌지 않아 24h in-memory 캐시.
 *
 * <p>주의: IF_0064 의 출력 필드명이 공개 명세에서 확정되지 않아, 태그명/값 패턴 기반의
 * 방어적 파싱을 한다(시도/시군구로 보이는 텍스트 + 발생건수로 보이는 정수 추출).
 * 키 미등록·필드 불일치 시 빈 목록으로 자연 degrade 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SafemapGasStatHttpClient implements GasAccidentStatPort {

    private static final long CACHE_TTL_MS = 24L * 60 * 60 * 1000;
    private static final int NUM_OF_ROWS = 5000;

    /** 발생건수로 우선 채택할 태그명 힌트(소문자 비교). */
    private static final String[] COUNT_HINTS = {
            "발생건수", "사고건수", "건수", "발생", "occr", "acdnt", "accident", "cnt", "count", "case", "ocrn"
    };
    /** 발생건수 후보에서 제외할 태그명 힌트(연도/월/코드/좌표 등). */
    private static final String[] COUNT_EXCLUDE = {
            "year", "연도", "yyyy", "prd", "기간", "month", "월", "code", "cd", "seq", "gid",
            "lat", "lon", "경도", "위도", "mapx", "mapy", "_x", "_y", "id", "rnum", "no"
    };
    /** 인명피해(사상)로 채택할 태그명 힌트. */
    private static final String[] CASUALTY_HINTS = {
            "피해", "사상", "부상", "사망", "인명", "casualt", "injur", "death", "dmg", "dead", "wound", "cas"
    };
    /** 시군구 명칭으로 볼 태그명 힌트. */
    private static final String[] SIGUNGU_HINTS = {
            "sgg", "sigungu", "signgu", "sig", "시군구", "gugun", "gun", "gu_nm"
    };
    /** 시도 명칭으로 볼 태그명 힌트. */
    private static final String[] SIDO_HINTS = {
            "sido", "ctprvn", "ctp", "시도", "sd_nm", "do_nm", "metro"
    };

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
        List<GasAccidentStat> fetched = callAndParse();
        if (!fetched.isEmpty()) {
            cache = fetched;
            cachedAtMs = now;
        }
        return fetched;
    }

    private List<GasAccidentStat> callAndParse() {
        String url = baseUrl
                + (baseUrl.contains("?") ? "&" : "?")
                + "serviceKey=" + apiKey
                + "&returnType=XML"
                + "&numOfRows=" + NUM_OF_ROWS
                + "&pageNo=1";

        String raw;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add(HttpHeaders.ACCEPT, "application/xml");
            raw = httpClient.requestUri(URI.create(url), HttpMethod.GET, headers);
        } catch (Exception ex) {
            log.warn("[GAS-STAT] 호출 실패: {}", ex.getMessage());
            return List.of();
        }
        if (raw == null || raw.isBlank()) {
            log.warn("[GAS-STAT] 빈 응답");
            return List.of();
        }
        try {
            return parse(raw);
        } catch (Exception ex) {
            log.warn("[GAS-STAT] 파싱 실패: {}", ex.getMessage());
            return List.of();
        }
    }

    private List<GasAccidentStat> parse(String xml) throws Exception {
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

        // 에러 응답(헤더 resultCode 가 정상 아님)이면 빈 목록.
        String resultMsg = firstTagText(doc, "resultMsg");
        String resultCode = firstTagText(doc, "resultCode");
        if (resultCode != null && !(resultCode.equals("00") || resultCode.equals("0") || resultCode.equals("000"))) {
            log.warn("[GAS-STAT] API 오류 resultCode={} msg={}", resultCode, resultMsg);
            return List.of();
        }

        NodeList items = doc.getElementsByTagName("item");
        if (items.getLength() == 0) {
            log.info("[GAS-STAT] item 없음 (msg={})", resultMsg);
            return List.of();
        }

        // 동일 시군구가 월별/장소별로 여러 행이면 합산.
        Map<String, int[]> agg = new LinkedHashMap<>(); // region -> [accidentSum, casualtySum, casualtySeen]
        for (int i = 0; i < items.getLength(); i++) {
            Node node = items.item(i);
            if (node.getNodeType() != Node.ELEMENT_NODE) continue;
            Map<String, String> fields = childFields((Element) node);
            if (fields.isEmpty()) continue;

            String region = extractRegion(fields);
            if (region == null || region.isBlank()) continue;

            Integer count = extractByHints(fields, COUNT_HINTS, COUNT_EXCLUDE, true);
            if (count == null) continue; // 발생건수를 못 찾으면 의미 없는 행 → 스킵
            Integer casualty = extractByHints(fields, CASUALTY_HINTS, new String[]{}, false);

            int[] cur = agg.computeIfAbsent(region, k -> new int[]{0, 0, 0});
            cur[0] += count;
            if (casualty != null) {
                cur[1] += casualty;
                cur[2] = 1;
            }
        }

        List<GasAccidentStat> out = new ArrayList<>(agg.size());
        for (Map.Entry<String, int[]> e : agg.entrySet()) {
            int[] v = e.getValue();
            out.add(new GasAccidentStat(e.getKey(), v[0], v[2] == 1 ? v[1] : null));
        }
        out.sort(Comparator.comparingInt(GasAccidentStat::accidentCount).reversed());
        log.info("[GAS-STAT] 시군구 {}건 파싱", out.size());
        return out;
    }

    /** item 의 직속 자식 엘리먼트들을 (소문자 태그명 → 텍스트) 맵으로. 원본 태그명도 별도 보관 키로 추가. */
    private static Map<String, String> childFields(Element item) {
        Map<String, String> map = new LinkedHashMap<>();
        NodeList children = item.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node c = children.item(i);
            if (c.getNodeType() != Node.ELEMENT_NODE) continue;
            String name = c.getNodeName();
            String text = c.getTextContent();
            if (name == null) continue;
            map.put(name.toLowerCase(), text == null ? "" : text.trim());
        }
        return map;
    }

    /** 시도 + 시군구 텍스트를 조합해 시군구 표기 생성. 힌트가 없으면 지명처럼 보이는 값으로 폴백. */
    private static String extractRegion(Map<String, String> fields) {
        String sido = pickRegionValue(fields, SIDO_HINTS);
        String sigungu = pickRegionValue(fields, SIGUNGU_HINTS);

        if (sigungu == null) {
            // 힌트 태그가 없으면, '시/군/구' 로 끝나는(또는 한글 지명) 값 중 시도형이 아닌 것을 시군구로.
            for (String v : fields.values()) {
                if (looksLikeSigungu(v)) {
                    sigungu = v;
                    break;
                }
            }
        }
        if (sido == null) {
            for (String v : fields.values()) {
                if (looksLikeSido(v)) {
                    sido = v;
                    break;
                }
            }
        }

        String s1 = sido == null ? "" : sido.trim();
        String s2 = sigungu == null ? "" : sigungu.trim();
        if (!s2.isEmpty() && !s1.isEmpty()) {
            // 시군구 값이 이미 시도를 포함하면 중복 제거.
            if (s2.startsWith(s1)) return s2;
            return s1 + " " + s2;
        }
        if (!s2.isEmpty()) return s2;
        if (!s1.isEmpty()) return s1;
        return null;
    }

    private static String pickRegionValue(Map<String, String> fields, String[] hints) {
        for (Map.Entry<String, String> e : fields.entrySet()) {
            String key = e.getKey();
            String val = e.getValue();
            if (val == null || val.isBlank()) continue;
            for (String h : hints) {
                if (key.contains(h)) {
                    return val;
                }
            }
        }
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
        // 숫자/코드 제외
        if (s.matches(".*\\d.*") && s.length() <= 6) return false;
        return s.endsWith("시") || s.endsWith("군") || s.endsWith("구");
    }

    /**
     * 태그명 힌트로 정수 값을 찾는다.
     * @param preferHinted true 면 힌트 매칭 필드를 우선 채택, 못 찾으면 숫자형 필드 중 첫째(연도/월/코드 제외).
     */
    private static Integer extractByHints(Map<String, String> fields, String[] hints, String[] exclude, boolean preferHinted) {
        // 1) 힌트 매칭 우선
        for (Map.Entry<String, String> e : fields.entrySet()) {
            String key = e.getKey();
            if (containsAny(key, exclude)) continue;
            if (!containsAny(key, hints)) continue;
            Integer n = toInt(e.getValue());
            if (n != null) return n;
        }
        if (!preferHinted) return null;
        // 2) 폴백: 연도/월/코드처럼 보이지 않는 첫 정수 필드
        for (Map.Entry<String, String> e : fields.entrySet()) {
            String key = e.getKey();
            if (containsAny(key, exclude)) continue;
            Integer n = toInt(e.getValue());
            if (n == null) continue;
            if (n >= 1900 && n <= 2100) continue; // 연도로 추정 → 제외
            return n;
        }
        return null;
    }

    private static boolean containsAny(String key, String[] hints) {
        for (String h : hints) {
            if (key.contains(h)) return true;
        }
        return false;
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

    private static String firstTagText(Document doc, String tag) {
        NodeList nl = doc.getElementsByTagName(tag);
        if (nl.getLength() == 0) return null;
        String t = nl.item(0).getTextContent();
        return t == null ? null : t.trim();
    }
}
