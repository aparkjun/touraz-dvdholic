package fast.campus.netplix.movie;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class NetplixMovie {
    private final String movieName;
    private final Boolean isAdult;
    private final String genre;
    private final String overview;
    private final String releasedAt;
    private final String posterPath;
    private final String backdropPath;
    private final Double voteAverage;      // 평점
    private final String cast;             // 배우 정보 (쉼표로 구분)
    private final String director;         // 감독
    private final Integer runtime;         // 상영 시간 (분)
    private final String releaseDate;      // 개봉일
    private final String certification;    // 관람 등급
    private final Long budget;             // 예산
    private final Long revenue;            // 수익
    private final String contentType;      // 컨텐츠 타입 ("dvd" 또는 "movie")
    private final String trailerUrl;       // 예고편 URL (YouTube)
    private final String ottProviders;     // OTT 제공 플랫폼 (쉼표로 구분)
    private final String collection;       // 시리즈/컬렉션 정보
    private final String recommendations;  // 추천 영화 (쉼표로 구분, 최대 5개)
    private final String topReview;        // 대표 리뷰 (가장 인기 있는 리뷰 하나)
    private final String tagline;          // 짧은 한 줄 문구 (Netflix 스타일)
    private final String originalTitle;    // 원제
    private final String originalLanguage; // 원어 (en, ko 등)
    private final String productionCountries;  // 제작국 (미국, 한국 등)
    private final String productionCompanies;  // 제작사 (Marvel, Disney 등)
    private final String imdbId;           // IMDB ID (tt0137523)
    private final Integer voteCount;       // 평점 참여 인원
    private final String spokenLanguages;  // 상영 언어 (영어, 한국어 등)
    private final String homepage;         // 공식 홈페이지 URL

    private final String movieNameEn;      // 영어 제목
    private final String overviewEn;       // 영어 줄거리
    private final String taglineEn;        // 영어 태그라인
    private final String posterPathEn;     // 영어 포스터 경로
    private final String backdropPathEn;   // 영어 배경 이미지 경로

    private final LocalDateTime firstSeenAt; // 이 영화/DVD가 카탈로그에 최초 등장한 시점 (NEW 뱃지 기준)
}
