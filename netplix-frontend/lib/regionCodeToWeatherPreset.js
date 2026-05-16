/**
 * 여행 페이지 공통 광역 코드(regionShortcuts 1~39,31 등) → 기상청 단기 reg + 대표 좌표.
 * {@link WEATHER_REGION_PRESETS} 와 맞물리게 유지한다.
 */
import { WEATHER_REGION_PRESETS } from '@/lib/weatherRegionPresets';
import { resolveAreaCode } from '@/lib/regionAreaCode';

function byReg(reg) {
  const p = WEATHER_REGION_PRESETS.find((x) => x.reg === reg);
  if (!p) return reg ? { reg } : null;
  return { reg: p.reg, lat: p.lat, lng: p.lng };
}

/** @type {Record<string, { reg: string, lat?: number, lng?: number }|null>} */
const SHORTCUT_CODE_TO_QUERY = {
  '1': byReg('11B10101'),
  '2': byReg('11B20201'),
  '3': byReg('11C20401'),
  '4': byReg('11H10701'),
  '5': byReg('11F20501'),
  '6': byReg('11H20201'),
  '7': byReg('11H10201'),
  '8': byReg('11C10304'),
  '31': byReg('11B20605'),
  '32': byReg('11B20403'),
  '33': byReg('11C10301'),
  '34': byReg('11C20401'),
  '35': byReg('11F10201'),
  '36': byReg('11F20801'),
  '37': byReg('11H10301'),
  '38': byReg('11H20301'),
  '39': byReg('11G00201'),
};

/**
 * @param {string|number|null|undefined} code — regionShortcuts 키 (예: "32")
 * @returns {{ reg: string, lat?: number, lng?: number }|null}
 */
export function getWeatherQueryForShortcutCode(code) {
  if (code == null || code === '') return null;
  const k = String(code).trim();
  return SHORTCUT_CODE_TO_QUERY[k] ?? null;
}

/**
 * TarRlteTar / 혼잡도 등에서 내려오는 광역·시군구 한글명으로 단기 예보 구역 추정.
 * @returns {{ reg: string, lat?: number, lng?: number }|null}
 */
export function getWeatherQueryFromAreaNames(areaName, signguName) {
  const t = `${areaName || ''} ${signguName || ''}`.trim();
  if (!t) return null;
  const c = resolveAreaCode(t);
  return c ? getWeatherQueryForShortcutCode(c) : null;
}
