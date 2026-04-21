package fast.campus.netplix.cinetrip.autotag;

import fast.campus.netplix.cinetrip.AutoTagCineTripMappingUseCase;
import fast.campus.netplix.cinetrip.LlmMappingPort;
import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.cinetrip.MovieRegionSuggestion;
import fast.campus.netplix.cinetrip.PendingMappingReviewPort;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AutoTagCineTripMappingService (룰 + LLM 자동 태깅)")
class AutoTagCineTripMappingServiceTest {

    @Mock PersistenceMoviePort persistenceMoviePort;
    @Mock MovieRegionMappingPort movieRegionMappingPort;
    @Mock LlmMappingPort llmMappingPort;
    @Mock PendingMappingReviewPort pendingMappingReviewPort;

    @InjectMocks AutoTagCineTripMappingService service;

    private NetplixMovie movie(String name, String overview) {
        return NetplixMovie.builder()
                .movieName(name)
                .overview(overview)
                .contentType("movie")
                .isAdult(false)
                .build();
    }

    @Test
    @DisplayName("룰 매칭 성공 시 confidence=4 로 movie_region_mappings 에 upsert")
    void rule_hit_autoApproved() {
        NetplixMovie m = movie("부산행", "좀비 바이러스가 퍼진 한국에서 부산으로 향하는 KTX 안의 사투.");
        when(persistenceMoviePort.fetchBy(eq(1), anyInt())).thenReturn(List.of(m));
        when(persistenceMoviePort.fetchBy(eq(2), anyInt())).thenReturn(Collections.emptyList());
        when(movieRegionMappingPort.findByMovieName("부산행")).thenReturn(Collections.emptyList());
        when(movieRegionMappingPort.upsertAll(anyList())).thenAnswer(inv -> ((List<?>) inv.getArgument(0)).size());

        AutoTagCineTripMappingUseCase.Result r = service.runAll();

        assertThat(r.scanned).isEqualTo(1);
        assertThat(r.autoApproved).isGreaterThanOrEqualTo(1);
        assertThat(r.pending).isEqualTo(0);

        ArgumentCaptor<List<MovieRegionMapping>> cap = ArgumentCaptor.forClass(List.class);
        verify(movieRegionMappingPort).upsertAll(cap.capture());
        List<MovieRegionMapping> saved = cap.getValue();
        assertThat(saved).isNotEmpty();
        assertThat(saved.get(0).getAreaCode()).isEqualTo("6"); // 부산
        assertThat(saved.get(0).getConfidence()).isEqualTo(4);
        verify(llmMappingPort, never()).suggest(any());
    }

    @Test
    @DisplayName("룰 매칭 실패 + LLM confidence≤2 → pending_mapping_reviews 에 큐잉")
    void llm_lowConfidence_queued() {
        NetplixMovie m = movie("무제", "도시에서 살아가는 어느 가족의 이야기.");
        when(persistenceMoviePort.fetchBy(eq(1), anyInt())).thenReturn(List.of(m));
        when(persistenceMoviePort.fetchBy(eq(2), anyInt())).thenReturn(Collections.emptyList());
        when(movieRegionMappingPort.findByMovieName("무제")).thenReturn(Collections.emptyList());
        when(llmMappingPort.isAvailable()).thenReturn(true);
        when(llmMappingPort.suggest(m)).thenReturn(List.of(
                MovieRegionSuggestion.builder()
                        .movieName("무제").areaCode("1").regionName("서울")
                        .mappingType("BACKGROUND").evidence("도시 배경")
                        .confidence(2).source("LLM").build()
        ));
        when(pendingMappingReviewPort.saveAll(anyList())).thenAnswer(inv -> ((List<?>) inv.getArgument(0)).size());

        AutoTagCineTripMappingUseCase.Result r = service.runAll();

        assertThat(r.autoApproved).isEqualTo(0);
        assertThat(r.pending).isEqualTo(1);
        verify(movieRegionMappingPort, never()).upsertAll(anyList());
        verify(pendingMappingReviewPort).saveAll(anyList());
    }

    @Test
    @DisplayName("이미 매핑이 있는 영화는 스킵 - LLM·룰 호출 없음")
    void alreadyMapped_skipped() {
        NetplixMovie m = movie("올드보이", "15년간 감금된 남자의 복수극.");
        when(persistenceMoviePort.fetchBy(eq(1), anyInt())).thenReturn(List.of(m));
        when(persistenceMoviePort.fetchBy(eq(2), anyInt())).thenReturn(Collections.emptyList());
        when(movieRegionMappingPort.findByMovieName("올드보이"))
                .thenReturn(List.of(MovieRegionMapping.builder().areaCode("1").build()));

        AutoTagCineTripMappingUseCase.Result r = service.runAll();

        assertThat(r.scanned).isEqualTo(1);
        assertThat(r.skipped).isEqualTo(1);
        assertThat(r.autoApproved).isEqualTo(0);
        assertThat(r.pending).isEqualTo(0);
        verify(llmMappingPort, never()).suggest(any());
        verify(movieRegionMappingPort, never()).upsertAll(anyList());
        verify(pendingMappingReviewPort, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("LLM confidence≥3 은 바로 자동 승인")
    void llm_highConfidence_autoApproved() {
        NetplixMovie m = movie("건축학개론", "첫사랑에 관한 이야기.");
        when(persistenceMoviePort.fetchBy(eq(1), anyInt())).thenReturn(List.of(m));
        when(persistenceMoviePort.fetchBy(eq(2), anyInt())).thenReturn(Collections.emptyList());
        when(movieRegionMappingPort.findByMovieName("건축학개론")).thenReturn(Collections.emptyList());
        when(llmMappingPort.isAvailable()).thenReturn(true);
        when(llmMappingPort.suggest(m)).thenReturn(List.of(
                MovieRegionSuggestion.builder()
                        .movieName("건축학개론").areaCode("39").regionName("제주")
                        .mappingType("SHOT").evidence("제주 우도 로케")
                        .confidence(5).source("LLM").build()
        ));
        when(movieRegionMappingPort.upsertAll(anyList())).thenAnswer(inv -> ((List<?>) inv.getArgument(0)).size());

        AutoTagCineTripMappingUseCase.Result r = service.runAll();

        assertThat(r.autoApproved).isEqualTo(1);
        assertThat(r.pending).isEqualTo(0);
        verify(pendingMappingReviewPort, never()).saveAll(anyList());
    }
}
