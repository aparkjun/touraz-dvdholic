/** 웹 PC AdSense. 앱(AdMob)과 분리. 게시자 번호는 AdMob 계정과 동일. */

const DEFAULT_PUBLISHER = "pub-8265488633224466";
const DEFAULT_SIDE_SLOT = "4247738869";

function normalizePublisher(raw) {
  const pub = String(raw || "").trim().replace(/^ca-/, "");
  return pub.startsWith("pub-") ? pub : "";
}

export function getAdSensePublisher() {
  return (
    normalizePublisher(process.env.NEXT_PUBLIC_ADSENSE_CLIENT) || DEFAULT_PUBLISHER
  );
}

export function getAdSenseClient() {
  return `ca-${getAdSensePublisher()}`;
}

export function getAdSenseSideSlot() {
  return String(process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDE || DEFAULT_SIDE_SLOT).trim();
}

export function isAdSenseConfigured() {
  return Boolean(getAdSenseClient() && getAdSenseSideSlot());
}
