package fast.campus.netplix.translation;

import java.util.List;

/**
 * 짧은 텍스트(제목·해설 대본 등) 다국어 번역 Port.
 *
 * <p>오디오 가이드(Odii) 원본은 상당수 관광지에 한국어 해설만 존재한다. 비한국어 사용자에게
 * 해당 언어 해설을 제공하기 위해, 한국어 원문을 영어/중국어/일본어로 번역할 때 사용한다.
 *
 * <p>구현체는 외부 LLM(OpenAI) 호출 + 인메모리 캐시를 담당하며, <b>절대 예외를 던지지 않고</b>
 * 실패 시 입력 원문을 그대로 반환한다(호출부가 한국어 폴백으로 자연 degrade 되도록).
 */
public interface TextTranslationPort {

    /** 번역 사용 가능 여부(API 키 설정). false 면 호출부는 번역을 건너뛴다. */
    boolean isAvailable();

    /**
     * 입력 텍스트들을 targetLang(en|zh|ja)으로 번역한다.
     *
     * <p>반환 리스트는 입력과 <b>같은 크기·같은 순서</b>를 보장한다. 빈/공백 문자열은 그대로 둔다.
     * 번역 실패·미지원 언어·키 미설정 시 입력 원문을 그대로 반환한다.
     */
    List<String> translate(List<String> texts, String targetLang);
}
