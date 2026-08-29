/**
 * 영화·DVD 상세(및 웰니스·의료관광 모달)에서 공통으로 쓰는 레이아웃·이용정보 패널.
 * 작품명·contentType 과 무관 — 새 카탈로그 행도 같은 여백·코랄 패널을 쓴다.
 */
export const detailInfoPanelThemeCss = `
.dh-modal-overlay {
  box-sizing: border-box;
  padding:
    max(40px, 6vh, calc(env(safe-area-inset-top, 0px) + 24px))
    20px
    max(40px, 6vh, calc(env(safe-area-inset-bottom, 0px) + 24px));
}
.dh-modal-card {
  width: min(680px, 100%);
  max-height: 100%;
}
.dh-info-panel {
  border: 1px solid rgba(244, 63, 94, 0.35);
  background:
    radial-gradient(120% 90% at 0% 0%, #fecdd3 0%, transparent 55%),
    radial-gradient(90% 80% at 100% 100%, #fb7185 0%, transparent 58%),
    linear-gradient(165deg, #fff1f2 0%, #fda4af 48%, #fb7185 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 8px 22px rgba(244, 63, 94, 0.18);
}
.dh-info-panel dt,
.dh-info-label {
  color: #9f1239 !important;
  font-weight: 800;
}
.dh-info-panel dd,
.dh-info-value,
.dh-info-panel p {
  color: #1c1917 !important;
}
`;
