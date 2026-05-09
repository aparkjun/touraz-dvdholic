package fast.campus.netplix.audioguide;

/**
 * 오디오 가이드(Odii) 연결 상태 — UI 에 원인 안내용 (키 노출 없음).
 *
 * @param odiiApiKeyConfigured 서버에 공공데이터 API 키·베이스 URL 이 채워졌는지
 * @param themeKoSampleCount   설정된 경우 한국어 테마 목록에서 즉시 가져올 수 있는 표본 건수(최대 3)
 */
public record AudioGuideOdiiMeta(boolean odiiApiKeyConfigured, int themeKoSampleCount) {}
