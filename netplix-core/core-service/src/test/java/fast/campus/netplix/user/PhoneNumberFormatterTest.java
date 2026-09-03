package fast.campus.netplix.user;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("가입 전화번호 정규화")
class PhoneNumberFormatterTest {

    @Test
    @DisplayName("비어 있으면 null")
    void blankIsNull() {
        assertThat(PhoneNumberFormatter.normalize(null)).isNull();
        assertThat(PhoneNumberFormatter.normalize("")).isNull();
        assertThat(PhoneNumberFormatter.normalize("   ")).isNull();
    }

    @Test
    @DisplayName("이미 맞는 (+82)10자리 형식은 그대로")
    void alreadyWrappedTenDigits() {
        assertThat(PhoneNumberFormatter.normalize("(+82)1012345678"))
                .isEqualTo("(+82)1012345678");
    }

    @Test
    @DisplayName("한국 010 11자리는 앞의 0을 빼고 저장")
    void koreanMobileWithLeadingZero() {
        assertThat(PhoneNumberFormatter.normalize("(+82)01012345678"))
                .isEqualTo("(+82)1012345678");
        assertThat(PhoneNumberFormatter.normalize("01012345678"))
                .isEqualTo("(+82)1012345678");
        assertThat(PhoneNumberFormatter.normalize("010-1234-5678"))
                .isEqualTo("(+82)1012345678");
        assertThat(PhoneNumberFormatter.normalize("(+82)0101234567"))
                .isEqualTo("(+82)101234567");
    }

    @Test
    @DisplayName("E.164 +82 도 허용")
    void e164Korea() {
        assertThat(PhoneNumberFormatter.normalize("+821012345678"))
                .isEqualTo("(+82)1012345678");
        assertThat(PhoneNumberFormatter.normalize("+82 10-1234-5678"))
                .isEqualTo("(+82)1012345678");
    }

    @Test
    @DisplayName("다른 국가번호는 국내번호 8~11자리면 통과")
    void otherCountry() {
        assertThat(PhoneNumberFormatter.normalize("(+1)5551234567"))
                .isEqualTo("(+1)5551234567");
    }

    @Test
    @DisplayName("숫자 너무 짧거나 길면 실패")
    void invalidLength() {
        assertThatThrownBy(() -> PhoneNumberFormatter.normalize("(+82)123"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PhoneNumberFormatter.normalize("(+82)010123456789012"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
