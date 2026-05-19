import "bootstrap/dist/css/bootstrap.min.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Providers from "@/components/Providers";
import AppRouteTheme from "@/components/AppRouteTheme";
import FloatingBackButton from "@/components/FloatingBackButton";

export const metadata = {
  title: "Holic Store",
  description: "HOLIC DVD Store - 인기 DVD 스토어",
  icons: {
    icon: [{ url: "/favicon-snake.png", type: "image/png", sizes: "32x32" }],
    shortcut: "/favicon-snake.png",
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="theme-color" content="#32363a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HOLIC" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/d2coding@1.3.2/d2coding-full.css" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <AppRouteTheme>
            <div className="app-shell">
              <NavBar />
              <div className="app-route-wrap">
                {children}
              </div>
              <FloatingBackButton />
            </div>
          </AppRouteTheme>
        </Providers>
      </body>
    </html>
  );
}
