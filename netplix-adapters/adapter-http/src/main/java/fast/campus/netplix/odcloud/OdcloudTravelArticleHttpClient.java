package fast.campus.netplix.odcloud;

import fast.campus.netplix.client.HttpClient;
import fast.campus.netplix.tour.TravelArticle;
import fast.campus.netplix.tour.TravelArticlePage;
import fast.campus.netplix.tour.TravelArticlePort;
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
 * 한국관광공사 여행기사목록(공공데이터 15121757) — api.odcloud.kr.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OdcloudTravelArticleHttpClient implements TravelArticlePort {

    private final HttpClient httpClient;

    @Value("${odcloud.auth.service-key:}")
    private String serviceKey;

    @Value("${odcloud.travel-articles.list-url:https://api.odcloud.kr/api/15121757/v1/uddi:121ae064-ea9f-4213-80da-fcb97664e7e5}")
    private String listUrl;

    @Override
    public boolean isConfigured() {
        return serviceKey != null && !serviceKey.isBlank() && listUrl != null && !listUrl.isBlank();
    }

    @Override
    public TravelArticlePage fetchPage(int page, int perPage) {
        if (!isConfigured()) {
            log.warn("[ODCLOUD-TRAVEL] serviceKey/list-url 미설정");
            return emptyPage(page, perPage);
        }
        int p = Math.max(1, page);
        int pp = Math.min(Math.max(1, perPage), 50);
        try {
            String url = listUrl
                    + "?page=" + p
                    + "&perPage=" + pp
                    + "&serviceKey=" + URLEncoder.encode(serviceKey.trim(), StandardCharsets.UTF_8);
            String body = httpClient.requestUri(URI.create(url), HttpMethod.GET, new HttpHeaders());
            if (body == null || body.isBlank()) {
                return emptyPage(p, pp);
            }
            OdcloudTravelArticleResponse parsed =
                    ObjectMapperUtil.toObject(body, OdcloudTravelArticleResponse.class);
            if (parsed == null || parsed.getData() == null) {
                return emptyPage(p, pp);
            }
            List<TravelArticle> items = parsed.getData().stream()
                    .map(OdcloudTravelArticleHttpClient::toDomain)
                    .filter(a -> a.getTitle() != null && !a.getTitle().isBlank())
                    .toList();
            return TravelArticlePage.builder()
                    .items(items)
                    .page((int) parsed.getPage())
                    .perPage((int) parsed.getPerPage())
                    .totalCount(parsed.getTotalCount())
                    .build();
        } catch (Exception e) {
            log.warn("[ODCLOUD-TRAVEL] fetch failed page={} perPage={}: {}", p, pp, e.getMessage());
            return emptyPage(p, pp);
        }
    }

    private static TravelArticlePage emptyPage(int page, int perPage) {
        return TravelArticlePage.builder()
                .items(List.of())
                .page(page)
                .perPage(perPage)
                .totalCount(0)
                .build();
    }

    private static TravelArticle toDomain(OdcloudTravelArticleResponse.OdcloudTravelArticleItem i) {
        return TravelArticle.builder()
                .contentId(trim(i.getContentId()))
                .categoryName(trim(i.getCategoryName()))
                .categoryCode(i.getCategoryCode())
                .title(trim(i.getTitle()))
                .areaName(trim(i.getAreaName()))
                .areaCode(i.getAreaCode())
                .signguName(trim(i.getSignguName()))
                .signguCode(i.getSignguCode())
                .imageUrl(trim(i.getImageUrl()))
                .detailUrl(trim(i.getDetailUrl()))
                .build();
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
