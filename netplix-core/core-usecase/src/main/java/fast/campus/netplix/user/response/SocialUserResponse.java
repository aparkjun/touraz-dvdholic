package fast.campus.netplix.user.response;

public record SocialUserResponse(
        String name,
        String provider,
        String providerId,
        /** 카카오 API 등에서 받은 이메일(동의·스코프에 따라 null) */
        String oauthEmail
) {
    public SocialUserResponse(String name, String provider, String providerId) {
        this(name, provider, providerId, null);
    }
}
