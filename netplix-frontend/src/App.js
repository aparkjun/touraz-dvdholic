import React, { useEffect, useLayoutEffect, useState } from "react";
import { initFastTap } from "./useFastTap";
import {
  BrowserRouter as Router,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
  Navigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import "bootstrap/dist/css/bootstrap.min.css";
import Dashboard from "./pages/Dashboard";
import Main from "./pages/Main";
import KakaoAuthRedirect from "./pages/KakaoAuthRedirect";
import Account from "./pages/Account";
import Support from "./pages/Support";
import Admin from "./pages/Admin";
import MovieImages from "./pages/MovieImages";
import Notifications from "./pages/Notifications";
import Mypage from "./pages/Mypage";
import DvdStores from "./pages/DvdStores";
import axios from "./axiosConfig";
import "./App.css";
import { Radar, Globe } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

/** 계정 설정 페이지 - 로그인 필요 */
function AccountRoute() {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  return <Account />;
}

/** 대시보드 - Guideline 5.1.1(v): 로그인 없이 열람 가능. OAuth 콜백 시 URL의 token 저장 */
function DashboardRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");
  const refreshFromUrl = searchParams.get("refresh_token");

  // 렌더 시점에 저장 → Dashboard의 API 호출 전에 확실히 토큰 존재
  if (tokenFromUrl) {
    localStorage.setItem("token", tokenFromUrl);
    if (refreshFromUrl) localStorage.setItem("refresh_token", refreshFromUrl);
    sessionStorage.setItem("oauth_callback_ts", Date.now().toString());
  }

  useLayoutEffect(() => {
    if (tokenFromUrl) {
      setSearchParams({});
      window.dispatchEvent(new CustomEvent("token-stored"));
    }
  }, [tokenFromUrl, setSearchParams]);

  return <Dashboard />;
}

/** 이미지 갤러리 - Guideline 5.1.1(v): 로그인 없이 열람 가능 */
function DashboardImagesRoute() {
  return <MovieImages />;
}

function BrandLink({ isDashboard, isLoggedIn }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleClick = (e) => {
    if (isDashboard && isLoggedIn) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleRadarClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate("/dvd-stores?nearby=true");
  };

  return (
    <Link className="app-brand" to="/" onClick={handleClick}>
      <img
        src="https://img.icons8.com/color/48/film-reel.png"
        alt="Home"
        className="app-brand-film"
      />
      <img src="/icons8-dvd-logo-100.png" alt="DVD Logo" className="app-brand-dvd" />
      <span className="app-brand-text">Holic</span>
      <img src="/snake-icon2.gif" alt="Snake Icon" className="app-brand-snake" />
      <Radar
        size={22}
        className="app-brand-radar"
        strokeWidth={2}
        onClick={handleRadarClick}
        style={{ cursor: "pointer" }}
        title={t("nav.findNearbyStores")}
      />
    </Link>
  );
}

function DashboardStatus({ isDashboard }) {
  return null;
}

function LanguageToggle() {
  const { i18n } = useTranslation();
  const nextLang = i18n.language?.startsWith("ko") ? "en" : "ko";
  const label = nextLang === "en" ? "EN" : "KO";
  return (
    <button
      className="app-chip app-chip-secondary"
      onClick={() => i18n.changeLanguage(nextLang)}
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", minWidth: "auto", padding: "4px 10px", fontSize: "12px" }}
    >
      <Globe size={14} />
      {label}
    </button>
  );
}

