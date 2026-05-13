"use client";

/**
 * AudioGuideDetailModal — 관광지/이야기 오디오 가이드 상세 모달.
 *
 * <p>/audio-guide 페이지와 NearbyAudioGuideStrip 양쪽에서 공통 사용한다.
 *  - 카드 클릭 시 이 모달이 열려 큰 이미지 · 스크립트 전문 · 재생 컨트롤 제공
 *  - 좌표가 있으면 Google/Kakao Map 바로가기 · 대중교통 길찾기(내 위치→목적지) 제공
 *  - ESC 키 / 배경 클릭 / X 버튼으로 닫기
 *  - 모달이 닫힐 때 재생 자동 정지
 *  - Odii 스크립트 TTS: 합성 언어는 API 의 language(langCode) 우선·요청 Odii 언어 보조.
 *  - Odii가 audioUrl(mp3)를 주면 네이티브 재생; 없을 때만 브라우저 TTS(대본).
 *    ko=음성 피커, en/zh/ja=해당 로케일 음성 자동 선택(전 항목 공통, 브라우저 기본 오·오선택 방지).
 *    Odii 가 내려준 audioUrl 이 있으면 네이티브 오디오 재생(TTS 미사용).
 *
 * <p>Props:
 *  - item: AudioGuideItemResponse (모달에 표시할 대상)
 *  - onClose: 닫기 콜백 (필수)
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { attachAudioMediaSession } from "@/lib/audioMediaSession";
import useBackButtonClose from "@/lib/useBackButtonClose";
import {
  getAudioGuideOdiiLang,
  isValidOdiiLang,
  defaultOdiiLangFromUiLang,
  setAudioGuideOdiiLang,
  subscribeAudioGuideOdiiLang,
  ODII_LANG_CODES,
  odiiLangChipLabel,
} from "@/lib/audioGuideOdiiLang";
import VoiceMicIcon from "@/components/VoiceMicIcon";
import {
  X,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  MapPin,
  Clock,
  Globe2,
  ExternalLink,
  Tag,
  Radio,
  BookOpen,
  Square,
  Info,
  Loader2,
  Navigation,
  Mic,
} from "lucide-react";

const TTS_KO_VOICE_STORAGE_KEY = "audioGuideDetailModal.ttsVoiceKo";
/** utter.voice 미지정 — 보이스 피커 도입 전과 같이 브라우저·OS 가 lang 기준으로 고름 */
const TTS_KO_BUILTIN_KEY = "__browser_default_ko__";

/** 브라우저 voice 객체를 안정적으로 구별 */
function ttsVoiceKey(v) {
  if (!v) return "";
  return v.voiceURI || `${v.name}|${v.lang}`;
}

/** `<select>` 옵션에 쓰는 표시문 — getVoices() 가 이름은 다르게 주면서 화면엔 똑같이 보일 때가 있어, 중복 제거 키와 반드시 동일 규칙 */
function ttsVoiceOptionCaption(v) {
  if (!v) return "";
  const n = (v.name || "").trim();
  if (n) return n;
  return (v.lang || "").trim() || ttsVoiceKey(v);
}

/** 화면에 보이는 캡션 기준 중복 제거(NFKC·공백 정규화) — 목록에 글자까지 동일한 두 줄이 나오지 않게 */
function ttsVoiceCaptionDedupeKey(v) {
  let s = ttsVoiceOptionCaption(v);
  try {
    s = s.normalize("NFKC");
  } catch (_) {
    /* noop */
  }
  s = s.replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s || ttsVoiceKey(v);
}

/** voiceURI 중복·화면 캡션 중복을 제거(OS/브라우저가 같은 음성을 두 줄로 줄이는 경우) */
function dedupeTtsVoices(voices) {
  if (!voices?.length) return [];
  const uriSeen = new Set();
  const step1 = [];
  for (const v of voices) {
    const u = v.voiceURI || "";
    if (u) {
      if (uriSeen.has(u)) continue;
      uriSeen.add(u);
    }
    step1.push(v);
  }
  const byCaption = new Map();
  for (const v of step1) {
    const key = ttsVoiceCaptionDedupeKey(v);
    const cur = byCaption.get(key);
    if (!cur || (v.default && !cur.default)) byCaption.set(key, v);
  }
  return [...byCaption.values()];
}

function filterKoVoices(voices) {
  if (!voices?.length) return [];
  const out = voices.filter((v) => {
    const l = (v.lang || "").toLowerCase();
    if (l.startsWith("ko")) return true;
    if (l.includes("ko-") || l.includes("kr")) return true;
    const n = (v.name || "").toLowerCase();
    return n.includes("korean") || n.includes("google ko") || n.includes("yuna") || n.includes("hee");
  });
  const deduped = dedupeTtsVoices(out);
  return [...deduped].sort((a, b) => (a.name || "").localeCompare(b.name || "", "ko"));
}

/**
 * 일본어 TTS용 음성만 남긴다. zh/cmn/yue·중국어 계열 이름은 제외해
 * 한자 대본이 중국어 음으로 읽히는 문제를 막는다.
 */
function filterJaVoices(voices) {
  if (!voices?.length) return [];
  const out = [];
  for (const v of voices) {
    const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const n = (v.name || "").toLowerCase();
    if (l.startsWith("zh") || l.startsWith("cmn") || l.startsWith("yue") || l.startsWith("zho")) continue;
    if (
      n.includes("chinese")
      || n.includes("mandarin")
      || n.includes("cantonese")
      || n.includes("中文")
      || /huihui|yaoyao|kangkang|hanhan|ting-ting|zhang|li-na|meijia/i.test(n)
    ) {
      continue;
    }
    if (l.startsWith("ja")) {
      out.push(v);
      continue;
    }
    if (
      n.includes("japanese")
      || n.includes("日本語")
      || /\b(ja|jp)\b.*japan|japan.*\b(ja|jp)\b/i.test(n)
      || /kyoko|otoya|hattori|nanami|haruka|leda|sakura|sumi/i.test(n)
    ) {
      out.push(v);
    }
  }
  return dedupeTtsVoices(out);
}

/** ja-JP·클라우드/Neural 계열을 우선해 일본어 네이티브에 가깝게 */
function jaVoicePreferenceScore(v) {
  const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
  const n = (v.name || "").toLowerCase();
  let s = 0;
  if (l === "ja-jp") s += 120;
  else if (l.startsWith("ja")) s += 90;
  if (v.default) s += 25;
  if (n.includes("google") && (n.includes("ja") || l.startsWith("ja"))) s += 45;
  if (n.includes("microsoft") && l.startsWith("ja")) s += 40;
  if (n.includes("neural") || n.includes("premium") || n.includes("natural")) s += 20;
  if (/kyoko|otoya|hattori|nanami|haruka/i.test(n)) s += 15;
  if (n.includes("chinese") || n.includes("mandarin")) s -= 80;
  return s;
}

/**
 * 중국어(간체·북경어 우선) TTS 음성만 남긴다. ja/ko/en 단독 로캘이면서 중국어 표식이 없으면 제외.
 * 광동어(yue)는 관광 한자 대본(보통 만다린)과 어울리지 않는 경우가 많아, 다른 중국어 음성이 하나라도 있으면 yue 는 제외한다.
 */
function filterZhVoices(voices) {
  if (!voices?.length) return [];
  const primary = [];
  const yueOnly = [];
  for (const v of voices) {
    const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const n = (v.name || "").toLowerCase();
    if (l.startsWith("ja") || l.startsWith("ko")) continue;
    if (l.startsWith("en") && !n.includes("chinese") && !n.includes("mandarin") && !n.includes("中文")) continue;
    if (l.startsWith("yue")) {
      yueOnly.push(v);
      continue;
    }
    if (l.startsWith("zh") || l.startsWith("cmn") || l.startsWith("zho")) {
      primary.push(v);
      continue;
    }
    if (
      n.includes("chinese")
      || n.includes("mandarin")
      || n.includes("cantonese")
      || n.includes("中文")
      || n.includes("汉语")
      || /huihui|yaoyao|kangkang|hanhan|ting-ting|zhang|meijia|xiaoxiao|yunxi/i.test(n)
    ) {
      primary.push(v);
    }
  }
  const dedupedPrimary = dedupeTtsVoices(primary);
  if (dedupedPrimary.length) return dedupedPrimary;
  return dedupeTtsVoices(yueOnly);
}

