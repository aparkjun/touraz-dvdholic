'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { navigateBack } from '@/lib/navigateBack';

/** 홈(뒤로갈 상위가 없는 화면)에서는 숨김 */
const BACK_HIDDEN_PATHS = new Set(['/', '/dashboard', '/mypage']);

const baseButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  padding: 0,
  background: 'linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '50%',
  color: 'rgba(255,255,255,0.85)',
  cursor: 'pointer',
  transition: 'all 0.25s ease',
  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  pointerEvents: 'auto',
};

const bottomFixedStyle = {
  position: 'fixed',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
  left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
  zIndex: 1100,
};

function applyHover(e) {
  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,59,92,0.3), rgba(91,140,255,0.3))';
  e.currentTarget.style.transform = 'scale(1.1)';
  e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,59,92,0.25)';
}

function clearHover(e) {
  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))';
  e.currentTarget.style.transform = 'scale(1)';
  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
}

const topFixedStyle = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
  left: 'calc(env(safe-area-inset-left, 0px) + 12px)',
  zIndex: 1100,
};

export default function FloatingBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();

  if (!pathname) return null;
  if (BACK_HIDDEN_PATHS.has(pathname)) return null;

  const label = t('common.back', '뒤로');

  const handleBack = () => {
    navigateBack(router, '/dashboard');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleBack}
        aria-label={label}
        title={label}
        className="floating-back-btn"
        style={{ ...baseButtonStyle, ...topFixedStyle }}
        onMouseEnter={applyHover}
        onMouseLeave={clearHover}
      >
        <Undo2 size={20} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={handleBack}
        aria-label={label}
        title={label}
        className="floating-back-btn"
        style={{ ...baseButtonStyle, ...bottomFixedStyle }}
        onMouseEnter={applyHover}
        onMouseLeave={clearHover}
      >
        <Undo2 size={20} strokeWidth={2.5} />
      </button>
    </>
  );
}
