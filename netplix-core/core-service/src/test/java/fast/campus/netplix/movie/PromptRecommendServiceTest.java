package fast.campus.netplix.movie;

import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.movie.response.MovieWithRecommendReason;
import fast.campus.netplix.tour.TourIndexUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PromptRecommendService (OpenAI 프롬프트 + 기분·동행 추천)")
class PromptRecommendServiceTest {

    private static final String CONTENT_TYPE = "movie";

    @Mock
    private OpenAiClientPort openAiClientPort;

    @Mock
    private PersistenceMoviePort persistenceMoviePort;

    @Mock
    private TourIndexUseCase tourIndexUseCase;

    @Mock
    private MovieRegionMappingPort movieRegionMappingPort;

    @InjectMocks
    private PromptRecommendService promptRecommendService;

    private static NetplixMovie movie(String name, String contentType) {
        return NetplixMovie.builder()
                .movieName(name)
                .contentType(contentType)
                .genre("Drama")
                .isAdult(false)
                .overview("")
                .releasedAt(null)
                .posterPath(null)
                .backdropPath(null)
                .voteAverage(null)
                .cast(null)
                .director(null)
                .runtime(null)
                .releaseDate(null)
                .certification(null)
                .budget(null)
                .revenue(null)
                .trailerUrl(null)
                .ottProviders(null)
                .collection(null)
                .recommendations(null)
                .topReview(null)
                .tagline(null)
                .originalTitle(null)
                .originalLanguage(null)
                .productionCountries(null)
                .productionCompanies(null)
                .imdbId(null)
                .voteCount(null)
                .spokenLanguages(null)
                .homepage(null)
                .build();
    }

    @Test
    @DisplayName("비 오는 날 라면 먹으면서 보기 좋은 감성 영화 → LLM 응답 파싱 후 영화+이유 반환")
    void recommendByPrompt_parsesLlmResponse_andReturnsMoviesWithReasons() {
        String q = "비 오는 날 창문 앞에서 뜨끈한 라면 먹으면서 보기 좋은 감성 영화";
        String mood = "나른함";
        String companion = "혼자";
        int limit = 3;

        List<NetplixMovie> catalog = List.of(
                movie("메간", CONTENT_TYPE),
                movie("노트북", CONTENT_TYPE),
                movie("라라랜드", CONTENT_TYPE)
        );
        when(persistenceMoviePort.fetchByContentType(eq(CONTENT_TYPE), anyInt(), eq(50)))
                .thenReturn(catalog);

        String fakeLlmResponse = "메간 - 비 오는 날 분위기 몰입하기 좋은 영화\n"
                + "노트북 - 라면과 함께 보기 좋은 클래식 로맨스\n"
                + "라라랜드 - 비와 잘 어울리는 감성 뮤지컬";
        when(openAiClientPort.chat(anyString(), anyString())).thenReturn(fakeLlmResponse);

        List<MovieWithRecommendReason> result = promptRecommendService.recommendByPrompt(
                q, mood, companion, CONTENT_TYPE, limit);

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getMovie().getMovieName()).isEqualTo("메간");
        assertThat(result.get(0).getReason()).contains("비 오는 날");
        assertThat(result.get(1).getMovie().getMovieName()).isEqualTo("노트북");
        assertThat(result.get(1).getReason()).contains("라면");
        assertThat(result.get(2).getMovie().getMovieName()).isEqualTo("라라랜드");
        assertThat(result.get(2).getReason()).contains("비와");

        verify(openAiClientPort).chat(anyString(), anyString());
    }

    @Test
    @DisplayName("다른 테스트 입력: 연인과 볼 만한 웃긴 로맨스 → 파싱 및 반환")
    void recommendByPrompt_anotherInput_parsesAndReturns() {
        String q = "연인과 볼 만한 웃기면서 감동하는 로맨스 영화";
        List<NetplixMovie> catalog = List.of(
                movie("러브 액츄얼리", CONTENT_TYPE),
                movie("어바웃 타임", CONTENT_TYPE),
                movie("노팅힐", CONTENT_TYPE)
        );
        when(persistenceMoviePort.fetchByContentType(eq(CONTENT_TYPE), anyInt(), eq(50)))
                .thenReturn(catalog);
        String fakeLlmResponse = "러브 액츄얼리 - 여러 커플 이야기가 웃음과 감동을 준다\n"
                + "어바웃 타임 - 시간 여행 로맨스로 유쾌하고 따뜻하다\n"
                + "노팅힐 - 히트 영화 스타와 서점 주인의 로맨스";
        when(openAiClientPort.chat(anyString(), anyString())).thenReturn(fakeLlmResponse);

        List<MovieWithRecommendReason> result = promptRecommendService.recommendByPrompt(
                q, "기대", "연인", CONTENT_TYPE, 3);

        assertThat(result).hasSize(3);
        assertThat(result.get(0).getMovie().getMovieName()).isEqualTo("러브 액츄얼리");
        assertThat(result.get(0).getReason()).contains("웃음");
        assertThat(result.get(1).getMovie().getMovieName()).isEqualTo("어바웃 타임");
        assertThat(result.get(2).getMovie().getMovieName()).isEqualTo("노팅힐");
        verify(openAiClientPort).chat(anyString(), anyString());
    }

    @Test
    @DisplayName("LLM 응답이 null이면 빈 목록 반환")
    void recommendByPrompt_emptyWhenLlmReturnsNull() {
        when(persistenceMoviePort.fetchByContentType(eq(CONTENT_TYPE), anyInt(), eq(50)))
                .thenReturn(List.of(movie("어벤져스", CONTENT_TYPE)));
        when(openAiClientPort.chat(anyString(), anyString())).thenReturn(null);

        List<MovieWithRecommendReason> result = promptRecommendService.recommendByPrompt(
                "새벽에 혼자 보기 좋은 애매한 결말 스릴러", null, "혼자", CONTENT_TYPE, 5);

        assertThat(result).isEmpty();
    }
}
