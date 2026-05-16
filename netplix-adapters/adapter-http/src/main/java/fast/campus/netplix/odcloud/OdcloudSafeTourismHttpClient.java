package fast.campus.netplix.odcloud;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.SafeTourismPage;
import fast.campus.netplix.tour.SafeTourismPort;
import fast.campus.netplix.tour.SafeTourismSpot;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 한국관광공사 비대면 안심관광지 목록(api.odcloud.kr).
 *
 * <p>활용신청 후 data.go.kr 마이페이지에서 복사한 End Point URL 을
 * {@code ODCLOUD_SAFE_TOURISM_LIST_URL} 로 설정한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OdcloudSafeTourismHttpClient implements SafeTourismPort {

    private final HttpClient httpClient;

    @Value("${odcloud.auth.service-key:}")
    private String serviceKey;

    @Value("${odcloud.safe-tourism.list-url:}")
    private String listUrl;

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank()
                && listUrl != null && !listUrl.isBlank();
    }

    @Override
    public SafeTourismPage fetchPage(int page, int perPage) {
        if (!isConfigured()) {
            log.warn("[ODCLOUD-SAFE] serviceKey/list-url 미설정");
            return emptyPage(page, perPage);
        }
        int p = Math.max(1, page);
        int pp = Math.min(Math.max(1, perPage), 50);
        try {
            String url = listUrl
                    + (listUrl.contains("?") ? "&" : "?")
                    + "page=" + p
                    + "&perPage=" + pp
                    + "&serviceKey=" + URLEncoder.encode(serviceKey.trim(), StandardCharsets.UTF_8);
            String body = httpClient.requestUri(URI.create(url), HttpMethod.GET, new HttpHeaders());
            if (body == null || body.isBlank()) {
                return emptyPage(p, pp);
            }
            OdcloudSafeTourismResponse parsed =
                    ObjectMapperUtil.toObject(body, OdcloudSafeTourismResponse.class);
            if (parsed == null || parsed.getData() == null) {
                return emptyPage(p, pp);
            }
            List<SafeTourismSpot> items = parsed.getData().stream()
                    .map(OdcloudSafeTourismHttpClient::toDomain)
                    .filter(s -> s.getName() != null && !s.getName().isBlank())
                    .toList();
            return SafeTourismPage.builder()
                    .items(items)
                    .page((int) parsed.getPage())
                    .perPage((int) parsed.getPerPage())
                    .totalCount(parsed.getTotalCount())
                    .build();
        } catch (Exception e) {
            log.warn("[ODCLOUD-SAFE] fetch failed page={} perPage={}: {}", p, pp, e.getMessage());
            return emptyPage(p, pp);
        }
    }

    private static SafeTourismPage emptyPage(int page, int perPage) {
        return SafeTourismPage.builder()
                .items(List.of())
                .page(page)
                .perPage(perPage)
                .totalCount(0)
                .build();
    }

    private static SafeTourismSpot toDomain(OdcloudSafeTourismResponse.OdcloudSafeTourismItem i) {
        String name = firstNonBlank(
                i.getSpotName(),
                i.getContentName(),
                i.getInfoName());
        String area = firstNonBlank(i.getAreaName(), i.getSidoName(), i.getRegion());
        String signgu = firstNonBlank(i.getSignguName(), i.getSigngu());
        String detail = firstNonBlank(
                i.getDetailUrl(),
                i.getArticleDetailUrl(),
                i.getHomepage(),
                i.getContentUrl());
        String image = firstNonBlank(i.getImageUrl(), i.getImageUrlAlt());
        String intro = firstNonBlank(i.getIntro(), i.getIntroText());
        String season = firstNonBlank(i.getSeason(), i.getSeasonType());
        String theme = firstNonBlank(i.getTheme(), i.getThemeEnv());
        String id = firstNonBlank(i.getContentId(), i.getSpotId(), name);

        return SafeTourismSpot.builder()
                .id(trim(id))
                .name(trim(name))
                .areaName(trim(area))
                .signguName(trim(signgu))
                .address(trim(i.getAddress()))
                .season(trim(season))
                .theme(trim(theme))
                .intro(trim(intro))
                .detailUrl(trim(detail))
                .imageUrl(trim(image))
                .latitude(parseDouble(firstNonBlank(i.getLatitude(), i.getMapY())))
                .longitude(parseDouble(firstNonBlank(i.getLongitude(), i.getMapX())))
                .build();
    }

    private static Double parseDouble(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) return null;
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
