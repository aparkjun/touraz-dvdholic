package fast.campus.netplix.config;

import fast.campus.netplix.filter.AdminAuthFilter;
import fast.campus.netplix.filter.JwtAuthenticationFilter;
import fast.campus.netplix.filter.PublicMovieListRequestFilter;
import fast.campus.netplix.filter.UserHistoryLoggingFilter;
import fast.campus.netplix.security.NetplixUserDetailsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Collections;

@Slf4j
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final NetplixUserDetailsService netplixUserDetailsService;
    private final OAuth2LoginSuccessHandler oauth2LoginSuccessHandler;
    private final AppleOidcUserService appleOidcUserService;

    private final AdminAuthFilter adminAuthFilter;
    private final PublicMovieListRequestFilter publicMovieListRequestFilter;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final UserHistoryLoggingFilter userHistoryLoggingFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        httpSecurity.httpBasic(AbstractHttpConfigurer::disable);
        httpSecurity.csrf(AbstractHttpConfigurer::disable);
        httpSecurity.formLogin(AbstractHttpConfigurer::disable);
        httpSecurity.cors(cors -> cors.configurationSource(corsConfigurationSource()));
        
        // JWT 기반 인증이므로 세션을 사용하지 않음 (Stateless)
        httpSecurity.sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

        // API: 인증 불필요(공개) 경로 permitAll, 나머지 인증 필요 / 비 API(SPA·정적): 모두 permitAll
        // App Store Guideline 5.1.1(v): 계정 삭제는 인증 필수
        httpSecurity.authorizeHttpRequests(a ->
                a.requestMatchers(HttpMethod.POST, "/api/v1/admin/login").permitAll()
                        .requestMatchers("/api/v1/admin/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/user/me").authenticated()
                        .requestMatchers("/api/v1/user/me/liked-movies").authenticated()
                        .requestMatchers("/api/v1/user/**", "/api/v1/auth/**").permitAll()
                        .requestMatchers("/api/v1/movie/**").permitAll()
                        .requestMatchers("/api/v1/batch/**").permitAll()
                        .requestMatchers("/api/v1/dvd-stores/**").permitAll()
                        .requestMatchers("/api/v1/support/**").permitAll()
                        .requestMatchers("/api/v1/tour/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/cine-trip/import").authenticated()
                        .requestMatchers("/api/v1/cine-trip/**").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll());
        
        // OAuth2 로그인 설정 (카카오/Apple) - 성공 시 JWT 발급 후 /dashboard 로 리다이렉트
        httpSecurity.oauth2Login(oauth2 -> oauth2
                .successHandler(oauth2LoginSuccessHandler)
                .failureHandler((request, response, exception) -> {
                    log.error("OAuth2 로그인 실패: {}", exception.getMessage(), exception);
                    response.sendRedirect("/login?error=true");
                })
                .userInfoEndpoint(ui -> ui.oidcUserService(appleOidcUserService))
        );
        
        // 인증 실패 시 예외 처리
        httpSecurity.exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(401);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write("{\"success\":false,\"code\":401,\"message\":\"Unauthorized\"}");
                })
        );

        httpSecurity.userDetailsService(netplixUserDetailsService);

        httpSecurity.addFilterBefore(adminAuthFilter, UsernamePasswordAuthenticationFilter.class);
        httpSecurity.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        httpSecurity.addFilterBefore(publicMovieListRequestFilter, UsernamePasswordAuthenticationFilter.class);
        httpSecurity.addFilterAfter(userHistoryLoggingFilter, UsernamePasswordAuthenticationFilter.class);

        return httpSecurity.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    CorsConfigurationSource corsConfigurationSource() {
        return request -> {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedHeaders(Collections.singletonList("*"));
            config.setAllowedMethods(Collections.singletonList("*"));
            config.setAllowedOriginPatterns(Collections.singletonList("*")); // 허용할 origin
            config.setAllowCredentials(true);
            return config;
        };
    }
}
