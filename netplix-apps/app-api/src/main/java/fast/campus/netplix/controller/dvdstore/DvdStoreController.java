package fast.campus.netplix.controller.dvdstore;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.dvdstore.DvdStore;
import fast.campus.netplix.dvdstore.DvdStoreRegionStat;
import fast.campus.netplix.dvdstore.DvdStoreUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/dvd-stores")
@RequiredArgsConstructor
public class DvdStoreController {

    private final DvdStoreUseCase dvdStoreUseCase;

    @GetMapping
    public NetplixApiResponse<List<DvdStore>> getOperatingStores() {
        return NetplixApiResponse.ok(dvdStoreUseCase.getOperatingStores());
    }

    @GetMapping("/all")
    public NetplixApiResponse<List<DvdStore>> getAllStores() {
        return NetplixApiResponse.ok(dvdStoreUseCase.getAllStores());
    }

    @GetMapping("/search")
    public NetplixApiResponse<List<DvdStore>> search(@RequestParam String keyword) {
        return NetplixApiResponse.ok(dvdStoreUseCase.search(keyword));
    }

    @GetMapping("/nearby")
    public NetplixApiResponse<List<DvdStore>> nearby(
            @RequestParam double lat,
            @RequestParam double lon,
            @RequestParam(defaultValue = "10") double radius) {
        return NetplixApiResponse.ok(dvdStoreUseCase.findNearby(lat, lon, radius));
    }

    @GetMapping("/count")
    public NetplixApiResponse<Map<String, Long>> count() {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("total", dvdStoreUseCase.getStoreCount());
        return NetplixApiResponse.ok(result);
    }

    @GetMapping("/stats/by-region")
    public NetplixApiResponse<List<DvdStoreRegionStat>> statsByRegion() {
        return NetplixApiResponse.ok(dvdStoreUseCase.getRegionStats());
    }

    @PostMapping("/load-csv")
    public NetplixApiResponse<String> loadCsv(@RequestParam("file") MultipartFile file,
                                               @RequestParam(value = "encoding", defaultValue = "UTF-8") String encoding) {
        try {
            byte[] raw = file.getBytes();
            log.info("[DVD-STORE] 업로드 파일 크기: {} bytes", raw.length);
            int offset = 0;
            if (raw.length >= 3 && raw[0] == (byte) 0xEF && raw[1] == (byte) 0xBB && raw[2] == (byte) 0xBF) {
                offset = 3;
                log.info("[DVD-STORE] BOM 감지, 3바이트 스킵");
            }
            Charset charset = encoding.equalsIgnoreCase("EUC-KR")
                    ? Charset.forName("EUC-KR")
                    : StandardCharsets.UTF_8;
            String content = new String(raw, offset, raw.length - offset, charset);
            log.info("[DVD-STORE] 문자열 길이: {}", content.length());
            String result = dvdStoreUseCase.loadFromCsvContent(content);
            return NetplixApiResponse.ok(result);
        } catch (Exception e) {
            log.error("[DVD-STORE] CSV 업로드 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("CSV 적재 실패: " + e.getMessage());
        }
    }

    @PostMapping(value = "/load-csv-text", consumes = "text/plain;charset=UTF-8")
    public NetplixApiResponse<String> loadCsvText(@RequestBody String content) {
        try {
            String result = dvdStoreUseCase.loadFromCsvContent(content);
            return NetplixApiResponse.ok(result);
        } catch (Exception e) {
            log.error("[DVD-STORE] CSV 텍스트 업로드 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("CSV 적재 실패: " + e.getMessage());
        }
    }

    @PostMapping(value = "/diag-csv", consumes = "text/plain;charset=UTF-8")
    public NetplixApiResponse<Map<String, Object>> diagCsv(@RequestBody String content) {
        Map<String, Object> diag = new LinkedHashMap<>();
        diag.put("contentLength", content.length());
        diag.put("startsWithBOM", content.startsWith("\uFEFF"));
        if (content.startsWith("\uFEFF")) content = content.substring(1);
        content = content.replace("\r\n", "\n").replace("\r", "\n");
        String[] lines = content.split("\n");
        diag.put("totalLines", lines.length);
        if (lines.length > 0) {
            diag.put("headerPreview", lines[0].substring(0, Math.min(200, lines[0].length())));
        }
        int hasManagement = 0, blankManagement = 0, tooFewCols = 0;
        for (int i = 1; i < lines.length; i++) {
            if (lines[i].isBlank()) continue;
            String[] cols = splitCsvSimple(lines[i]);
            if (cols.length < 2) { tooFewCols++; continue; }
            String mgmt = cols[1].trim();
            if (mgmt.isEmpty()) blankManagement++;
            else hasManagement++;
        }
        diag.put("hasManagement", hasManagement);
        diag.put("blankManagement", blankManagement);
        diag.put("tooFewCols", tooFewCols);
        if (lines.length > 1) {
            String[] sample = splitCsvSimple(lines[1]);
            diag.put("sampleLine1_colCount", sample.length);
            diag.put("sampleLine1_col0", sample.length > 0 ? sample[0].substring(0, Math.min(30, sample[0].length())) : "");
            diag.put("sampleLine1_col1", sample.length > 1 ? sample[1].substring(0, Math.min(50, sample[1].length())) : "");
        }
        return NetplixApiResponse.ok(diag);
    }

    private static String[] splitCsvSimple(String line) {
        List<String> tokens = new java.util.ArrayList<>();
        boolean inQ = false;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') inQ = !inQ;
            else if (c == ',' && !inQ) { tokens.add(sb.toString()); sb.setLength(0); }
            else sb.append(c);
        }
        tokens.add(sb.toString());
        return tokens.toArray(new String[0]);
    }
}
