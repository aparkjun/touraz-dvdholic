/**
 * 오디오 전용 앱용: Picture-in-Picture 대신 브라우저/Media Session 표준으로
 * 잠금 화면 · 알림 · 블루투스 헤드셋(재생/일시정지/탐색)과 동기화.
 * Capacitor Android WebView(Chromium)에서도 대부분 동작한다.
 */

function clearHandlers() {
  if (typeof navigator === "undefined" || !navigator.mediaSession) return;
  ["play", "pause", "seekbackward", "seekforward", "stop", "previoustrack", "nexttrack"].forEach((action) => {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch (_) {
      /* 일부 액션은 미지원 */
    }
  });
}

/**
 * @param {HTMLAudioElement} audio
 * @param {{ title?: string, artist?: string, artworkUrl?: string }} meta
 * @returns {() => void} detach
 */
export function attachAudioMediaSession(audio, meta) {
  if (typeof navigator === "undefined" || !navigator.mediaSession || !audio) {
    return () => {};
  }

  const title = meta?.title?.trim() || "Audio guide";
  const artist = meta?.artist?.trim() || "Cine Audio Trail · Touraz Holic";
  const artworkUrl = meta?.artworkUrl?.trim();

  let artwork = [];
  if (artworkUrl) {
    artwork = [
      { src: artworkUrl, sizes: "512x512", type: "image/jpeg" },
      { src: artworkUrl, sizes: "256x256", type: "image/jpeg" },
    ];
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: "Odii", artwork });
  } catch (_) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: "Odii" });
    } catch (__) {
      /* noop */
    }
  }

  const seekOffset = 10;

  const applyPositionState = () => {
    if (!("setPositionState" in navigator.mediaSession)) return;
    const d = audio.duration;
    if (!d || Number.isNaN(d) || d === Infinity) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: d,
        playbackRate: audio.playbackRate,
        position: Math.min(Math.max(0, audio.currentTime), d),
      });
    } catch (_) {
      /* 일부 환경에서 범위 오류 */
    }
  };

  let posDebounce;
  const schedulePosition = () => {
    clearTimeout(posDebounce);
    posDebounce = setTimeout(applyPositionState, 350);
  };

  try {
    navigator.mediaSession.setActionHandler("play", () => {
      audio.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audio.pause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      audio.currentTime = Math.max(0, audio.currentTime - seekOffset);
      schedulePosition();
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      const end = audio.duration || 0;
      audio.currentTime = Math.min(end, audio.currentTime + seekOffset);
      schedulePosition();
    });
    navigator.mediaSession.setActionHandler("stop", () => {
      audio.pause();
      audio.currentTime = 0;
      try {
        navigator.mediaSession.playbackState = "paused";
      } catch (_) { /* noop */ }
      schedulePosition();
    });
  } catch (_) {
    /* 일부 핸들러 미지원 */
  }

  const syncPlaybackState = () => {
    try {
      navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
    } catch (_) {
      /* noop */
    }
    schedulePosition();
  };

  const onEnded = () => {
    try {
      navigator.mediaSession.playbackState = "none";
    } catch (_) {
      /* noop */
    }
  };

  audio.addEventListener("play", syncPlaybackState);
  audio.addEventListener("pause", syncPlaybackState);
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("loadedmetadata", applyPositionState);
  audio.addEventListener("timeupdate", schedulePosition);

  syncPlaybackState();

  return function detachAudioMediaSession() {
    clearTimeout(posDebounce);
    audio.removeEventListener("play", syncPlaybackState);
    audio.removeEventListener("pause", syncPlaybackState);
    audio.removeEventListener("ended", onEnded);
    audio.removeEventListener("loadedmetadata", applyPositionState);
    audio.removeEventListener("timeupdate", schedulePosition);
    clearHandlers();
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    } catch (_) { /* noop */ }
  };
}