/** zh-CN / cmn-CN·Neural 을 우선. yue(광동어)는 만다린 대비 점수 낮게(필요 시에만 후순위). */
function zhVoicePreferenceScore(v) {
  const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
  const n = (v.name || "").toLowerCase();
  let s = 0;
  if (l === "zh-cn" || l === "cmn-cn") s += 125;
  else if (l.startsWith("cmn")) s += 110;
  else if (l.startsWith("zh-cn") || l.startsWith("zh-hans")) s += 115;
  else if (l.startsWith("zh-tw") || l.startsWith("zh-hant") || l === "cht" || l.startsWith("zh-hk")) s += 95;
  else if (l.startsWith("zh")) s += 84;
  else if (l.startsWith("yue")) s += 22;
  else if (l.startsWith("zho")) s += 82;
  if (v.default) s += 20;
  if (n.includes("cantonese") || l.startsWith("yue")) s -= 35;
  if (n.includes("google") && (l.startsWith("zh") || l.startsWith("cmn") || l.startsWith("yue"))) s += 42;
  if (n.includes("microsoft") && (l.startsWith("zh") || l.startsWith("cmn"))) s += 38;
  if (n.includes("neural") || n.includes("premium") || n.includes("natural")) s += 18;
  if (n.includes("japanese") || n.includes("日本語")) s -= 90;
  return s;
}

function pickBestZhVoice(allVoices) {
  const list = filterZhVoices(allVoices);
  if (!list.length) return null;
  return [...list].sort((a, b) => zhVoicePreferenceScore(b) - zhVoicePreferenceScore(a))[0];
}

function pickBestJaVoice(allVoices) {
  const list = filterJaVoices(allVoices);
  if (!list.length) return null;
  return [...list].sort((a, b) => jaVoicePreferenceScore(b) - jaVoicePreferenceScore(a))[0];
}

/** 영어 TTS — es/fr 등 다른 로캘 음성이 잡히지 않게 en* 위주로 고른다. */
function filterEnVoices(voices) {
  if (!voices?.length) return [];
  const out = [];
  for (const v of voices) {
    const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
    const n = (v.name || "").toLowerCase();
    if (
      l.startsWith("zh")
      || l.startsWith("cmn")
      || l.startsWith("zho")
      || l.startsWith("yue")
      || l.startsWith("ja")
      || l.startsWith("ko")
    ) {
      continue;
    }
    if (l.startsWith("es") || l.startsWith("fr") || l.startsWith("de") || l.startsWith("it") || l.startsWith("pt")) {
      if (!n.includes("english")) continue;
    }
    if (l.startsWith("en")) {
      out.push(v);
      continue;
    }
    if (n.includes("english") || /\benglish\b/i.test(n)) {
      out.push(v);
    }
  }
  return dedupeTtsVoices(out);
}

function enVoicePreferenceScore(v) {
  const l = (v.lang || "").toLowerCase().replace(/_/g, "-");
  const n = (v.name || "").toLowerCase();
  let s = 0;
  if (l === "en-us") s += 110;
  else if (l.startsWith("en-gb")) s += 95;
  else if (l.startsWith("en")) s += 80;
  if (v.default) s += 18;
  if (n.includes("google") && l.startsWith("en")) s += 42;
  if (n.includes("microsoft") && l.startsWith("en")) s += 38;
  if (n.includes("neural") || n.includes("premium") || n.includes("natural")) s += 20;
  return s;
}

function pickBestEnVoice(allVoices) {
  const list = filterEnVoices(allVoices);
  if (!list.length) return null;
  return [...list].sort((a, b) => enVoicePreferenceScore(b) - enVoicePreferenceScore(a))[0];
}

/** Chrome 등에서 최초 getVoices() 가 빈 배열일 때 voiceschanged 까지 대기 */
function waitForSpeechVoicesLoaded(synth, { timeoutMs = 900 } = {}) {
  const initial = synth.getVoices();
  if (initial.length) return Promise.resolve(initial);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onVoices);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const onVoices = () => {
      if (synth.getVoices().length) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener("voiceschanged", onVoices);
  });
}

/**
 * Odii item.language(langCode) 에서 canonical ko|en|zh|ja 추출.
 * 서버 VisitKoreaOdiiHttpClient.canonicalOdiiLang 과 같은 규칙.
 */
function normalizeOdiiLangFromApiField(langField) {
  if (langField == null || String(langField).trim() === "") return null;
  const c = String(langField).trim().toLowerCase();
  /** Odii GW langCode 계열 — VisitKoreaOdiiHttpClient.canonicalOdiiLang 과 동일 */
  if (c === "kor" || c === "ko") return "ko";
  if (c === "eng" || c === "en") return "en";
  if (c === "chs" || c === "cht" || c === "cn" || c === "cn1" || c.startsWith("zh")) return "zh";
  if (c === "jpn" || c === "jp" || c.startsWith("ja")) return "ja";
  if (isValidOdiiLang(c)) return c;
  return null;
}

/**
 * 스크립트 읽기(Web Speech) 언어.
 * 목록 row 의 lang 표기와 사용자가 모달에서 고른 Odii 언어가 다르면 사용자 선택을 우선한다
 * (예: 한국어 목록으로 열었는데 칩만 중국어로 바꾼 경우 — 대본은 zh 인데 ko 음성으로 읽는 버그 방지).
 */
function effectiveOdiiLangForSpeech(itemLangField, requestOdiiLang) {
  const fromItem = normalizeOdiiLangFromApiField(itemLangField);
  const req =
    normalizeOdiiLangFromApiField(requestOdiiLang)
    ?? (isValidOdiiLang(requestOdiiLang) ? requestOdiiLang : null);
  if (req && fromItem && req !== fromItem) return req;
  if (fromItem) return fromItem;
  if (req) return req;
  return "ko";
}

/** Web Speech API 기본 lang (utter.voice 는 applyTtsVoiceToUtter 에서 zh/ja/en 별도 지정). */
function odiiCanonicalToBcp47Lang(canonical) {
  switch (canonical) {
    case "en":
      return "en-US";
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja-JP";
    case "ko":
    default:
      return "ko-KR";
  }
}

function pickInitialKoVoiceKey(list) {
  let saved = "";
  try {
    saved = localStorage.getItem(TTS_KO_VOICE_STORAGE_KEY) || "";
  } catch (_) {
    /* noop */
  }
  if (saved === TTS_KO_BUILTIN_KEY) return TTS_KO_BUILTIN_KEY;
  if (saved && list.some((v) => ttsVoiceKey(v) === saved)) return saved;
  return TTS_KO_BUILTIN_KEY;
}

/**
 * Odii canonical: ko=피커, zh/ja/en=해당 로캘 음성 명시(모든 스토리·대본 TTS 공통).
 */
function applyTtsVoiceToUtter(utter, odiiCanonical, koKey) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const canonical = isValidOdiiLang(odiiCanonical) ? odiiCanonical : "ko";
  utter.rate = 1;
  utter.pitch = 1;
  void window.speechSynthesis.getVoices();
  const all = window.speechSynthesis.getVoices();

  if (canonical === "ja") {
    utter.lang = "ja-JP";
    const jaVoice = pickBestJaVoice(all);
    if (jaVoice) {
      utter.voice = jaVoice;
      const jl = (jaVoice.lang || "").trim();
      utter.lang = jl.toLowerCase().startsWith("ja") ? jl : "ja-JP";
    } else {
      utter.voice = null;
      utter.lang = "ja-JP";
    }
    return;
  }

  if (canonical === "en") {
    utter.lang = "en-US";
    const enVoice = pickBestEnVoice(all);
    if (enVoice) {
      utter.voice = enVoice;
      const el = (enVoice.lang || "").trim();
      utter.lang = el.toLowerCase().startsWith("en") ? el : "en-US";
    } else {
      utter.voice = null;
      utter.lang = "en-US";
    }
    return;
  }

  if (canonical === "zh") {
    utter.lang = "zh-CN";
    const zhVoice = pickBestZhVoice(all);
    if (zhVoice) {
      utter.voice = zhVoice;
      const zl = (zhVoice.lang || "").trim();
      const zln = zl.toLowerCase().replace(/_/g, "-");
      if (
        zln.startsWith("zh")
        || zln.startsWith("cmn")
        || zln.startsWith("yue")
        || zln.startsWith("zho")
      ) {
        utter.lang = zl;
      } else {
        utter.lang = "zh-CN";
      }
    } else {
      utter.voice = null;
      utter.lang = "zh-CN";
    }
    return;
  }

  utter.lang = odiiCanonicalToBcp47Lang(canonical);
  if (canonical !== "ko") {
    utter.voice = null;
    return;
  }
  if (koKey === TTS_KO_BUILTIN_KEY) {
    utter.voice = null;
    return;
  }
  const koVoices = filterKoVoices(all);
  if (!koVoices.length) {
    utter.voice = null;
    return;
  }
  const voice =
    (koKey && koVoices.find((v) => ttsVoiceKey(v) === koKey))
    || koVoices.find((v) => v.default)
    || koVoices[0];
  utter.voice = voice;
  const vl = (voice.lang || "").trim();
  utter.lang = vl || "ko-KR";
}

