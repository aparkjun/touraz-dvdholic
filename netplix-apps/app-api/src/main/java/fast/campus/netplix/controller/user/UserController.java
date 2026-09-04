package fast.campus.netplix.controller.user;

import fast.campus.netplix.authentication.token.JwtTokenProvider;
import fast.campus.netplix.movie.FetchLikedMoviesUseCase;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.user.DeleteUserUseCase;
import fast.campus.netplix.user.FetchUserUseCase;
import fast.campus.netplix.user.RegisterUserUseCase;
import fast.campus.netplix.user.command.UserRegistrationCommand;
import fast.campus.netplix.user.response.SimpleUserResponse;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.controller.user.request.UserRegistrationRequest;
import fast.campus.netplix.exception.ErrorCode;
import fast.campus.netplix.user.response.UserRegistrationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class UserController {

    private final RegisterUserUseCase registerUserUseCase;
    private final FetchUserUseCase fetchUserUseCase;
    private final DeleteUserUseCase deleteUserUseCase;
    private final FetchLikedMoviesUseCase fetchLikedMoviesUseCase;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping("/me/liked-movies")
    public NetplixApiResponse<java.util.List<NetplixMovie>> getLikedMovies() {
        String userId = jwtTokenProvider.getUserId();
        return NetplixApiResponse.ok(fetchLikedMoviesUseCase.fetchLikedMovies(userId));
    }

    @GetMapping("/{email}")
    public NetplixApiResponse<SimpleUserResponse> findUserByEmail(
            @PathVariable String email
    ) {
        return NetplixApiResponse.ok(fetchUserUseCase.findSimpleUserByEmail(email));
    }


    @PostMapping("/register")
    public NetplixApiResponse<UserRegistrationResponse> register(
            @RequestBody UserRegistrationRequest request
    ) {
        if (!Boolean.TRUE.equals(request.getPrivacyConsent())) {
            return NetplixApiResponse.fail(
                    ErrorCode.PRIVACY_CONSENT_REQUIRED,
                    ErrorCode.PRIVACY_CONSENT_REQUIRED.getDesc());
        }
        UserRegistrationCommand command = UserRegistrationCommand.builder()
                .username(request.getUsername())
                .encryptedPassword(request.getPassword())
                .email(request.getEmail())
                .phone(request.getPhone() != null ? request.getPhone() : null)
                .build();
        return NetplixApiResponse.ok(registerUserUseCase.register(command));
    }

    /**
     * App Store Guideline 5.1.1(v): 계정 삭제 (회원 탈퇴)
     * 로그인된 사용자만 호출 가능
     */
    @DeleteMapping("/me")
    public NetplixApiResponse<Void> deleteAccount() {
        System.out.println("========== 계정 삭제 요청 시작 ==========");
        String userId = jwtTokenProvider.getUserId();
        System.out.println("삭제 대상 userId: " + userId);
        try {
            deleteUserUseCase.deleteByUserId(userId);
            System.out.println("계정 삭제 성공!");
        } catch (Exception e) {
            System.out.println("계정 삭제 실패: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
        System.out.println("========== 계정 삭제 요청 완료 ==========");
        return NetplixApiResponse.ok(null);
    }
}
