package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 공공데이터 GW 에서 {@code items.item} 이 단일 객체 또는 배열로 오는 경우를 동시에 처리한다.
 * 한 번만 건너뛰면 전체 언어가 빈 목록으로 보일 수 있다.
 */
final class OdiiItemsItemDeserializer extends JsonDeserializer<List<VisitKoreaOdiiResponse.Item>> {

    @Override
    public List<VisitKoreaOdiiResponse.Item> deserialize(JsonParser p, DeserializationContext ctxt)
            throws IOException {
        ObjectMapper mapper = (ObjectMapper) p.getCodec();
        JsonNode node = mapper.readTree(p);
        if (node == null || node.isNull() || node.isMissingNode()) {
            return List.of();
        }
        List<VisitKoreaOdiiResponse.Item> out = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode el : node) {
                VisitKoreaOdiiResponse.Item row = mapper.treeToValue(el, VisitKoreaOdiiResponse.Item.class);
                if (row != null) {
                    out.add(row);
                }
            }
        } else if (node.isObject()) {
            VisitKoreaOdiiResponse.Item row = mapper.treeToValue(node, VisitKoreaOdiiResponse.Item.class);
            if (row != null) {
                out.add(row);
            }
        }
        return out;
    }
}
