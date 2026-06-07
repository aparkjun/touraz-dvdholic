/**
 * 오디오 가이드(Odii) 항목의 주소(address) 문자열에서 KTO 광역 areaCode 를 판별하는 유틸.
 *
 * <p>배경: /audio-guide 의 "지역" 칩은 기존에 한글 지명("강원")으로 키워드 검색(/search)을 했다.
 * 그러나 Odii 데이터는 언어별로 현지화되어 내려온다.
 *  - ko : "강원특별자치도 원주시"
 *  - en : "Gangwon-do Wonju-si"
 *  - zh : "江原道 原州市"
 *  - ja : "江原道 原州市"
 * 따라서 한글 키워드로는 en/zh/ja 데이터에서 거의 0건이 되고(영어 "강원" 검색 = 빈 배열),
 * ko 에서도 키워드 검색은 제목/주소 부분일치라 누락이 많았다.
 *
 * <p>대신 이미 받아온 "전체 목록(현재 언어로 정상화된)"을 주소의 광역 시·도 접두로 필터링한다.
 * 주소는 항상 광역 시·도명으로 시작하므로 startsWith 매칭이 신뢰성 있게 동작한다.
 *
 * <p>areaCode 는 /audio-guide 페이지의 REGION_SHORTCUTS / regionAreaCode.js 와 동일한 KTO 체계를 따른다
 * (전북=35, 전남=36, 경북=37, 경남=38).
 */

/**
 * areaCode → 언어별 광역 시·도 접두 후보.
 * en 후보는 모두 소문자로 저장하고 매칭 시 주소를 소문자화한다.
 * 각 후보는 "주소가 그 문자열로 시작하는가" 로 검사한다.
 */
const PROVINCE_VARIANTS = {
  "1": { ko: ["서울"], en: ["seoul"], zh: ["首尔"], ja: ["ソウル"] },
  "2": { ko: ["인천"], en: ["incheon"], zh: ["仁川"], ja: ["仁川"] },
  "3": { ko: ["대전"], en: ["daejeon"], zh: ["大田"], ja: ["大田"] },
  "4": { ko: ["대구"], en: ["daegu"], zh: ["大邱"], ja: ["大邱"] },
  "5": { ko: ["광주"], en: ["gwangju"], zh: ["光州"], ja: ["光州"] },
  "6": { ko: ["부산"], en: ["busan"], zh: ["釜山"], ja: ["釜山"] },
  "7": { ko: ["울산"], en: ["ulsan"], zh: ["蔚山"], ja: ["蔚山"] },
  "8": { ko: ["세종"], en: ["sejong"], zh: ["世宗"], ja: ["世宗"] },
  "31": { ko: ["경기"], en: ["gyeonggi"], zh: ["京畿"], ja: ["京畿"] },
  "32": { ko: ["강원"], en: ["gangwon"], zh: ["江原"], ja: ["江原"] },
  "33": { ko: ["충청북도", "충북"], en: ["chungcheongbuk", "chungbuk"], zh: ["忠清北道", "忠北"], ja: ["忠清北道"] },
  "34": { ko: ["충청남도", "충남"], en: ["chungcheongnam", "chungnam"], zh: ["忠清南道", "忠南"], ja: ["忠清南道"] },
  "35": { ko: ["전라북도", "전북특별자치도", "전북"], en: ["jeollabuk", "jeonbuk"], zh: ["全罗北道", "全北"], ja: ["全羅北道", "全北"] },
  "36": { ko: ["전라남도", "전남"], en: ["jeollanam", "jeonnam"], zh: ["全罗南道", "全南"], ja: ["全羅南道"] },
  "37": { ko: ["경상북도", "경북"], en: ["gyeongsangbuk", "gyeongbuk"], zh: ["庆尚北道", "庆北"], ja: ["慶尚北道"] },
  "38": { ko: ["경상남도", "경남"], en: ["gyeongsangnam", "gyeongnam"], zh: ["庆尚南道", "庆南"], ja: ["慶尚南道"] },
  "39": { ko: ["제주"], en: ["jeju"], zh: ["济州"], ja: ["済州"] },
};

const ALL_CODES = Object.keys(PROVINCE_VARIANTS);

function normalizeLang(lang) {
  const n = (lang || "").toLowerCase();
  if (n.startsWith("en")) return "en";
  if (n.startsWith("zh") || n.startsWith("cn")) return "zh";
  if (n.startsWith("ja") || n.startsWith("jp")) return "ja";
  if (n.startsWith("ko") || n.startsWith("kr")) return "ko";
  return null;
}

function matchesAnyVariant(rawAddr, lowerAddr, variants, isLatin) {
  if (!variants) return false;
  for (const v of variants) {
    if (isLatin) {
      if (lowerAddr.startsWith(v)) return true;
    } else if (rawAddr.startsWith(v)) {
      return true;
    }
  }
  return false;
}

/**
 * 주소 문자열에서 광역 areaCode 를 판별한다.
 *
 * @param {string} address Odii 항목의 주소(현재 선택 언어로 현지화됨)
 * @param {string} [lang] 현재 데이터 언어(ko|en|zh|ja). 해당 언어 후보를 먼저 시도하고,
 *                        실패 시 전체 언어 후보로 폴백한다.
 * @returns {string|null} areaCode 문자열(예: "32") 또는 매칭 실패 시 null
 */
export function resolveAreaCodeFromAddress(address, lang) {
  if (!address) return null;
  const rawAddr = String(address).trim();
  if (!rawAddr) return null;
  const lowerAddr = rawAddr.toLowerCase();

  const ordered = [];
  const primary = normalizeLang(lang);
  if (primary) ordered.push(primary);
  for (const l of ["ko", "en", "zh", "ja"]) {
    if (!ordered.includes(l)) ordered.push(l);
  }

  for (const l of ordered) {
    const isLatin = l === "en";
    for (const code of ALL_CODES) {
      if (matchesAnyVariant(rawAddr, lowerAddr, PROVINCE_VARIANTS[code][l], isLatin)) {
        return code;
      }
    }
  }
  return null;
}
