'use client';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { setUserLanguage } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export default function NavBar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('token'));
  }, [pathname]);

  useEffect(() => {
    const onTokenStored = () => setIsLoggedIn(!!localStorage.getItem('token'));
    window.addEventListener('token-stored', onTokenStored);
    return () => window.removeEventListener('token-stored', onTokenStored);
  }, []);

  const handleLogout = (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    setIsLoggedIn(false);
  };

  return (
    <nav className="app-nav">
      <div className="app-nav-inner">
        <BrandLink isDashboard={pathname === '/dashboard'} isLoggedIn={isLoggedIn} />
        <AuthActions
          isLoggedIn={isLoggedIn}
          isAuthPage={isAuthPage}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </div>
    </nav>
  );
}

function BrandLink({ isDashboard, isLoggedIn }) {
  const router = useRouter();
  const { t } = useTranslation();

  const homeHref = isLoggedIn ? '/dashboard' : '/';

  const handleClick = (e) => {
    if (isDashboard && isLoggedIn) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <Link className="app-brand" href={homeHref} onClick={handleClick}>
      <img src="https://img.icons8.com/color/48/film-reel.png" alt="Home" className="app-brand-film" />
      <img src="/icons8-dvd-logo-100.png" alt="DVD Logo" className="app-brand-dvd" />
      <span className="app-brand-text">Holic</span>
      <img src="/snake-icon2.gif" alt="Snake Icon" className="app-brand-snake" />
    </Link>
  );
}

function LanguageToggle() {
  const { i18n } = useTranslation();
  const nextLang = i18n.language?.startsWith('ko') ? 'en' : 'ko';
  const label = nextLang === 'en' ? 'EN' : 'KO';
  return (
    <button
      className="app-chip app-chip-secondary"
      onClick={() => setUserLanguage(nextLang)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 'auto', padding: '4px 10px', fontSize: '12px' }}
    >
      <Globe size={14} />
      {label}
    </button>
  );
}

function AuthActions({ isLoggedIn, isAuthPage, pathname, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  const menuRef = useRef(null);
  const hamburgerRef = useRef(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        hamburgerRef.current && !hamburgerRef.current.contains(e.target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [menuOpen]);

  const navItems = [];

  if (pathname !== '/dvd-stores') {
    navItems.push(
      <li key="dvd-stores">
        <Link href="/dvd-stores?nearby=true" className="app-chip app-chip-secondary" onClick={closeMenu}>{t('nav.dvdStores')}</Link>
      </li>
    );
  }
  if (pathname !== '/support') {
    navItems.push(
      <li key="support">
        <Link href="/support" className="app-chip app-chip-secondary" onClick={closeMenu}>{t('nav.support')}</Link>
      </li>
    );
  }

  if (!isLoggedIn || isAuthPage) {
    if (pathname !== '/login') {
      navItems.push(
        <li key="login"><Link href="/login" className="app-chip app-chip-secondary" onClick={closeMenu}>{t('nav.login')}</Link></li>
      );
    }
    if (pathname !== '/signup') {
      navItems.push(
        <li key="signup"><Link href="/signup" className="app-chip app-chip-primary" onClick={closeMenu}>{t('nav.signup')}</Link></li>
      );
    }
    navItems.push(
      <li key="admin"><Link href="/admin" className="app-chip app-chip-owner" onClick={closeMenu}>{t('nav.owner')}</Link></li>
    );
  } else {
    navItems.push(
      <li key="admin"><Link href="/admin" className="app-chip app-chip-owner" onClick={closeMenu}>{t('nav.owner')}</Link></li>,
      <li key="account"><Link href="/account" className="app-chip app-chip-secondary" onClick={closeMenu}>{t('nav.accountSettings')}</Link></li>,
      <li key="mypage"><Link href="/mypage" className="app-chip app-chip-mypage" onClick={closeMenu}>{t('nav.mypage')}</Link></li>,
      <li key="logout">
        <button className="app-chip app-chip-primary app-chip-button" onClick={(e) => { closeMenu(); onLogout(e); }}>
          {t('nav.logout')}
        </button>
      </li>
    );
  }

  if (pathname === '/') return null;

  return (
    <div className="app-nav-actions">
      <button
        ref={hamburgerRef}
        className="app-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-label={t('nav.menu')}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12L20 12" className={`app-hamburger-svg-top ${menuOpen ? 'open' : ''}`} />
          <path d="M4 12H20" className={`app-hamburger-svg-mid ${menuOpen ? 'open' : ''}`} />
          <path d="M4 12H20" className={`app-hamburger-svg-bot ${menuOpen ? 'open' : ''}`} />
        </svg>
      </button>
      {menuOpen && (
        <>
          <div className="app-menu-overlay" onClick={closeMenu} />
          <div ref={menuRef} className="app-nav-mobile-panel">
            <ul className="app-nav-list app-nav-mobile">
              {navItems}
              <li key="lang"><LanguageToggle /></li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
