package fast.campus.netplix.controller.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.controller.user.request.UserRegistrationRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("회원가입 요청 JSON 역직렬화")
class UserRegistrationRequestJacksonTest {

    /** Spring MVC가 쓰는 ObjectMapper와 같게 (ParameterNamesModule 포함) */
    private final ObjectMapper objectMapper = Jackson2ObjectMapperBuilder.json().build();

    @Test
    void privacyConsentTrue() throws Exception {
        UserRegistrationRequest req = objectMapper.readValue(
                """
                {"username":"원토","password":"TestPass12!","email":"a@b.com","phone":null,"privacyConsent":true}
                """,
                UserRegistrationRequest.class);
        assertThat(req.getUsername()).isEqualTo("원토");
        assertThat(req.getPrivacyConsent()).isTrue();
        assertThat(req.getPhone()).isNull();
    }

    @Test
    void withoutPrivacyConsentField() throws Exception {
        UserRegistrationRequest req = objectMapper.readValue(
                """
                {"username":"원토","password":"TestPass12!","email":"a@b.com","phone":"(+82)1012345678"}
                """,
                UserRegistrationRequest.class);
        assertThat(req.getPrivacyConsent()).isNull();
        assertThat(req.getPhone()).isEqualTo("(+82)1012345678");
    }
}
