package fast.campus.netplix.controller.user.request;

import fast.campus.netplix.annotation.PasswordEncryption;

public class UserRegistrationRequest {
    private final String username;

    @PasswordEncryption
    private String password;

    private final String email;

    private final String phone;

    private final Boolean privacyConsent;

    public UserRegistrationRequest(String username, String password, String email, String phone) {
        this(username, password, email, phone, null);
    }

    public UserRegistrationRequest(String username, String password, String email, String phone, Boolean privacyConsent) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.phone = phone;
        this.privacyConsent = privacyConsent;
    }

    public String getUsername() {
        return username;
    }

    public String getPassword() {
        return password;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public Boolean getPrivacyConsent() {
        return privacyConsent;
    }
}
