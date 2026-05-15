package fast.campus.netplix.repository.user;

import fast.campus.netplix.auth.NetplixUser;
import fast.campus.netplix.entity.user.SocialUserEntity;
import fast.campus.netplix.entity.user.UserEntity;
import fast.campus.netplix.exception.UserException;
import fast.campus.netplix.repository.movie.UserMovieDownloadJpaRepository;
import fast.campus.netplix.repository.movie.UserMovieLikeJpaRepository;
import fast.campus.netplix.repository.subscription.UserSubscriptionJpaRepository;
import fast.campus.netplix.repository.subscription.UserSubscriptionRepository;
import fast.campus.netplix.repository.audit.UserHistoryJpaRepository;
import fast.campus.netplix.subscription.UserSubscription;
import fast.campus.netplix.token.DeleteTokenPort;
import fast.campus.netplix.user.CreateUser;
import fast.campus.netplix.user.DeleteUserPort;
import fast.campus.netplix.user.InsertUserPort;
import fast.campus.netplix.user.SearchUserPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepository implements SearchUserPort, InsertUserPort, DeleteUserPort {

    private final UserJpaRepository userJpaRepository;
    private final SocialUserJpaRepository socialUserJpaRepository;
    private final UserSubscriptionRepository userSubscriptionRepository;
    private final DeleteTokenPort deleteTokenPort;
    private final UserSubscriptionJpaRepository userSubscriptionJpaRepository;
    private final UserMovieLikeJpaRepository userMovieLikeJpaRepository;
    private final UserHistoryJpaRepository userHistoryJpaRepository;
    private final UserMovieDownloadJpaRepository userMovieDownloadJpaRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<NetplixUser> findUserById(String userId) {
        return userJpaRepository.findById(userId).map(userEntity -> {
            Optional<UserSubscription> subscription = userSubscriptionRepository.findByUserId(userEntity.getUserId());
            String role = subscription
                    .orElse(UserSubscription.newSubscription(userEntity.getUserId()))
                    .getSubscriptionType()
                    .toRole();
            return NetplixUser.builder()
                    .userId(userEntity.getUserId())
                    .username(userEntity.getUsername())
                    .encryptedPassword(userEntity.getPassword())
                    .email(userEntity.getEmail())
                    .phone(userEntity.getPhone())
                    .role(role)
                    .build();
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<NetplixUser> findByEmail(String email) {
        Optional<UserEntity> userEntityOptional = userJpaRepository.findByEmail(email);
        if (userEntityOptional.isEmpty()) {
            return Optional.empty();
        }
        
        UserEntity userEntity = userEntityOptional.get();
        
        // 사용자의 구독 정보를 조회하여 role 설정
        Optional<UserSubscription> subscription = userSubscriptionRepository.findByUserId(userEntity.getUserId());
        String role = subscription
                .orElse(UserSubscription.newSubscription(userEntity.getUserId()))
                .getSubscriptionType()
                .toRole();
        
        return Optional.of(NetplixUser.builder()
                .userId(userEntity.getUserId())
                .username(userEntity.getUsername())
                .encryptedPassword(userEntity.getPassword())
                .email(userEntity.getEmail())
                .phone(userEntity.getPhone())
                .role(role)
                .build());
    }

    @Override
    @Transactional(readOnly = true)
    public NetplixUser getByEmail(String email) {
        Optional<NetplixUser> byEmail = findByEmail(email);
        if (byEmail.isEmpty()) {
            throw new UserException.UserDoesNotExistException();
        }

        return byEmail.get();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findAllUserIds() {
        List<String> userIds = new ArrayList<>();
        userJpaRepository.findAll().forEach(user -> userIds.add(user.getUserId()));
        socialUserJpaRepository.findAll().forEach(user -> userIds.add(user.getSocialUserId()));
        return userIds;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<NetplixUser> findByProviderId(String providerId) {
        Optional<SocialUserEntity> userEntityOptional = socialUserJpaRepository.findByProviderId(providerId);
        if (userEntityOptional.isEmpty()) {
            return Optional.empty();
        }

        SocialUserEntity socialUserEntity = userEntityOptional.get();

        Optional<UserSubscription> byUserId = userSubscriptionRepository.findByUserId(socialUserEntity.getSocialUserId());

        return Optional.of(new NetplixUser(
                socialUserEntity.getSocialUserId(),
                socialUserEntity.getUsername(),
                null,
                null,
                null,
                socialUserEntity.getProvider(),
                socialUserEntity.getProviderId(),
                byUserId.orElse(UserSubscription.newSubscription(socialUserEntity.getSocialUserId()))
                        .getSubscriptionType()
                        .toRole()
        ));
    }

    @Override
    @Transactional
    public void updateLastLoginAt(String email) {
        userJpaRepository.updateLastLoginAtByEmail(email, LocalDateTime.now(ZoneId.of("Asia/Seoul")));
    }

    @Override
    @Transactional
    public NetplixUser create(CreateUser create) {
        UserEntity user = UserEntity.toEntity(create);
        userSubscriptionRepository.create(user.getUserId());
        return userJpaRepository.save(user)
                .toDomain();
    }

    @Override
    @Transactional
    public NetplixUser createSocialUser(String username, String provider, String providerId) {
        SocialUserEntity socialUserEntity = new SocialUserEntity(username, provider, providerId);
        userSubscriptionRepository.create(socialUserEntity.getSocialUserId());
        return socialUserJpaRepository.save(socialUserEntity)
                .toDomain();
    }

    @Override
    @Transactional
    public void deleteByUserId(String userId) {
        System.out.println("========== UserRepository.deleteByUserId 시작 ==========");
        System.out.println("전달받은 userId: " + userId);
        
        String tokenUserId;
        Optional<UserEntity> userOpt = userJpaRepository.findById(userId);
        System.out.println("일반 사용자 조회 결과: " + (userOpt.isPresent() ? "찾음" : "없음"));
        
        if (userOpt.isPresent()) {
            tokenUserId = userOpt.get().getEmail();
            System.out.println("토큰 삭제 대상 (email): " + tokenUserId);
            deleteTokenPort.deleteByTokenUserId(tokenUserId);
            System.out.println("토큰 삭제 완료");
            userSubscriptionJpaRepository.deleteByUserId(userId);
            System.out.println("구독 삭제 완료");
            userMovieLikeJpaRepository.deleteByUserId(userId);
            System.out.println("좋아요 삭제 완료");
            userHistoryJpaRepository.deleteByUserId(userId);
            System.out.println("히스토리 삭제 완료");
            userMovieDownloadJpaRepository.deleteByUserId(userId);
            System.out.println("다운로드 삭제 완료");
            userJpaRepository.deleteById(userId);
            System.out.println("사용자 삭제 완료");
        } else {
            Optional<SocialUserEntity> socialOpt = socialUserJpaRepository.findById(userId);
            System.out.println("소셜 사용자 조회 결과: " + (socialOpt.isPresent() ? "찾음" : "없음"));
            
            if (socialOpt.isPresent()) {
                tokenUserId = socialOpt.get().getProviderId();
                System.out.println("토큰 삭제 대상 (providerId): " + tokenUserId);
                deleteTokenPort.deleteByTokenUserId(tokenUserId);
                System.out.println("토큰 삭제 완료");
                userSubscriptionJpaRepository.deleteByUserId(userId);
                System.out.println("구독 삭제 완료");
                userMovieLikeJpaRepository.deleteByUserId(userId);
                System.out.println("좋아요 삭제 완료");
                userHistoryJpaRepository.deleteByUserId(userId);
                System.out.println("히스토리 삭제 완료");
                userMovieDownloadJpaRepository.deleteByUserId(userId);
                System.out.println("다운로드 삭제 완료");
                socialUserJpaRepository.deleteById(userId);
                System.out.println("소셜 사용자 삭제 완료");
            } else {
                System.out.println("사용자를 찾을 수 없음! userId: " + userId);
                throw new UserException.UserDoesNotExistException();
            }
        }
        System.out.println("========== UserRepository.deleteByUserId 완료 ==========");
    }
}
