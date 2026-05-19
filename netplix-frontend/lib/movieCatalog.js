/**
 * 앱 영화 카탈로그(TMDB/DB)에 실제 메타가 있는지 판별.
 * CineTrip 매핑만 있고 DB 행이 없는 스텁은 false → /dashboard/images 대신 CineTrip으로 보냄.
 */
export function hasCatalogMovieSummary(movie) {
  if (!movie?.movieName) return false;
  if (typeof movie.overview === 'string' && movie.overview.trim()) return true;
  if (typeof movie.genre === 'string' && movie.genre.trim()) return true;
  if (typeof movie.tagline === 'string' && movie.tagline.trim()) return true;
  if (movie.voteAverage != null && Number.isFinite(Number(movie.voteAverage))) return true;
  if (typeof movie.movieNameEn === 'string' && movie.movieNameEn.trim()) return true;
  if (typeof movie.releasedAt === 'string' && movie.releasedAt.trim()) return true;
  if (typeof movie.backdropPath === 'string' && movie.backdropPath.trim()) return true;
  return false;
}
