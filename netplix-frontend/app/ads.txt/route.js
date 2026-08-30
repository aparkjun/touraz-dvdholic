import { getAdSensePublisher } from "@/lib/adsense";

export const dynamic = "force-dynamic";

/** AdSense 사이트 인증용. 게시자 ID는 ca-pub-… 또는 pub-… 모두 허용. */
export function GET() {
  const pub = getAdSensePublisher();
  if (!pub.startsWith("pub-")) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