/**
 * Google Maps 길찾기 — origin 이 있으면 내 위치 기준, 없으면 목적지만(앱에서 출발지 선택).
 * travelmode=transit: 대중교통 안내.
 */
function buildGoogleDirectionsUrl({ destLat, destLng, userPos }) {
  if (destLat == null || destLng == null) return null;
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("destination", `${destLat},${destLng}`);
  if (userPos?.lat != null && userPos?.lng != null) {
    params.set("origin", `${userPos.lat},${userPos.lng}`);
  }
  params.set("travelmode", "transit");
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * 카카오맵 길찾기 — 공식 웹 URL.
 * @see https://apis.map.kakao.com/web/guide/#routeurl
 */
function buildKakaoDirectionsUrl({ destLat, destLng, destName, userPos, startName }) {
  if (destLat == null || destLng == null) return null;
  const d = destName && String(destName).trim() ? String(destName).trim() : "Destination";
  if (userPos?.lat != null && userPos?.lng != null) {
    const s = startName && String(startName).trim() ? String(startName).trim() : "Start";
    return `https://map.kakao.com/link/by/traffic/${encodeURIComponent(s)},${userPos.lat},${userPos.lng}/${encodeURIComponent(d)},${destLat},${destLng}`;
  }
  return `https://map.kakao.com/link/to/${encodeURIComponent(d)},${destLat},${destLng}`;
}

/** 상단 Odii 칩(ko|en|zh|ja)과 i18n 리소스 언어를 맞춘다 — 사이트 UI 언어와 무관하게 모달 카피를 바꾼다 */
function odiiLangToI18nLng(odii) {
  if (odii === "en") return "en";
  if (odii === "zh") return "zh";
  if (odii === "ja") return "ja";
  return "ko";
}

export default function AudioGuideDetailModal({
  item, onClose, odiiLang: odiiLangProp, anchorLat, anchorLng,
}) {
  const { t, i18n } = useTranslation();
  /** 모달 안에서 바꿀 수 있는 Odii 데이터 언어(ko|en|zh|ja) — 상단 칩과 sessionStorage 동기화 */
  const [modalOdiiLang, setModalOdiiLang] = useState("ko");
  const odiiUiLng = useMemo(
    () => odiiLangToI18nLng(isValidOdiiLang(modalOdiiLang) ? modalOdiiLang : "ko"),
    [modalOdiiLang],
  );
  const td = useCallback(
    (key, def) => t(key, { lng: odiiUiLng, defaultValue: def }),
    [t, odiiUiLng],
  );
  const audioRef = useRef(null);
  const mediaSessionDetachRef = useRef(null);
  const ttsVoiceSelectId = useId();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  // --- TTS (Web Speech API) 상태 ---
  // Odii: audioUrl 이 있으면 네이티브 <audio> 재생. 없을 때만 Web Speech API 로 대본 읽기.
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  /** 브라우저가 노출한 한국어 음성 목록 — ko 스크립트만 사용자 선택 피커 적용 */
  const [koVoices, setKoVoices] = useState([]);
  const [ttsKoVoiceKey, setTtsKoVoiceKey] = useState("");
  /** 한국어 피커 마지막 조작 — 적용 줄 하이라이트용 */
  const [ttsLastPickerRow, setTtsLastPickerRow] = useState(null);

  // --- THEME 카드 → 연관 해설 이야기(STORY) 목록 상태 ---
  // Odii API 는 THEME 응답에 script 를 내려주지 않는다. 대신 STORY 가 tid 로 연결된다.
  // 이 모달이 THEME 아이템을 열면 연관 STORY 들을 불러와 각자 TTS 로 재생할 수 있게 한다.
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [activeStoryPaused, setActiveStoryPaused] = useState(false);
  /** STORY 행 `<audio>` 네이티브 재생 중인 항목 id (제목 옆 음성 GIF 동기화) */
  const [liveStoryNativeId, setLiveStoryNativeId] = useState(null);

  // 리스트 응답은 lite(description 생략)로 내려오므로, STORY 상세에서만 필요한 script 를 지연 조회한다.
  const [loadedDesc, setLoadedDesc] = useState(null);
  /** THEME: 모달 Odii 언어 칩이 리스트 row 와 다를 때 /detail 로 동일 tid 의 해당 언어 레코드 보강 */
  const [themeLangDetail, setThemeLangDetail] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setTtsSupported(true);
    }
  }, []);

  /** speechSynthesis 음성 목록 — 한국어 피커만 사용 */
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
    const synth = window.speechSynthesis;
    const refresh = () => {
      const all = synth.getVoices();
      const koList = filterKoVoices(all);
      setKoVoices(koList);
      setTtsKoVoiceKey((prev) => {
        if (!koList.length) return prev === TTS_KO_BUILTIN_KEY ? TTS_KO_BUILTIN_KEY : "";
        if (prev === TTS_KO_BUILTIN_KEY) return TTS_KO_BUILTIN_KEY;
        if (prev && koList.some((v) => ttsVoiceKey(v) === prev)) return prev;
        return pickInitialKoVoiceKey(koList);
      });
    };
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    return subscribeAudioGuideOdiiLang(() => {
      setModalOdiiLang(getAudioGuideOdiiLang(defaultOdiiLangFromUiLang(i18n?.language)));
    });
  }, [i18n?.language]);

  // 새 item 이 열릴 때마다 오디오/TTS 리셋
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setAudioError(false);
    setTtsPlaying(false);
    setTtsPaused(false);
    setActiveStoryId(null);
    setActiveStoryPaused(false);
    setLiveStoryNativeId(null);
    setLoadedDesc(null);
    setThemeLangDetail(null);
    setTtsLastPickerRow(null);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    }
    return () => {
      if (mediaSessionDetachRef.current) {
        try { mediaSessionDetachRef.current(); } catch (_) { /* noop */ }
        mediaSessionDetachRef.current = null;
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (_) { /* noop */ }
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
      }
    };
  }, [item?.id]);

  /** Odii 언어·보강된 theme audioUrl 이 바뀌면 네이티브 <audio> 인스턴스를 버려 다음 재생이 새 URL 을 쓰게 한다. */
  useEffect(() => {
    if (!item?.id) return;
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) { /* noop */ }
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setAudioError(false);
  }, [item?.id, item?.type, modalOdiiLang, themeLangDetail?.audioUrl, item?.audioUrl]);

  // 상단 칩·세션·부모 prop 과 모달 Odii 언어 동기화 (항목 전환 시 포함)
  useEffect(() => {
    if (!item?.id) return;
    const nextOdii = isValidOdiiLang(odiiLangProp)
      ? odiiLangProp
      : getAudioGuideOdiiLang(defaultOdiiLangFromUiLang(i18n?.language));
    setModalOdiiLang(nextOdii);
  }, [item?.id, odiiLangProp, i18n?.language]);

  // THEME 카드 → /api/v1/audio-guide/stories-by-theme 호출.
  // 언어 변경/다른 항목 열림 때마다 재조회. 서버는 캐시되어 있으므로 여러 번 불러도 저렴.
  // themeLangDetail 로드 후에는 해당 언어 제목으로 힌트를 바꿔 zh/ja 브리지·키워드 매칭 성공률을 높인다.
  useEffect(() => {
    if (!item || item.type !== "THEME" || !item.id) {
      setStories([]);
      return undefined;
    }
    let cancelled = false;
    setStoriesLoading(true);
    const effectiveLang = modalOdiiLang;
    const themeIdParam = (themeLangDetail?.id && String(themeLangDetail.id).trim())
      || (item.themeId && String(item.themeId).trim())
      || String(item.id).trim();
    const hintFromDetail =
      (themeLangDetail?.title && String(themeLangDetail.title).trim())
      || (themeLangDetail?.audioTitle && String(themeLangDetail.audioTitle).trim())
      || "";
    const themeTitleHint =
      hintFromDetail
      || (item.title && String(item.title).trim())
      || (item.audioTitle && String(item.audioTitle).trim())
      || "";
    const themeLatRaw = themeLangDetail?.latitude ?? item.latitude ?? anchorLat;
    const themeLngRaw = themeLangDetail?.longitude ?? item.longitude ?? anchorLng;
    const themeLat = typeof themeLatRaw === "number" ? themeLatRaw : Number(themeLatRaw);
    const themeLng = typeof themeLngRaw === "number" ? themeLngRaw : Number(themeLngRaw);
    const params = {
      themeId: themeIdParam,
      themeTitle: themeTitleHint,
      lang: effectiveLang,
      limit: 30,
    };
    if (Number.isFinite(themeLat) && Number.isFinite(themeLng)) {
      params.lat = themeLat;
      params.lon = themeLng;
    }
    axios
      .get("/api/v1/audio-guide/stories-by-theme", {
        params,
      })
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data;
        const ok = payload && typeof payload === "object" && payload.success !== false;
        const raw = ok ? payload.data : [];
        const arr = Array.isArray(raw) ? raw : [];
        setStories(arr);
      })
      .catch(() => { if (!cancelled) setStories([]); })
      .finally(() => { if (!cancelled) setStoriesLoading(false); });
    return () => { cancelled = true; };
  }, [
    item?.id,
    item?.type,
    item?.themeId,
    item?.title,
    item?.audioTitle,
    modalOdiiLang,
    themeLangDetail?.id,
    themeLangDetail?.title,
    themeLangDetail?.audioTitle,
    themeLangDetail?.latitude,
    themeLangDetail?.longitude,
    item?.latitude,
    item?.longitude,
    anchorLat,
    anchorLng,
  ]);

  // THEME: 칩 언어 ≠ 리스트 row.lang 일 때 동일 tid 의 해당 언어 레코드(오디오·대본·제목) 보강
  useEffect(() => {
    if (!item || item.type !== "THEME" || !item.id) {
      setThemeLangDetail(null);
      return undefined;
    }
    if (odiiLangFieldAlignsWithOdii(item.language, modalOdiiLang)) {
      setThemeLangDetail(null);
      return undefined;
    }
    let cancelled = false;
    axios
      .get("/api/v1/audio-guide/detail", {
        params: { type: "theme", lang: modalOdiiLang, id: item.id },
      })
      .then((res) => {
        if (cancelled) return;
        const d = res?.data?.data;
        if (d && d.id === item.id) setThemeLangDetail(d);
        else setThemeLangDetail(null);
      })
      .catch(() => { if (!cancelled) setThemeLangDetail(null); });
    return () => { cancelled = true; };
  }, [item?.id, item?.type, item?.language, modalOdiiLang]);

  // Odii 데이터 언어를 바꾸면 지연 로드한 STORY 대본이 이전 언어로 남지 않게 한다 (상세 fetch 보다 먼저 비움).
  useEffect(() => {
    if (item?.type !== "STORY") return;
    setLoadedDesc(null);
  }, [modalOdiiLang, item?.type]);

  // STORY 카드 상세 조회: 리스트는 lite 로 내려오므로 description 이 없으면 여기서 보강.
  // THEME 카드는 원본 응답에도 script 가 없어 조회해도 받을 값이 없으므로 생략.
  useEffect(() => {
    if (!item || item.type !== "STORY" || !item.id) return undefined;
    const trimmed = item.description && String(item.description).trim();
    if (trimmed && odiiLangFieldAlignsWithOdii(item.language, modalOdiiLang)) return undefined;
    let cancelled = false;
    const effectiveLang = modalOdiiLang;
    axios
      .get("/api/v1/audio-guide/detail", {
        params: { type: "story", lang: effectiveLang, id: item.id },
      })
      .then((res) => {
        if (cancelled) return;
        const d = res?.data?.data?.description;
        if (d) setLoadedDesc(String(d));
      })
      .catch(() => { /* noop */ });
    return () => { cancelled = true; };
  }, [item?.id, item?.type, item?.description, modalOdiiLang]);

  /** 길찾기 링크의 출발지(현재 위치) — 좌표형 목적지가 있을 때만 요청 */
  const [userNavPos, setUserNavPos] = useState(null);
  const [navLocState, setNavLocState] = useState("idle");

  useEffect(() => {
    if (!item || typeof item.latitude !== "number" || typeof item.longitude !== "number") {
      setUserNavPos(null);
      setNavLocState("idle");
      return undefined;
    }
    if (typeof window === "undefined" || !navigator.geolocation) {
      setUserNavPos(null);
      setNavLocState("unsupported");
      return undefined;
    }
    let cancelled = false;
    setUserNavPos(null);
    setNavLocState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserNavPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNavLocState("ready");
      },
      () => {
        if (cancelled) return;
        setUserNavPos(null);
        setNavLocState("denied");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 180_000 }
    );
    return () => { cancelled = true; };
  }, [item?.id, item?.latitude, item?.longitude]);

  const googleDirectionsUrl = useMemo(() => {
    if (!item || typeof item.latitude !== "number" || typeof item.longitude !== "number") return null;
    return buildGoogleDirectionsUrl({
      destLat: item.latitude,
      destLng: item.longitude,
      userPos: userNavPos,
    });
  }, [item?.id, item?.latitude, item?.longitude, userNavPos]);

  const kakaoDirectionsUrl = useMemo(() => {
    if (!item || typeof item.latitude !== "number" || typeof item.longitude !== "number") return null;
    const titleForNav =
      (themeLangDetail?.title && String(themeLangDetail.title).trim())
      || (item.title && String(item.title).trim());
    const audioTForNav =
      (themeLangDetail?.audioTitle && String(themeLangDetail.audioTitle).trim())
      || (item.audioTitle && String(item.audioTitle).trim());
    const destName =
      titleForNav
      || audioTForNav
      || td("audioGuide.detail.directionsDestFallback", "목적지");
    const startName = td("audioGuide.detail.directionsStartCurrent", "내 위치");
    return buildKakaoDirectionsUrl({
      destLat: item.latitude,
      destLng: item.longitude,
      destName,
      userPos: userNavPos,
      startName,
    });
  }, [item?.id, item?.latitude, item?.longitude, item?.title, item?.audioTitle, themeLangDetail?.title, themeLangDetail?.audioTitle, userNavPos, td]);

  // ESC 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [item, onClose]);

  // 모달 열린 동안 시스템 "뒤로 가기" → 페이지 이동 대신 모달 닫기.
  useBackButtonClose(!!item, onClose);

  const ttsKoSelectValue = useMemo(() => {
    if (ttsKoVoiceKey === TTS_KO_BUILTIN_KEY) return TTS_KO_BUILTIN_KEY;
    if (!koVoices.length) return "";
    if (koVoices.some((v) => ttsVoiceKey(v) === ttsKoVoiceKey)) return ttsKoVoiceKey;
    return TTS_KO_BUILTIN_KEY;
  }, [koVoices, ttsKoVoiceKey]);

  const onTtsKoVoiceChange = (e) => {
    const key = e.target.value;
    setTtsLastPickerRow("ko");
    setTtsKoVoiceKey(key);
    try {
      localStorage.setItem(TTS_KO_VOICE_STORAGE_KEY, key);
    } catch (_) {
      /* noop */
    }
  };

  if (!item) return null;

  const isThemeCard = item.type === "THEME";
  const themeOv = isThemeCard ? themeLangDetail : null;
  const viewTitle = themeOv?.title || item.title;
  const viewAudioTitle = themeOv?.audioTitle ?? item.audioTitle;
  const viewAudioUrl = (themeOv?.audioUrl && String(themeOv.audioUrl).trim())
    || (item.audioUrl && String(item.audioUrl).trim())
    || "";
  const viewImageUrl = themeOv?.imageUrl || item.imageUrl;
  const viewLangField = themeOv?.language ?? item.language;

  const hasAudio = !!viewAudioUrl;
  // THEME: 연관 STORY 가 로드 중이거나 있으면 ‘코스형’ UX — 대표 오디오는 축소 플레이어로만 두고 목록을 본론으로 둔다.
  const showThemeStoryBlock = isThemeCard && (storiesLoading || stories.length > 0);
  const showFullMainPlayer = hasAudio && (!isThemeCard || !showThemeStoryBlock);
  const showThemeIntroCompact = isThemeCard && hasAudio && showThemeStoryBlock;
  // description 은 리스트 lite 응답에서 빠져 있을 수 있으므로 loadedDesc / theme detail 로 보강.
  // 모달에서 Odii 언어만 바꾼 경우 리스트에 실린 다른 언어 대본이 남지 않게 한다.
  const effectiveDescription = (() => {
    const descPrimary = isThemeCard && themeOv != null && themeOv.description != null
      ? themeOv.description
      : item.description;
    const trimmedItem = descPrimary && String(descPrimary).trim();
    const langForAlign = isThemeCard && themeOv != null && themeOv.language != null
      ? themeOv.language
      : item.language;
    const inline =
      trimmedItem && odiiLangFieldAlignsWithOdii(langForAlign, modalOdiiLang)
        ? String(trimmedItem)
        : "";
    const lazy = (loadedDesc && String(loadedDesc).trim()) ? String(loadedDesc) : "";
    return inline || lazy || "";
  })();
  const hasScript = !!effectiveDescription;
  const subtitleVoiceActive =
    Boolean(hasAudio && (showFullMainPlayer || showThemeIntroCompact) && playing)
    || Boolean(hasScript && ttsSupported && ttsPlaying && !ttsPaused);
  const themeStoriesVoiceActive =
    Boolean(activeStoryId && !activeStoryPaused) || liveStoryNativeId != null;
  const hasCoords = typeof item.latitude === "number" && typeof item.longitude === "number";

  // TTS 에 사용할 텍스트: 스크립트 우선, 없으면 제목 + 카테고리.
  const ttsText = hasScript
    ? effectiveDescription
    : [viewTitle, viewAudioTitle, item.themeCategory].filter(Boolean).join(". ");
  const odiiLangForMainSpeech = effectiveOdiiLangForSpeech(viewLangField, modalOdiiLang);
  const ttsLang = odiiCanonicalToBcp47Lang(odiiLangForMainSpeech);
  const ttsContentIsEn = odiiLangForMainSpeech === "en";
  const ttsContentIsZh = odiiLangForMainSpeech === "zh";
  const ttsContentIsJa = odiiLangForMainSpeech === "ja";
  const koVoiceRowApply =
    ttsLastPickerRow === "ko"
    || (ttsLastPickerRow === null && !ttsContentIsEn && !ttsContentIsZh && !ttsContentIsJa);

  const startTts = async () => {
    if (!ttsSupported || !ttsText) return;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      if (odiiLangForMainSpeech === "ja" || odiiLangForMainSpeech === "en" || odiiLangForMainSpeech === "zh") {
        await waitForSpeechVoicesLoaded(synth);
      }
      const utter = new SpeechSynthesisUtterance(ttsText);
      applyTtsVoiceToUtter(utter, odiiLangForMainSpeech, ttsKoSelectValue);
      utter.onend = () => { setTtsPlaying(false); setTtsPaused(false); };
      utter.onerror = () => { setTtsPlaying(false); setTtsPaused(false); };
      synth.speak(utter);
      setTtsPlaying(true);
      setTtsPaused(false);
    } catch (_) { /* noop */ }
  };
  const pauseTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.pause(); setTtsPaused(true); } catch (_) { /* noop */ }
  };
  const resumeTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.resume(); setTtsPaused(false); } catch (_) { /* noop */ }
  };
  const stopTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    setTtsPlaying(false);
    setTtsPaused(false);
  };

  // --- 스토리 행별 TTS 핸들러 ---
  const pauseAllStoryNativeAudios = (except) => {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".agm-story-native").forEach((el) => {
      if (except && el === except) return;
      try { el.pause(); } catch (_) { /* noop */ }
    });
  };

  const playStoryTts = async (story) => {
    if (!ttsSupported) return;
    const text = (story?.description && String(story.description).trim())
      ? String(story.description)
      : [story?.audioTitle, story?.title, story?.themeCategory].filter(Boolean).join(". ");
    if (!text) return;
    try {
      setLiveStoryNativeId(null);
      pauseAllStoryNativeAudios();
      if (audioRef.current) {
        setPlaying(false);
        try { audioRef.current.pause(); } catch (_) { /* noop */ }
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const odiiForStorySpeech = effectiveOdiiLangForSpeech(story?.language, modalOdiiLang);
      if (odiiForStorySpeech === "ja" || odiiForStorySpeech === "en" || odiiForStorySpeech === "zh") {
        await waitForSpeechVoicesLoaded(synth);
      }
      const utter = new SpeechSynthesisUtterance(text);
      applyTtsVoiceToUtter(utter, odiiForStorySpeech, ttsKoSelectValue);
      utter.onend = () => { setActiveStoryId(null); setActiveStoryPaused(false); };
      utter.onerror = () => { setActiveStoryId(null); setActiveStoryPaused(false); };
      synth.speak(utter);
      setActiveStoryId(story.id);
      setActiveStoryPaused(false);
    } catch (_) { /* noop */ }
  };
  const pauseStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.pause(); setActiveStoryPaused(true); } catch (_) { /* noop */ }
  };
  const resumeStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.resume(); setActiveStoryPaused(false); } catch (_) { /* noop */ }
  };
  const stopStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    setActiveStoryId(null);
    setActiveStoryPaused(false);
  };

  const togglePlay = () => {
    if (!hasAudio) return;
    stopStoryTts();
    setLiveStoryNativeId(null);
    pauseAllStoryNativeAudios();
    if (!audioRef.current) {
      if (mediaSessionDetachRef.current) {
        try {
          mediaSessionDetachRef.current();
        } catch (_) {
          /* noop */
        }
        mediaSessionDetachRef.current = null;
      }
      const audio = new Audio(viewAudioUrl);
      audio.preload = "auto";
      audio.muted = muted;
      audio.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(audio.duration || 0);
      });
      audio.addEventListener("error", () => {
        setAudioError(true);
        setPlaying(false);
      });
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration || 0);
      });
      audio.addEventListener("timeupdate", () => {
        setProgress(audio.currentTime || 0);
      });
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audioRef.current = audio;
      mediaSessionDetachRef.current = attachAudioMediaSession(audio, {
        title: viewAudioTitle || viewTitle,
        artworkUrl: viewImageUrl,
      });
    }
    const a = audioRef.current;
    if (!a) return;
    // React playing 과 실제 엘리먼트가 어긋나면 재클릭 시 pause 대신 play()만 다시 호출되어
    // 로드가 다시 일어나 처음부터 재생되는 것처럼 느껴질 수 있다.
    if (!a.paused) {
      setPlaying(false);
      try { a.pause(); } catch (_) { /* noop */ }
    } else {
      setPlaying(true);
      a.play().catch(() => {
        setPlaying(false);
        setAudioError(true);
      });
    }
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setProgress(0);
    setPlaying(true);
    audioRef.current.play().catch(() => {
      setPlaying(false);
    });
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.max(0, Math.min(duration, duration * ratio));
    audioRef.current.currentTime = next;
    setProgress(next);
  };

  const googleMapUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
    : null;
  const kakaoMapUrl = hasCoords
    ? `https://map.kakao.com/link/map/${encodeURIComponent(viewTitle || "")},${item.latitude},${item.longitude}`
    : null;

  const typeLabel = item.type === "STORY"
    ? t("audioGuide.tab.story", "이야기 조각")
    : t("audioGuide.tab.theme", "관광지 해설");

  return (
    <div
      className="agm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={viewTitle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <style>{modalCss}</style>
      <div className="agm-modal">
        <button className="agm-close" onClick={onClose} aria-label="close">
          <X size={18} />
        </button>

        <div className="agm-hero">
          {viewImageUrl ? (
            <img
              src={viewImageUrl}
              alt={viewTitle || ""}
              className="agm-hero-img"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="agm-hero-fb">
              {item.type === "STORY" ? <BookOpen size={64} /> : <Radio size={64} />}
            </div>
          )}
          <div className="agm-hero-overlay" />
          <div className="agm-hero-meta">
            <span className="agm-type-badge">
              {item.type === "STORY" ? <BookOpen size={12} /> : <Radio size={12} />}
              {typeLabel}
            </span>
            {(viewLangField || modalOdiiLang) && (
              <span className="agm-lang-badge">
                <Globe2 size={10} />{" "}
                {odiiLangChipLabel(isValidOdiiLang(modalOdiiLang) ? modalOdiiLang : "ko")}
              </span>
            )}
            {item.distanceKm != null && (
              <span className="agm-dist-badge">
                <MapPin size={10} />
                {item.distanceKm < 1
                  ? `${Math.round(item.distanceKm * 1000)}m`
                  : `${item.distanceKm.toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>

        <div className="agm-body">
          <h2 className="agm-title">{viewTitle}</h2>
          {viewAudioTitle && String(viewAudioTitle).trim() && viewAudioTitle !== viewTitle && (
            <p className="agm-subtitle">
              <VoiceMicIcon active={subtitleVoiceActive} size={14} /> {viewAudioTitle}
            </p>
          )}

          <div className="agm-meta-row">
            {item.themeCategory && (
              <span className="agm-meta-chip">
                <Tag size={12} /> {item.themeCategory}
              </span>
            )}
            {item.playTimeText && (
              <span className="agm-meta-chip">
                <Clock size={12} /> {formatPlayTime(item.playTimeText)}
              </span>
            )}
            {item.address && (
              <span className="agm-meta-chip agm-meta-addr">
                <MapPin size={12} /> {item.address}
              </span>
            )}
          </div>

          <div
            className="agm-odii-lang"
            role="group"
            aria-label={t("audioGuide.hero.odiiDataAria", "관광공사 오디오 가이드 데이터 언어")}
          >
            <span className="agm-odii-lang-label">{t("audioGuide.hero.odiiData", "해설·검색 데이터")}</span>
            <span className="agm-odii-sg-row">
              {ODII_LANG_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={`agm-odii-sg ${modalOdiiLang === code ? "agm-odii-sg-on" : ""}`}
                  onClick={() => {
                    setModalOdiiLang(code);
                    setAudioGuideOdiiLang(code);
                  }}
                >
                  {odiiLangChipLabel(code)}
                </button>
              ))}
            </span>
          </div>

          {ttsSupported && (hasScript || isThemeCard) && (koVoices.length > 0 || ttsContentIsEn || ttsContentIsZh || ttsContentIsJa) ? (
            <div className="agm-tts-voice-stack">
              {koVoices.length > 0 ? (
                <AgmLocaleVoicePicker
                  fieldId={ttsVoiceSelectId}
                  voices={koVoices}
                  value={ttsKoSelectValue}
                  onChange={onTtsKoVoiceChange}
                  label={td("audioGuide.detail.tts.voiceLabelKo", "한국어 대본용")}
                  ariaLabel={td("audioGuide.detail.tts.voiceAriaKo", "한국어 해설 대본에 쓸 브라우저 음성")}
                  isApplyRow={koVoiceRowApply}
                  firstOption={{
                    value: TTS_KO_BUILTIN_KEY,
                    label: td("audioGuide.detail.tts.voiceBrowserDefaultKo", "브라우저 기본 (이전과 동일)"),
                  }}
                />
              ) : null}
              {(ttsContentIsEn || ttsContentIsZh || ttsContentIsJa) ? (
                <p className="agm-tts-voice-hint">
                  {td(
                    "audioGuide.detail.tts.odiiTtsFallbackHint",
                    "Odii가 mp3(audioUrl)를 주면 그 녹음을 그대로 재생합니다. 영·일 등 일부 언어 행에는 파일이 없어 대본만 브라우저 음성으로 읽을 때가 있어요 — 서버가 URL 필드를 넓게 인식하고, 영·일은 브라우저에서 해당 언어 음성을 골라 씁니다.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {showFullMainPlayer ? (
            <div className="agm-player">
              <div className="agm-player-top">
                <button
                  type="button"
                  className="agm-player-main"
                  onClick={togglePlay}
                  aria-label={playing ? "pause" : "play"}
                >
                  {playing ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <div className="agm-player-progress" onClick={seek}>
                  <div
                    className="agm-player-fill"
                    style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}
                  />
                </div>
                <span className="agm-player-time">
                  {formatSeconds(progress)} / {formatSeconds(duration)}
                </span>
                <button type="button" className="agm-player-aux" onClick={restart} aria-label="restart">
                  <SkipBack size={14} />
                </button>
                <button type="button" className="agm-player-aux" onClick={toggleMute}
                  aria-label={muted ? "unmute" : "mute"}>
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
              {audioError && (
                <p className="agm-player-err">
                  {td("audioGuide.detail.audioErr", "오디오를 재생할 수 없어요. 원본 링크에서 열어보세요.")}
                  {" · "}
                  <a href={viewAudioUrl} target="_blank" rel="noreferrer">
                    {td("audioGuide.detail.openAudio", "오디오 파일 열기")}
                  </a>
                </p>
              )}
            </div>
          ) : isThemeCard ? (
            <>
              {showThemeIntroCompact ? (
                <div className="agm-theme-intro">
                  <div className="agm-theme-intro-head">
                    <div className="agm-theme-intro-title">
                      {td("audioGuide.detail.themeIntro.title", "테마 소개 오디오")}
                    </div>
                    <div className="agm-theme-intro-sub">
                      {td("audioGuide.detail.themeIntro.sub", "아래 목록은 같은 관광지의 세부 해설 이야기예요.")}
                    </div>
                  </div>
                  <div className="agm-player agm-player-theme-compact">
                    <div className="agm-player-top">
                      <button
                        type="button"
                        className="agm-player-main agm-player-main-sm"
                        onClick={togglePlay}
                        aria-label={
                          playing
                            ? td("audioGuide.detail.themeIntro.pauseAria", "테마 소개 오디오 일시정지")
                            : td("audioGuide.detail.themeIntro.playAria", "테마 소개 오디오 재생")
                        }
                      >
                        {playing ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <div className="agm-player-progress" onClick={seek}>
                        <div
                          className="agm-player-fill"
                          style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="agm-player-time agm-player-time-sm">
                        {formatSeconds(progress)} / {formatSeconds(duration)}
                      </span>
                      <button type="button" className="agm-player-aux" onClick={restart} aria-label="restart">
                        <SkipBack size={12} />
                      </button>
                      <button type="button" className="agm-player-aux" onClick={toggleMute}
                        aria-label={muted ? "unmute" : "mute"}>
                        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                    </div>
                    {audioError && (
                      <p className="agm-player-err">
                        {td("audioGuide.detail.audioErr", "오디오를 재생할 수 없어요. 원본 링크에서 열어보세요.")}
                        {" · "}
                        <a href={viewAudioUrl} target="_blank" rel="noreferrer">
                          {td("audioGuide.detail.openAudio", "오디오 파일 열기")}
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="agm-theme-stories">
              <div className="agm-theme-stories-head">
                <div className="agm-theme-stories-title">
                  <VoiceMicIcon active={themeStoriesVoiceActive} size={16} /> {td("audioGuide.detail.stories.title", "이 관광지의 해설 이야기")}
                </div>
                <div className="agm-theme-stories-sub">
                  {td("audioGuide.detail.stories.sub", "항목마다 제공 형태가 달라요. 오디오가 있으면 바로 재생하고, 없으면 브라우저 음성으로 대본을 들을 수 있어요.")}
                </div>
              </div>
              {storiesLoading ? (
                <div className="agm-stories-loading">
                  <Loader2 size={16} className="agm-spin" />
                  {td("audioGuide.detail.stories.loading", "연관 해설 이야기를 불러오는 중...")}
                </div>
              ) : stories.length === 0 ? (
                <div className="agm-stories-empty">
                  <Info size={14} />
                  {td("audioGuide.detail.stories.empty", "이 관광지에 연결된 해설 이야기를 찾지 못했어요. 서버 캐시가 준비되는 동안 잠시 후 다시 열어 주세요.")}
                </div>
              ) : (
                <ul className="agm-stories-list">
                  {stories.map((s) => {
                    const isActive = activeStoryId === s.id;
                    const isPlaying = isActive && !activeStoryPaused;
                    const label = s.audioTitle || s.title || "";
                    const storyAudio = s.audioUrl && String(s.audioUrl).trim() ? String(s.audioUrl).trim() : "";
                    const showTtsBtn = !storyAudio && ttsSupported;
                    return (
                      <li key={s.id} className={`agm-story-row${isActive && showTtsBtn ? " active" : ""}`}>
                        <div className="agm-story-row-main">
                          {showTtsBtn ? (
                            <button
                              type="button"
                              className="agm-story-play"
                              onClick={() => {
                                if (!isActive) return playStoryTts(s);
                                if (activeStoryPaused) return resumeStoryTts();
                                return pauseStoryTts();
                              }}
                              aria-label={isPlaying ? "pause" : "play"}
                            >
                              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                          ) : null}
                          <div className="agm-story-meta">
                            <div className="agm-story-title">{label}</div>
                            <div className="agm-story-sub">
                              {s.playTimeText && (
                                <span><Clock size={10} /> {formatPlayTime(s.playTimeText)}</span>
                              )}
                              {s.themeCategory && (
                                <span><Tag size={10} /> {s.themeCategory}</span>
                              )}
                              {!storyAudio && !ttsSupported && (
                                <span><Info size={10} /> {td("audioGuide.detail.stories.noPlay", "이 항목은 이 브라우저에서 바로 재생할 수 없어요.")}</span>
                              )}
                            </div>
                          </div>
                          {isActive && showTtsBtn ? (
                            <button
                              type="button"
                              className="agm-story-stop"
                              onClick={stopStoryTts}
                              aria-label={td("audioGuide.detail.tts.stop", "정지")}
                            >
                              <Square size={12} />
                            </button>
                          ) : null}
                        </div>
                        {storyAudio ? (
                          <div className="agm-story-audio-wrap">
                            <audio
                              className="agm-story-native"
                              controls
                              preload="metadata"
                              src={storyAudio}
                              onPlay={(e) => {
                                stopStoryTts();
                                if (audioRef.current) {
                                  setPlaying(false);
                                  try { audioRef.current.pause(); } catch (_) { /* noop */ }
                                }
                                pauseAllStoryNativeAudios(e.currentTarget);
                                setLiveStoryNativeId(s.id);
                              }}
                              onPause={() => {
                                setLiveStoryNativeId((id) => (id === s.id ? null : id));
                              }}
                              onEnded={() => {
                                setLiveStoryNativeId((id) => (id === s.id ? null : id));
                              }}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {ttsSupported ? (
                <div className="agm-tts-meta">
                  <Info size={11} />
                  {td("audioGuide.detail.tts.note", "음성 품질은 사용 중인 브라우저/OS 에 따라 달라져요.")}
                </div>
              ) : null}
            </div>
            </>
          ) : hasScript && ttsSupported ? (
            // audioUrl 이 없을 때만 Web Speech API 로 대본 재생.
            <div className="agm-tts">
              <div className="agm-tts-top">
                {!ttsPlaying ? (
                  <button type="button" className="agm-tts-main" onClick={startTts}
                    aria-label={td("audioGuide.detail.tts.start", "AI 음성으로 듣기")}>
                    <Play size={22} />
                  </button>
                ) : ttsPaused ? (
                  <button type="button" className="agm-tts-main" onClick={resumeTts}
                    aria-label={td("audioGuide.detail.tts.resume", "이어 듣기")}>
                    <Play size={22} />
                  </button>
                ) : (
                  <button type="button" className="agm-tts-main" onClick={pauseTts}
                    aria-label={td("audioGuide.detail.tts.pause", "일시정지")}>
                    <Pause size={22} />
                  </button>
                )}
                <div className="agm-tts-texts">
                  <div className="agm-tts-title">
                    <VoiceMicIcon active={ttsPlaying && !ttsPaused} size={14} /> {td("audioGuide.detail.tts.title", "AI 음성으로 해설 듣기")}
                  </div>
                  <div className="agm-tts-sub">
                    {td("audioGuide.detail.tts.sub", "Odii 는 오디오 파일을 외부에 공개하지 않아요. 브라우저 음성 합성으로 대본을 읽어 드려요.")}
                  </div>
                </div>
                {ttsPlaying && (
                  <button type="button" className="agm-tts-stop" onClick={stopTts}
                    aria-label={td("audioGuide.detail.tts.stop", "정지")}>
                    <Square size={14} />
                  </button>
                )}
              </div>
              <div className="agm-tts-meta">
                <Info size={11} />
                {td("audioGuide.detail.tts.note", "음성 품질은 사용 중인 브라우저/OS 에 따라 달라져요.")}
                {" · "}
                <span>{ttsLang}</span>
              </div>
            </div>
          ) : (
            <div className="agm-noaudio">
              <VoiceMicIcon active={false} size={14} />
              {td("audioGuide.detail.noAudio", "이 항목에는 오디오 파일이 제공되지 않아요.")}
            </div>
          )}

          {effectiveDescription && (
            <section className="agm-script">
              <h3>{td("audioGuide.detail.script", "해설 스크립트")}</h3>
              <p>{effectiveDescription}</p>
            </section>
          )}

          {hasCoords && (
            <div className="agm-map-block">
              <div className="agm-map-heading">
                {td("audioGuide.detail.directionsSection", "길찾기 (대중교통)")}
              </div>
              <div className="agm-map-actions">
                {googleDirectionsUrl && (
                  <a
                    href={googleDirectionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="agm-map-btn agm-map-dir agm-map-google"
                  >
                    <Navigation size={13} /> {td("audioGuide.detail.directionsGoogle", "Google 지도 길찾기")}
                  </a>
                )}
                {kakaoDirectionsUrl && (
                  <a
                    href={kakaoDirectionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="agm-map-btn agm-map-dir agm-map-kakao"
                  >
                    <Navigation size={13} /> {td("audioGuide.detail.directionsKakao", "카카오맵 길찾기")}
                  </a>
                )}
              </div>
              {navLocState === "loading" && (
                <p className="agm-map-hint">
                  {td("audioGuide.detail.directionsLocating", "내 위치를 불러오면 출발지가 채워져요…")}
                </p>
              )}
              {navLocState === "denied" && (
                <p className="agm-map-hint agm-map-hint-warn">
                  {td("audioGuide.detail.directionsDeniedHint", "위치 권한이 없으면 앱에서 출발지를 직접 지정해 주세요.")}
                </p>
              )}

              <div className="agm-map-heading">
                {td("audioGuide.detail.mapViewSection", "지도에서 보기")}
              </div>
              <div className="agm-map-actions">
                <a href={googleMapUrl} target="_blank" rel="noreferrer" className="agm-map-btn agm-map-google">
                  <ExternalLink size={13} /> {td("audioGuide.detail.openGoogleMap", "구글 지도에서 보기")}
                </a>
                <a href={kakaoMapUrl} target="_blank" rel="noreferrer" className="agm-map-btn agm-map-kakao">
                  <ExternalLink size={13} /> {td("audioGuide.detail.openKakaoMap", "카카오맵에서 보기")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgmLocaleVoicePicker({ fieldId, voices, value, onChange, label, ariaLabel, firstOption, isApplyRow }) {
  if (!voices?.length && !firstOption) return null;
  return (
    <div className={`agm-tts-voice-row${isApplyRow ? " agm-tts-voice-row--apply" : ""}`}>
      <label htmlFor={fieldId} className="agm-tts-voice-label">
        <Mic size={13} className="agm-tts-voice-icon" aria-hidden />
        {label}
      </label>
      <select
        id={fieldId}
        className={`agm-tts-voice-select${isApplyRow ? " agm-tts-voice-select--apply" : ""}`}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
      >
        {firstOption ? (
          <option value={firstOption.value}>{firstOption.label}</option>
        ) : null}
        {(voices || []).map((v) => {
          const key = ttsVoiceKey(v);
          return (
            <option key={key} value={key}>
              {ttsVoiceOptionCaption(v)}
            </option>
          );
        })}
      </select>
    </div>
  );
}

/** Odii GW langCode(chs/jpn/eng 등)와 UI canonical ko|en|zh|ja 정합 */
function odiiLangFieldAlignsWithOdii(langField, odii) {
  const raw = (langField || "").toLowerCase().trim();
  const o = (odii || "ko").toLowerCase();
  if (!raw) return o === "ko";
  if (o === "en") return raw.startsWith("en") || raw === "eng";
  if (o === "zh") {
    return raw.startsWith("zh") || raw === "chs" || raw === "cht" || raw === "cn" || raw === "cn1";
  }
  if (o === "ja") return raw.startsWith("ja") || raw === "jpn" || raw === "jp";
  return raw.startsWith("ko") || raw === "kor";
}

function formatPlayTime(raw) {
  if (!raw) return "";
  // "122" 같은 순수 초 값이면 mm:ss 로 변환, "mm:ss" 면 그대로
  if (/^\d+$/.test(String(raw))) {
    const sec = parseInt(raw, 10);
    if (Number.isFinite(sec) && sec > 0) return formatSeconds(sec);
  }
  return String(raw);
}

function formatSeconds(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const modalCss = `
.agm-backdrop {
  position: fixed; inset: 0; z-index: 110;
  background: rgba(8, 4, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  overflow-y: auto;
}
.agm-modal {
  position: relative;
  width: min(780px, 100%);
  max-height: calc(100vh - 40px);
  background: linear-gradient(180deg, #14102a 0%, #0c0820 100%);
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 16px;
  overflow: hidden;
  color: #f4f1ff;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
}
.agm-close {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(10, 5, 26, 0.75);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
.agm-close:hover { background: rgba(239,68,68,0.8); border-color: transparent; }

.agm-hero {
  position: relative; width: 100%; padding-top: 42%;
  background: #0d0820; overflow: hidden; flex-shrink: 0;
}
.agm-hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.agm-hero-fb {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.38);
  background: linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(251,191,36,0.12) 100%);
}
.agm-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(12,8,32,0.95) 100%);
}
.agm-hero-meta {
  position: absolute; left: 16px; bottom: 12px; right: 56px;
  display: flex; gap: 6px; flex-wrap: wrap;
}
.agm-type-badge, .agm-lang-badge, .agm-dist-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.72rem; font-weight: 800;
  padding: 4px 9px; border-radius: 999px;
  backdrop-filter: blur(6px);
}
.agm-type-badge { background: rgba(167,139,250,0.92); color: #1b0a38; }
.agm-lang-badge { background: rgba(10,5,26,0.6); color: #ddd6fe; border: 1px solid rgba(167,139,250,0.5); }
.agm-dist-badge { background: rgba(251,191,36,0.92); color: #2b1c00; }

.agm-body {
  padding: 18px 22px 22px;
  overflow-y: auto;
  min-height: 0;
}
.agm-title { margin: 0; font-size: 1.4rem; font-weight: 900; color: #fff; line-height: 1.25; }
.agm-subtitle {
  margin: 6px 0 0; color: #d4c7f5;
  font-size: 0.92rem; display: inline-flex; align-items: center; gap: 6px;
}

.agm-meta-row {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin: 12px 0 16px;
}
.agm-meta-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(167,139,250,0.14);
  border: 1px solid rgba(167,139,250,0.3);
  color: #e9d5ff;
  font-size: 0.78rem; font-weight: 600;
}
.agm-meta-addr { color: #fde68a; border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.1); }

.agm-odii-lang {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0 0 14px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(8,4,22,0.55);
  border: 1px solid rgba(196,181,253,0.38);
}
.agm-odii-lang-label {
  font-size: 0.72rem;
  font-weight: 750;
  color: rgba(233,213,255,0.9);
  letter-spacing: -0.02em;
}
.agm-odii-sg-row {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.agm-odii-sg {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid rgba(167,139,250,0.4);
  background: rgba(20,12,40,0.65);
  color: #e9d5ff;
  cursor: pointer;
  letter-spacing: 0.06em;
}
.agm-odii-sg-on {
  background: linear-gradient(135deg, rgba(139,92,246,0.95), rgba(167,139,250,0.75));
  border-color: rgba(253,230,138,0.5);
  color: #fff;
  box-shadow: 0 0 0 1px rgba(253,230,138,0.25);
}

.agm-tts-voice-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 0 14px;
}
.agm-tts-voice-hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.45;
  color: rgba(244,241,255,0.72);
}
.agm-tts-voice-row--apply {
  background: rgba(139, 92, 246, 0.22);
  border-color: rgba(196, 181, 253, 0.55);
  box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.35);
}
.agm-tts-voice-select--apply {
  border-color: rgba(196, 181, 253, 0.85);
  background: rgba(24, 16, 48, 0.95);
  color: #faf5ff;
}
.agm-tts-voice-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(167,139,250,0.08);
  border: 1px solid rgba(167,139,250,0.28);
}
.agm-tts-voice-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.78rem; font-weight: 800; color: #e9d5ff;
  flex-shrink: 0;
}
.agm-tts-voice-icon { opacity: 0.9; }
.agm-tts-voice-select {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(167,139,250,0.45);
  background: rgba(10,6,22,0.9);
  color: #f4f1ff;
  font-size: 0.82rem;
  cursor: pointer;
}
.agm-tts-voice-select:focus {
  outline: none;
  border-color: rgba(251,191,36,0.65);
  box-shadow: 0 0 0 2px rgba(251,191,36,0.2);
}

.agm-player {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(167,139,250,0.3);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.agm-player-top { display: flex; align-items: center; gap: 10px; }
.agm-player-main {
  width: 46px; height: 46px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-player-main:hover { filter: brightness(1.08); }
.agm-player-progress {
  flex: 1; height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.12);
  cursor: pointer; overflow: hidden;
  position: relative;
}
.agm-player-fill {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa 0%, #f59e0b 100%);
  transition: width 0.2s linear;
}
.agm-player-time {
  font-size: 0.74rem; color: #cdc0ee; min-width: 82px; text-align: right;
  font-variant-numeric: tabular-nums;
}
.agm-player-aux {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-player-aux:hover { background: rgba(167,139,250,0.3); }
.agm-player-err { margin: 8px 0 0; color: #fca5a5; font-size: 0.82rem; }
.agm-player-err a { color: #fde68a; text-decoration: underline; }

.agm-theme-intro {
  margin-bottom: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(34,211,238,0.11) 0%, rgba(167,139,250,0.1) 100%);
  border: 1px solid rgba(34,211,238,0.32);
}
.agm-theme-intro-head { margin-bottom: 8px; }
.agm-theme-intro-title {
  font-size: 0.88rem;
  font-weight: 800;
  color: #cffafe;
  letter-spacing: 0.02em;
}
.agm-theme-intro-sub {
  margin-top: 3px;
  font-size: 0.74rem;
  line-height: 1.45;
  color: rgba(244,241,255,0.72);
}
.agm-player-theme-compact {
  margin-bottom: 0;
  padding: 8px 10px;
  background: rgba(5, 10, 28, 0.35);
  border: 1px dashed rgba(167,139,250,0.38);
}
.agm-player-main-sm {
  width: 38px;
  height: 38px;
}
.agm-player-time-sm {
  font-size: 0.68rem;
  min-width: 72px;
}

.agm-noaudio {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(255,255,255,0.15);
  color: #bda6ff; font-size: 0.85rem;
  margin-bottom: 16px;
}

.agm-tts {
  background: linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(251,191,36,0.1) 100%);
  border: 1px solid rgba(167,139,250,0.35);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.agm-tts-top { display: flex; align-items: center; gap: 12px; }
.agm-tts-main {
  width: 50px; height: 50px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(167,139,250,0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.agm-tts-main:hover { transform: scale(1.06); box-shadow: 0 10px 24px rgba(167,139,250,0.55); }
.agm-tts-texts { flex: 1; min-width: 0; }
.agm-tts-title {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.95rem; font-weight: 800; color: #fff;
}
.agm-tts-sub {
  margin-top: 3px; font-size: 0.78rem; line-height: 1.45;
  color: #d8c7fd;
}
.agm-tts-stop {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.35); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.agm-tts-stop:hover { background: rgba(239,68,68,0.85); border-color: transparent; }
.agm-tts-meta {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px dashed rgba(167,139,250,0.25);
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.72rem; color: #c4b5fd;
}
.agm-tts-meta span { color: #fde68a; font-weight: 700; }

.agm-theme-stories {
  background: linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(251,191,36,0.08) 100%);
  border: 1px solid rgba(167,139,250,0.35);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.agm-theme-stories-head { margin-bottom: 10px; }
.agm-theme-stories-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.95rem; font-weight: 800; color: #fff;
}
.agm-theme-stories-sub {
  margin-top: 3px; font-size: 0.78rem; line-height: 1.45;
  color: #d8c7fd;
}
.agm-stories-loading, .agm-stories-empty {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  color: #cbb7f7; font-size: 0.85rem;
  border: 1px dashed rgba(167,139,250,0.22);
  width: 100%;
  box-sizing: border-box;
}
.agm-stories-empty { color: #fde68a; border-color: rgba(251,191,36,0.3); }
.agm-spin { animation: agm-spin 1s linear infinite; }
@keyframes agm-spin { to { transform: rotate(360deg); } }

.agm-stories-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto;
}
.agm-story-row {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.agm-story-row-main {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  min-width: 0;
}
.agm-story-audio-wrap {
  width: 100%;
  min-width: 0;
}
.agm-story-native {
  width: 100%;
  height: 36px;
  vertical-align: middle;
}
.agm-story-row:hover { background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.35); }
.agm-story-row.active {
  background: rgba(167,139,250,0.18);
  border-color: rgba(167,139,250,0.6);
  box-shadow: 0 0 0 2px rgba(167,139,250,0.15);
}
.agm-story-play {
  width: 34px; height: 34px; border-radius: 50%;
  flex-shrink: 0;
  border: none; cursor: pointer;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-story-play:hover { filter: brightness(1.1); }
.agm-story-meta { flex: 1; min-width: 0; }
.agm-story-title {
  font-size: 0.88rem; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.agm-story-sub {
  margin-top: 2px; font-size: 0.72rem; color: #c4b5fd;
  display: inline-flex; gap: 10px; flex-wrap: wrap;
}
.agm-story-sub span { display: inline-flex; align-items: center; gap: 3px; }
.agm-story-stop {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.35); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.agm-story-stop:hover { background: rgba(239,68,68,0.85); border-color: transparent; }

.agm-script {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px 16px 16px;
  margin-bottom: 16px;
}
.agm-script h3 {
  margin: 0 0 8px; font-size: 0.95rem; font-weight: 800;
  color: #c4b5fd;
}
.agm-script p {
  margin: 0; white-space: pre-wrap;
  line-height: 1.65; color: #e8e3f8; font-size: 0.92rem;
}

.agm-map-block { margin-top: 4px; }
.agm-map-heading {
  font-size: 0.72rem;
  font-weight: 800;
  color: #c4b5fd;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 16px 0 8px;
}
.agm-map-block > .agm-map-heading:first-child { margin-top: 0; }
.agm-map-hint {
  font-size: 0.78rem;
  color: #a8a0c8;
  margin: 8px 0 0;
  line-height: 1.35;
}
.agm-map-hint-warn { color: #fde68a; }
.agm-map-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.agm-map-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 8px 14px; border-radius: 999px;
  font-size: 0.82rem; font-weight: 700;
  text-decoration: none;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.agm-map-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
.agm-map-dir { border-style: dashed; opacity: 0.98; }
.agm-map-google {
  background: linear-gradient(135deg, #34a853 0%, #1a73e8 100%);
  color: #fff;
}
.agm-map-kakao {
  background: linear-gradient(135deg, #fee500 0%, #f6c700 100%);
  color: #191919;
}

@media (max-width: 640px) {
  .agm-backdrop { padding: 0; }
  .agm-modal { max-height: 100vh; border-radius: 0; border: none; }
  .agm-hero { padding-top: 50%; }
  .agm-title { font-size: 1.15rem; }
  .agm-player-time { min-width: 70px; font-size: 0.7rem; }
}
`;
