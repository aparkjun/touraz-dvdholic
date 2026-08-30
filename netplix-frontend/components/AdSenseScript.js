import Script from "next/script";
import { getAdSenseClient } from "@/lib/adsense";

/** 사이트 인증·광고 로드용. 클라이언트 ID가 있을 때만 삽입한다. */
export default function AdSenseScript() {
  const client = getAdSenseClient();
  if (!client) return null;
  return (
    <Script
      id="adsense-init"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
