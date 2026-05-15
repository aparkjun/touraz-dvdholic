package fast.campus.netplix.user;

import fast.campus.netplix.auth.NetplixUser;

import java.util.List;
import java.util.Optional;

public interface SearchUserPort {
    Optional<NetplixUser> findByEmail(String email);
    NetplixUser getByEmail(String email);
    /** 일반 회원(users)만 조회 */
    Optional<NetplixUser> findUserById(String userId);
    Optional<NetplixUser> findByProviderId(String providerId);
    List<String> findAllUserIds();
    void updateLastLoginAt(String email);
}
