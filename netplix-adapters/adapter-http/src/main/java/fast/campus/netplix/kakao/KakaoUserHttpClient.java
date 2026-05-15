package fast.campus.netplix.kakao;

import fast.campus.netplix.auth.NetplixUser;
import fast.campus.netplix.user.KakaoUserPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class KakaoUserHttpClient implements KakaoUserPort {

    private final String KAKAO_USERINFO_API_URL = "https://kapi.kakao.com/v2/user/me";

    @Override
    public NetplixUser findUserFromKakao(String accessToken) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.add("Authorization", "Bearer " + accessToken);  // 액세스 토큰을 Authorization 헤더에 추가

        HttpEntity<String> entity = new HttpEntity<>(headers);

        ResponseEntity<Map> response = restTemplate.exchange(
                KAKAO_USERINFO_API_URL,
                HttpMethod.GET,
                entity,
                Map.class
        );

        Long providerId = (Long) response.getBody().get("id");

        String nickname = "카카오사용자";
        Map<?, ?> body = response.getBody();
        Map<?, ?> properties = body.get("properties") instanceof Map ? (Map<?, ?>) body.get("properties") : null;
        if (properties != null && properties.get("nickname") != null) {
            nickname = String.valueOf(properties.get("nickname"));
        }

        String email = null;
        if (body.get("kakao_account") instanceof Map<?, ?> kakaoAccount) {
            Object emailObj = kakaoAccount.get("email");
            if (emailObj instanceof String es && !es.isBlank()) {
                email = es.trim();
            }
        }

        return NetplixUser.builder()
                .username(nickname)
                .providerId(providerId.toString())
                .email(email)
                .build();
    }
}
