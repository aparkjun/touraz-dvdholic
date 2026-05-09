package fast.campus.netplix.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

/**
 * 영화/DVD 목록 API는 로그인 없이 허용. Authorization 헤더를 제거해
 * 카카오/일반 로그인 여부와 관계없이 항상 anonymous로 처리되게 함.
 */
@Component
public class PublicMovieListRequestFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/movie/search",
            "/api/v1/movie/playing/search",
            "/api/v1/movie/category/search",
            "/api/v1/movie/keyword/search",
            "/api/v1/weather"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return PUBLIC_PATHS.stream().noneMatch(path::contains);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        filterChain.doFilter(new AuthorizationStrippingRequest(request), response);
    }

    private static class AuthorizationStrippingRequest extends HttpServletRequestWrapper {
        public AuthorizationStrippingRequest(HttpServletRequest request) {
            super(request);
        }

        @Override
        public String getHeader(String name) {
            if ("Authorization".equalsIgnoreCase(name)) {
                return null;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if ("Authorization".equalsIgnoreCase(name)) {
                return Collections.enumeration(List.of());
            }
            return super.getHeaders(name);
        }
    }
}
