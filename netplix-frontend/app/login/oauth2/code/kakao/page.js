'use client';

import React, { useEffect, useState } from 'react';
import axios from '@/lib/axiosConfig';
import { getApiBaseUrl } from '@/lib/apiConfig';
import OAuthLoadingOverlay from '@/components/ui/OAuthLoadingOverlay';

function isNativeOrigin() {
    if (typeof window === 'undefined') return false;
    const origin = (window.location?.origin || '').toLowerCase();
    return (
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        origin.startsWith('file://') ||
        origin === '' ||
        origin === 'null'
    );
}

function redirectTo(path) {
    if (typeof window === 'undefined') return;
    // Capacitor 네이티브/로컬 스킴에서는 Heroku 절대 URL로 나가면 앱 밖으로 빠지므로 상대 경로 사용
    if (isNativeOrigin()) {
        window.location.replace(path);
        return;
    }
    const base = getApiBaseUrl() || window.location.origin;
    const url = base.startsWith('http') ? base.replace(/\/$/, '') + path : path;
    window.location.replace(url);
}

// 이미 소비된 code로 재진입(뒤로가기 등) 시 무한 로딩을 막기 위한 가드 키
const CONSUMED_CODES_KEY = 'kakao_consumed_codes';
const MAX_REMEMBERED = 20;

function getConsumedCodes() {
    try {
        const raw = sessionStorage.getItem(CONSUMED_CODES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function markCodeConsumed(code) {
    try {
        const list = getConsumedCodes();
        if (!list.includes(code)) {
            list.push(code);
            while (list.length > MAX_REMEMBERED) list.shift();
            sessionStorage.setItem(CONSUMED_CODES_KEY, JSON.stringify(list));
        }
    } catch {}
}

function KakaoAuthRedirect() {
    const [timeoutReached, setTimeoutReached] = useState(false);

    useEffect(() => {
        const params = new URL(window.location.href).searchParams;
        const code = params.get('code');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        if (error) {
            console.error('OAuth 오류:', error, errorDescription);
            redirectTo('/login?error=oauth');
            return;
        }

        // 뒤로가기 등으로 이 페이지에 재진입했을 때: 토큰이 이미 있으면 마이페이지로,
        // 이미 소비된 code면 재호출하지 않고 상태에 맞춰 이동 (무한 로딩 방지)
        const existingToken = (typeof localStorage !== 'undefined') && localStorage.getItem('token');
        const consumed = code && getConsumedCodes().includes(code);
        if (existingToken) {
            redirectTo('/mypage');
            return;
        }
        if (consumed) {
            redirectTo('/login');
            return;
        }

        if (!code) {
            redirectTo('/login');
            return;
        }

        // 네트워크 행업 대비 안전 타임아웃 (15초): 토큰이 있으면 마이페이지로, 없으면 로그인으로
        const timeoutId = setTimeout(() => {
            setTimeoutReached(true);
            const t = (typeof localStorage !== 'undefined') && localStorage.getItem('token');
            redirectTo(t ? '/mypage' : '/login?error=timeout');
        }, 15000);

        axios
            .post('/api/v1/auth/callback', { code })
            .then((response) => {
                const data = response.data?.data;
                markCodeConsumed(code);
                if (data?.accessToken) {
                    localStorage.setItem('token', data.accessToken);
                    if (data.refreshToken) {
                        localStorage.setItem('refresh_token', data.refreshToken);
                    }
                    window.dispatchEvent(new CustomEvent('token-stored'));
                    clearTimeout(timeoutId);
                    redirectTo('/mypage');
                } else {
                    clearTimeout(timeoutId);
                    redirectTo('/login');
                }
            })
            .catch((err) => {
                console.error('카카오 로그인 실패:', err);
                markCodeConsumed(code);
                clearTimeout(timeoutId);
                const t = (typeof localStorage !== 'undefined') && localStorage.getItem('token');
                redirectTo(t ? '/mypage' : '/login?error=callback');
            });

        return () => clearTimeout(timeoutId);
    }, []);

    return <OAuthLoadingOverlay />;
}

export default KakaoAuthRedirect;
