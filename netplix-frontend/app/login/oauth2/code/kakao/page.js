'use client';

import React, { useEffect, useState } from 'react';
import axios from '@/lib/axiosConfig';
import OAuthLoadingOverlay from '@/components/ui/OAuthLoadingOverlay';
import { clearOAuthRedirectPending } from '@/lib/oauthPending';

function redirectTo(path) {
    if (typeof window === 'undefined') return;
    // SPA 경로는 항상 현재 WebView/브라우저 origin 기준(상대 경로). API 베이스 URL로 열면 Spring이 페이지를 못 줘 500.
    window.location.replace(path.startsWith('/') ? path : `/${path}`);
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
            clearOAuthRedirectPending();
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
            clearOAuthRedirectPending();
            redirectTo('/login');
            return;
        }

        if (!code) {
            clearOAuthRedirectPending();
            redirectTo('/login');
            return;
        }

        // 네트워크 행업 대비 안전 타임아웃 (15초): 토큰이 있으면 마이페이지로, 없으면 로그인으로
        const timeoutId = setTimeout(() => {
            setTimeoutReached(true);
            const t = (typeof localStorage !== 'undefined') && localStorage.getItem('token');
            if (!t) clearOAuthRedirectPending();
            redirectTo(t ? '/mypage' : '/login?error=timeout');
        }, 15000);

        axios
            .post('/api/v1/auth/callback', { code })
            .then((response) => {
                const data = response.data?.data;
                markCodeConsumed(code);
                if (data?.accessToken) {
                    clearOAuthRedirectPending();
                    localStorage.setItem('token', data.accessToken);
                    if (data.refreshToken) {
                        localStorage.setItem('refresh_token', data.refreshToken);
                    }
                    window.dispatchEvent(new CustomEvent('token-stored'));
                    clearTimeout(timeoutId);
                    redirectTo('/mypage');
                } else {
                    clearOAuthRedirectPending();
                    clearTimeout(timeoutId);
                    redirectTo('/login');
                }
            })
            .catch((err) => {
                console.error('카카오 로그인 실패:', err);
                markCodeConsumed(code);
                clearOAuthRedirectPending();
                clearTimeout(timeoutId);
                const t = (typeof localStorage !== 'undefined') && localStorage.getItem('token');
                redirectTo(t ? '/mypage' : '/login?error=callback');
            });

        return () => clearTimeout(timeoutId);
    }, []);

    return <OAuthLoadingOverlay />;
}

export default KakaoAuthRedirect;