function AuthActions({ isLoggedIn, isAuthPage, pathname, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  const closeMenu = () => setMenuOpen(false);

  const navItems = [];

  if (pathname !== "/dvd-stores") {
    navItems.push(
      <li key="dvd-stores">
        <Link to="/dvd-stores?nearby=true" className="app-chip app-chip-secondary" onClick={closeMenu}>{t("nav.dvdStores")}</Link>
      </li>
    );
  }

  if (pathname !== "/support") {
    navItems.push(
      <li key="support">
        <Link to="/support" className="app-chip app-chip-secondary" onClick={closeMenu}>{t("nav.support")}</Link>
      </li>
    );
  }

  if (!isLoggedIn || isAuthPage) {
    if (pathname !== "/login") {
      navItems.push(
        <li key="login">
          <Link to="/login" className="app-chip app-chip-secondary" onClick={closeMenu}>{t("nav.login")}</Link>
        </li>
      );
    }
    if (pathname !== "/signup") {
      navItems.push(
        <li key="signup">
          <Link to="/signup" className="app-chip app-chip-primary" onClick={closeMenu}>{t("nav.signup")}</Link>
        </li>
      );
    }
    navItems.push(
      <li key="admin">
        <Link to="/admin" className="app-chip app-chip-owner" onClick={closeMenu}>{t("nav.owner")}</Link>
      </li>
    );
  } else {
    navItems.push(
      <li key="admin">
        <Link to="/admin" className="app-chip app-chip-owner" onClick={closeMenu}>{t("nav.owner")}</Link>
      </li>,
      <li key="account">
        <Link to="/account" className="app-chip app-chip-secondary" onClick={closeMenu}>{t("nav.accountSettings")}</Link>
      </li>,
      <li key="mypage">
        <Link to="/mypage" className="app-chip app-chip-mypage" onClick={closeMenu}>{t("nav.mypage")}</Link>
      </li>,
      <li key="logout">
        <button className="app-chip app-chip-primary app-chip-button" onClick={(e) => { closeMenu(); onLogout(e); }}>
          {t("nav.logout")}
        </button>
      </li>
    );
  }

  return (
    <div className="app-nav-actions">
      <div className="app-lang-desktop">
        <LanguageToggle />
      </div>
      <button
        className="app-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={t("nav.menu")}
      >
        <span className={`app-hamburger-bar ${menuOpen ? "open" : ""}`} />
        <span className={`app-hamburger-bar ${menuOpen ? "open" : ""}`} />
        <span className={`app-hamburger-bar ${menuOpen ? "open" : ""}`} />
      </button>

      <ul className="app-nav-list app-nav-desktop">
        {navItems}
      </ul>

      {menuOpen && (
        <>
          <div className="app-menu-overlay" onClick={closeMenu} />
          <div className="app-nav-mobile-panel">
            <button className="app-mobile-close" onClick={closeMenu} aria-label={t("nav.close")}>
              ✕
            </button>
            <ul className="app-nav-list app-nav-mobile">
              {navItems}
              <li key="lang">
                <LanguageToggle />
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function AppContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  // 경로 변경 시(카카오 로그인 후 /dashboard 이동 포함) 토큰 재확인
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, [location.pathname]);

  // 카카오/Apple OAuth2 리다이렉트 후 토큰 저장 시 로그인 상태 갱신
  useEffect(() => {
    const onTokenStored = () => setIsLoggedIn(!!localStorage.getItem("token"));
    window.addEventListener("token-stored", onTokenStored);
    return () => window.removeEventListener("token-stored", onTokenStored);
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      setIsLoggedIn(false);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      alert(t("nav.logoutFailed"));
    }
  };

  return (
    <div className="app-shell">
      {/* 상단 네비게이션 바 */}
      <nav className="app-nav">
        <div className="app-nav-inner">
          <BrandLink isDashboard={location.pathname === "/dashboard"} isLoggedIn={isLoggedIn} />
          <DashboardStatus isDashboard={location.pathname === "/dashboard"} />
          <AuthActions
            isLoggedIn={isLoggedIn}
            isAuthPage={isAuthPage}
            pathname={location.pathname}
            onLogout={handleLogout}
          />
        </div>
      </nav>

      {/* 페이지 라우팅 */}
      <div className="app-route-wrap">
        <Routes>
          <Route path="/" element={<Main />} />
          <Route
            path="/login"
            element={<Login setIsLoggedIn={setIsLoggedIn} />}
          />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/login/oauth2/code/kakao"
            element={<KakaoAuthRedirect />}
          />

          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/dashboard/images" element={<DashboardImagesRoute />} />
          <Route path="/account" element={<AccountRoute />} />
          <Route path="/mypage" element={<Mypage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/support" element={<Support />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/dvd-stores" element={<DvdStores />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  useEffect(() => {
    const cleanup = initFastTap();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async (event) => {
      const url = event.url;
      console.log('[App] Deep link received:', url);
      
      try {
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('token');
        const refreshToken = urlObj.searchParams.get('refresh_token');
        
        if (token) {
          localStorage.setItem('token', token);
          if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
          sessionStorage.setItem('oauth_callback_ts', Date.now().toString());
          window.dispatchEvent(new CustomEvent('token-stored'));
          
          try {
            await Browser.close();
          } catch (e) {
            console.log('[App] Browser.close error (may already be closed):', e);
          }
          
          window.location.replace('/dashboard');
        }
      } catch (e) {
        console.error('[App] Error handling deep link:', e);
      }
    };

    CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
