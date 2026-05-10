package fast.campus.netplix.kma;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * {@code FcstZoneInfoService/getFcstZoneCd} XML 응답 파싱.
 */
public final class KmaFcstZoneInfoXmlParser {

    private KmaFcstZoneInfoXmlParser() {}

    public static Optional<FcstZoneCdParse> parse(String xml) {
        if (xml == null || xml.isBlank()) {
            return Optional.empty();
        }
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(false);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            Document doc =
                    f.newDocumentBuilder()
                            .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

            String resultCode = textFirst(doc, "resultCode");
            String resultMsg = textFirst(doc, "resultMsg");

            NodeList itemNodes = doc.getElementsByTagName("item");
            List<Map<String, Object>> items = new ArrayList<>();
            for (int i = 0; i < itemNodes.getLength(); i++) {
                Node n = itemNodes.item(i);
                if (!(n instanceof Element el)) {
                    continue;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                putText(row, el, "regId");
                putDouble(row, el, "lat");
                putDouble(row, el, "lon");
                putText(row, el, "regEn");
                putText(row, el, "regName");
                putText(row, el, "regSp");
                putText(row, el, "regUp");
                putLong(row, el, "seq");
                putLong(row, el, "stnF3");
                putText(row, el, "tmEd");
                putText(row, el, "tmSt");
                if (!row.isEmpty()) {
                    items.add(row);
                }
            }

            Integer pageNo = intFirst(doc, "pageNo");
            Integer numOfRows = intFirst(doc, "numOfRows");
            Integer totalCount = intFirst(doc, "totalCount");

            return Optional.of(new FcstZoneCdParse(resultCode, resultMsg, items, pageNo, numOfRows, totalCount));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static String textFirst(Document doc, String tag) {
        NodeList nl = doc.getElementsByTagName(tag);
        if (nl.getLength() == 0) {
            return null;
        }
        return nl.item(0).getTextContent() != null ? nl.item(0).getTextContent().trim() : null;
    }

    private static Integer intFirst(Document doc, String tag) {
        String t = textFirst(doc, tag);
        if (t == null || t.isEmpty()) {
            return null;
        }
        try {
            return Integer.parseInt(t.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void putText(Map<String, Object> row, Element parent, String tag) {
        NodeList nl = parent.getElementsByTagName(tag);
        if (nl.getLength() == 0) {
            return;
        }
        String v = nl.item(0).getTextContent();
        if (v != null && !v.isBlank()) {
            row.put(tag, v.trim());
        }
    }

    private static void putDouble(Map<String, Object> row, Element parent, String tag) {
        NodeList nl = parent.getElementsByTagName(tag);
        if (nl.getLength() == 0) {
            return;
        }
        String v = nl.item(0).getTextContent();
        if (v == null || v.isBlank()) {
            return;
        }
        try {
            row.put(tag, Double.parseDouble(v.trim()));
        } catch (NumberFormatException ignored) {
            row.put(tag, v.trim());
        }
    }

    private static void putLong(Map<String, Object> row, Element parent, String tag) {
        NodeList nl = parent.getElementsByTagName(tag);
        if (nl.getLength() == 0) {
            return;
        }
        String v = nl.item(0).getTextContent();
        if (v == null || v.isBlank()) {
            return;
        }
        try {
            row.put(tag, Long.parseLong(v.trim()));
        } catch (NumberFormatException ignored) {
            row.put(tag, v.trim());
        }
    }

    /** getFcstZoneCd 파싱 결과 */
    public record FcstZoneCdParse(
            String resultCode,
            String resultMsg,
            List<Map<String, Object>> items,
            Integer pageNo,
            Integer numOfRows,
            Integer totalCount) {

        public boolean isOk() {
            return "00".equals(resultCode);
        }
    }
}
