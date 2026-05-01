/**
 * [Deprecated] FastTap 폴리필.
 *
 * 과거에는 iOS/Android 의 300ms 터치 지연(double-tap zoom 인식 대기)을
 * 제거하기 위해 touchend 에서 수동으로 click() 을 합성했다.
 *
 * 그러나 globals.css 에서 모든 클릭 가능 요소(button, a, [role="button"],
 * .js-fast-tap …)에 `touch-action: manipulation` 을 적용하고 있으며,
 * 모던 모바일 브라우저(iOS WKWebView / Android WebView 포함)는 이 한 줄만으로
 * 300ms 지연을 제거한다.
 *
 * 폴리필을 함께 사용하면 한 번의 탭에 대해
 *   1) 우리가 합성한 click()
 *   2) 브라우저가 발생시킨 native click
 * 이 둘 다 실행되어 "두 번 탭한 것처럼" 동작하는 버그가 발생한다.
 * (메뉴 열렸다 즉시 닫힘, 토글 버튼 무반응, 모달 깜빡임 등)
 *
 * 그래서 본 폴리필은 비활성화하였다. import 하는 곳에서 깨지지 않도록
 * `initFastTap` 시그니처는 유지하되 아무 동작도 하지 않는다.
 */
export function initFastTap() {
  return () => {};
}
