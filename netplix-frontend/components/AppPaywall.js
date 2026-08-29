'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Loader2 } from 'lucide-react';
import {
  fetchUnlockProduct,
  purchaseUnlock,
  queryUnlocked,
  restoreUnlock,
  shouldLockApp,
} from '@/lib/appUnlock';

export default function AppPaywall() {
  const { t } = useTranslation();
  const [needed, setNeeded] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState('₩1,000');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!shouldLockApp()) {
      setNeeded(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const [unlocked, product] = await Promise.all([
        queryUnlocked(),
        fetchUnlockProduct(),
      ]);
      if (product?.price) setPrice(product.price);
      setNeeded(!unlocked);
    } catch (e) {
      setError(e?.message || t('paywall.error'));
      setNeeded(true);
    } finally {
      setChecking(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onBuy = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await purchaseUnlock();
      if (res?.canceled) return;
      if (res?.unlocked) setNeeded(false);
      else setError(t('paywall.notUnlocked'));
    } catch (e) {
      setError(e?.message || t('paywall.error'));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await restoreUnlock();
      if (ok) setNeeded(false);
      else setError(t('paywall.restoreEmpty'));
    } catch (e) {
      setError(e?.message || t('paywall.error'));
    } finally {
      setBusy(false);
    }
  };

  if (checking || !needed) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'rgba(8, 10, 16, 0.92)',
      }}
    >
      <div
        style={{
          width: 'min(420px, 100%)',
          borderRadius: 20,
          padding: '28px 22px 22px',
          background: 'linear-gradient(165deg, #1a1524, #121018)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          color: '#fff',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(244, 63, 94, 0.18)',
            }}
          >
            <Lock size={28} color="#fb7185" />
          </div>
        </div>
        <h1 id="paywall-title" style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', margin: '0 0 8px' }}>
          {t('paywall.title')}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', textAlign: 'center', margin: '0 0 20px' }}>
          {t('paywall.body')}
        </p>
        <button
          type="button"
          onClick={onBuy}
          disabled={busy}
          style={{
            width: '100%',
            height: 52,
            border: 'none',
            borderRadius: 14,
            fontWeight: 800,
            fontSize: 16,
            color: '#fff',
            cursor: busy ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg, #fb7185, #e11d48)',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <Loader2 size={20} style={{ display: 'inline', verticalAlign: 'middle' }} className="animate-spin" />
          ) : (
            t('paywall.buy', { price })
          )}
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={busy}
          style={{
            width: '100%',
            marginTop: 10,
            height: 44,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.88)',
            fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {t('paywall.restore')}
        </button>
        {error ? (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#fda4af', textAlign: 'center' }}>{error}</p>
        ) : null}
      </div>
    </div>
  );
}
