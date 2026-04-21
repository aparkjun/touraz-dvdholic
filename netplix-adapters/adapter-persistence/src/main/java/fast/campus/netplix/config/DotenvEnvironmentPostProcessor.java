package fast.campus.netplix.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.PropertySource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 프로젝트 루트의 .env 파일을 자동으로 읽어 Spring Environment 에 주입한다.
 * - 로컬 개발 편의를 위한 용도이며, 이미 시스템/세션 환경변수가 설정된 경우 덮어쓰지 않는다.
 * - KEY=VALUE 형식만 지원 (주석, 빈 줄, 따옴표 둘러싸기 지원).
 * - Heroku 등 운영 환경에서는 .env 파일이 없어 no-op.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROP_SOURCE_NAME = "dotenvProperties";
    private static final List<String> CANDIDATE_FILES = List.of(".env", "../.env", "../../.env", "../../../.env");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (String candidate : CANDIDATE_FILES) {
            Path path = Paths.get(candidate).toAbsolutePath().normalize();
            if (!Files.exists(path) || !Files.isRegularFile(path)) continue;
            Map<String, Object> parsed = parse(path);
            if (parsed.isEmpty()) continue;

            Map<String, Object> merged = new HashMap<>();
            for (Map.Entry<String, Object> e : parsed.entrySet()) {
                if (environment.containsProperty(e.getKey())) continue;
                merged.put(e.getKey(), e.getValue());
            }
            if (!merged.isEmpty()) {
                PropertySource<?> ps = new MapPropertySource(PROP_SOURCE_NAME, merged);
                environment.getPropertySources().addLast(ps);
                System.out.println("[Dotenv] Loaded " + merged.size() + " properties from " + path);
            }
            return;
        }
    }

    private Map<String, Object> parse(Path path) {
        Map<String, Object> map = new HashMap<>();
        try {
            for (String raw : Files.readAllLines(path, StandardCharsets.UTF_8)) {
                String line = raw.trim();
                if (line.isEmpty() || line.startsWith("#")) continue;
                int eq = line.indexOf('=');
                if (eq <= 0) continue;
                String key = line.substring(0, eq).trim();
                String value = line.substring(eq + 1).trim();
                if (value.length() >= 2) {
                    char first = value.charAt(0);
                    char last = value.charAt(value.length() - 1);
                    if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                        value = value.substring(1, value.length() - 1);
                    }
                }
                if (!key.isEmpty()) map.put(key, value);
            }
        } catch (IOException e) {
            System.err.println("[Dotenv] Failed to read " + path + ": " + e.getMessage());
        }
        return map;
    }
}
