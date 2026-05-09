/**
 * 기상청 단기 reg 대표 좌표 — 서버 KmaRegCentroid 와 동기.
 * 패널에서 지역 탭 선택 시 lat/lng 로 short-reg 호출(초단기·단기 동시).
 */
export const WEATHER_REGION_PRESETS = [
  { reg: '11B10101', lat: 37.498, lng: 127.028, labelKo: '서울(강남)', labelEn: 'Seoul (Gangnam)' },
  { reg: '11B10103', lat: 37.573, lng: 126.979, labelKo: '서울(종로)', labelEn: 'Seoul (Jongno)' },
  { reg: '11B20201', lat: 37.456, lng: 126.705, labelKo: '인천', labelEn: 'Incheon' },
  { reg: '11B20605', lat: 37.263, lng: 127.029, labelKo: '수원', labelEn: 'Suwon' },
  { reg: '11B20405', lat: 37.881, lng: 127.729, labelKo: '춘천', labelEn: 'Chuncheon' },
  { reg: '11B20403', lat: 37.751, lng: 128.876, labelKo: '강릉', labelEn: 'Gangneung' },
  { reg: '11C20401', lat: 36.35, lng: 127.384, labelKo: '대전', labelEn: 'Daejeon' },
  { reg: '11H10701', lat: 35.871, lng: 128.601, labelKo: '대구', labelEn: 'Daegu' },
  { reg: '11H10201', lat: 35.538, lng: 129.311, labelKo: '울산', labelEn: 'Ulsan' },
  { reg: '11H20201', lat: 35.179, lng: 129.075, labelKo: '부산', labelEn: 'Busan' },
  { reg: '11H20301', lat: 35.228, lng: 128.681, labelKo: '창원', labelEn: 'Changwon' },
  { reg: '11F20501', lat: 35.159, lng: 126.852, labelKo: '광주', labelEn: 'Gwangju' },
  { reg: '11F10201', lat: 35.824, lng: 127.148, labelKo: '전주', labelEn: 'Jeonju' },
  { reg: '11F20801', lat: 34.811, lng: 126.392, labelKo: '목포', labelEn: 'Mokpo' },
  { reg: '11G00201', lat: 33.499, lng: 126.531, labelKo: '제주', labelEn: 'Jeju' },
  { reg: '11H10301', lat: 36.019, lng: 129.343, labelKo: '포항', labelEn: 'Pohang' },
  { reg: '11H10501', lat: 36.568, lng: 128.729, labelKo: '안동', labelEn: 'Andong' },
  { reg: '11F10301', lat: 35.57, lng: 126.856, labelKo: '정읍', labelEn: 'Jeongeup' },
  { reg: '11C10301', lat: 36.642, lng: 127.489, labelKo: '청주', labelEn: 'Cheongju' },
  { reg: '11C10304', lat: 36.48, lng: 127.289, labelKo: '세종', labelEn: 'Sejong' },
];

export function weatherPresetLabel(preset, i18nLanguage) {
  if (!preset) return '';
  return String(i18nLanguage || '').toLowerCase().startsWith('en') ? preset.labelEn : preset.labelKo;
}
