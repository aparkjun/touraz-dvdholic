'use client';

import { useEffect, useRef } from 'react';

/**
 * 모달/라이트박스가 열려 있을 때 브라우저(또는 모바일 시스템) "뒤로 가기"가
 * 페이지 이동이 아니라 모달의 onClose() 만 발화하도록 history 항목을 관리한다.
 *
 * 동작 요약:
 * 1) `isOpen` 이 true 가 되는 순간 `history.pushState()` 로 더미 history 항목을 추가.
 *    → 사용자가 "뒤로 가기"를 한 번 눌러도 실제 페이지는 이동하지 않고 popstate 만 발생.
 * 2) popstate 가 발생하면 `onClose()` 를 호출해 모달을 닫는다.
 * 3) 사용자가 X 버튼/오버레이 클릭/Esc 등으로 onClose 를 직접 호출해 isOpen 이
 *    false 로 토글되면, cleanup 에서 우리가 push 한 더미 항목을
 *    `history.back()` 으로 정리한다.
 *
 * 이 훅을 사용하면 사용자가 "사진 라이트박스에서 뒤로 가기" → "라이트박스만 닫힘"
 * 이라는 직관적인 동작을 얻을 수 있고, 두 단계 점프(`/cine-trip` → `/dashboard`)
 * 처럼 보이는 문제도 사라진다.
 */
export default function useBackButtonClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;

    let consumedByPopstate = false;

    window.history.pushState({ __modalOpen: true, __ts: Date.now() }, '');

    const handlePopstate = () => {
      consumedByPopstate = true;
      onCloseRef.current?.();
    };

    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
      if (!consumedByPopstate) {
        try {
          window.history.back();
        } catch {}
      }
    };
  }, [isOpen]);
}
