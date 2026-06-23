package fast.campus.netplix.client;

import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.Map;

@Component
public class HttpClient {

    private final RestTemplate restTemplate;

    public HttpClient(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public String request(String uri, HttpMethod httpMethod, HttpHeaders headers, Map<String, Object> params) {
        return restTemplate.exchange(
                uri,
                httpMethod,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<String>() {
                },
                params
        ).getBody();
    }

    /**
     * 이미 완전하게 URL-인코딩 된 문자열을 그대로 호출한다.
     * {@link RestTemplate#exchange(String, HttpMethod, HttpEntity, ParameterizedTypeReference, Map)}
     * 는 String uri 를 URI 템플릿으로 해석해 한 번 더 인코딩하므로, 한국관광공사 API 처럼
     * 쿼리스트링에 %-인코딩된 한글 키워드가 들어가는 경우 이중 인코딩이 발생한다.
     * 본 오버로드는 {@link URI} 로 감싸 넘겨 재인코딩을 방지한다.
     */
    public String requestUri(URI uri, HttpMethod httpMethod, HttpHeaders headers) {
        return restTemplate.exchange(
                uri,
                httpMethod,
                new HttpEntity<>(headers),
                new ParameterizedTypeReference<String>() {
                }
        ).getBody();
    }

    /** 응답 charset 을 애플리케이션에서 판별해야 할 때(한글 XML 등) 원시 바이트+헤더를 반환한다. */
    public ResponseEntity<byte[]> requestUriBytes(URI uri, HttpMethod httpMethod, HttpHeaders headers) {
        return restTemplate.exchange(uri, httpMethod, new HttpEntity<>(headers), byte[].class);
    }
}
