package fast.campus.netplix.advice;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.exception.ErrorCode;
import fast.campus.netplix.exception.NetplixException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionAdvice {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionAdvice.class);

    @ExceptionHandler(NetplixException.class)
    protected NetplixApiResponse<?> handleSecurityException(NetplixException e) {
        String message = e.getMessage() != null ? e.getMessage() : e.getErrorCode().getDesc();
        log.warn("error={}", message);
        return NetplixApiResponse.fail(e.getErrorCode(), message);
    }

    /** 로그인 시 이메일/비밀번호 불일치 등 인증 실패 */
    @ExceptionHandler(AuthenticationException.class)
    protected NetplixApiResponse<?> handleAuthenticationException(AuthenticationException e) {
        log.warn("authentication failed: {}", e.getMessage());
        return NetplixApiResponse.fail(ErrorCode.DEFAULT_ERROR, "이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    @ExceptionHandler(RuntimeException.class)
    protected NetplixApiResponse<?> handleRuntimeException(RuntimeException e) {
        log.error("error={}", e.getMessage(), e);
        return NetplixApiResponse.fail(ErrorCode.DEFAULT_ERROR, e.getMessage());
    }
}
