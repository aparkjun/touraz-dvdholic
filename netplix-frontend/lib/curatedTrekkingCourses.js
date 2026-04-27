/**
 * 코리아둘레길(두루누비) 데이터에 포함되지 않는 내륙·도시 지역의
 * 추천 도보·산책 코스 큐레이션.
 *
 * 두루누비 API(B551011/Durunubi) 는 해파랑길·남파랑길·서해랑길 등
 * 해안선을 따르는 코리아둘레길 4대 노선(약 4,500km, 284 코스)만 다루기
 * 때문에, 서울·경기·대전·대구·세종처럼 해안이 없거나 적은 광역시도는
 * `/trekking?area=X` 호출 시 코스 카드가 0개로 비어 사용자가 "왜 서울은
 * 코스가 없냐"고 의아해하는 UX 이슈가 발생한다.
 *
 * 이 모듈은 그 공백을 메우기 위해 한국관광공사 / 서울시 / 각 지자체
 * 공식 사이트 정보를 바탕으로 손으로 정리한 추천 도보 코스를 areaCode
 * 별로 묶어 노출한다. 두루누비 코스와 시각적으로 구분하기 위해 별도
 * 섹션("{지역} 추천 도보 코스")으로 렌더링한다.
 *
 * 거리·소요시간은 출처 사이트 표기를 그대로 따르되, 정확한 수치보다
 * 사용자 감각을 돕는 용도이므로 보수적으로 라운드한다.
 */

const SEOUL = [
  {
    id: 'seoul-hanyang-fortress',
    name: '한양도성길',
    sigun: '서울 종로구·중구·성북구',
    distanceKm: 18.6,
    estimatedTimeLabel: '약 8~10시간 (4코스 분할 추천)',
    levelLabel: '보통',
    summary:
      '백악산·낙산·남산·인왕산을 잇는 600년 도읍의 성곽길. 유네스코 세계유산 잠정목록에 등재된 서울의 대표 도보 코스로, 4개 구간으로 나누어 반나절씩 걷기 좋다.',
    tags: ['역사', '성곽', '도심'],
    detailUrl: 'https://seoulcitywall.seoul.go.kr/front/web/walking/courseInfo.do',
  },
  {
    id: 'seoul-bukhansan-dulle',
    name: '북한산 둘레길',
    sigun: '서울 강북·은평·성북·종로구',
    distanceKm: 71.5,
    estimatedTimeLabel: '21개 구간 · 구간당 1~3시간',
    levelLabel: '쉬움~보통',
    summary:
      '북한산국립공원을 한 바퀴 두르는 저지대 산책로. 21개 구간으로 나뉘어 있어 골라 걷기 좋고, 우이령길·소나무숲길 등 인기 구간은 가족 단위로도 부담 없다.',
    tags: ['숲길', '국립공원', '가족'],
    detailUrl: 'https://www.knps.or.kr/front/portal/visit/dulleguide.do?parkId=180',
  },
  {
    id: 'seoul-namsan-dulle',
    name: '남산 둘레길',
    sigun: '서울 중구·용산구',
    distanceKm: 7.5,
    estimatedTimeLabel: '약 1시간 30분',
    levelLabel: '쉬움',
    summary:
      '남산을 둘러싸는 평탄한 순환 산책로. N서울타워·국립극장·남산예장공원을 지나며, 도심에서 가장 접근성 좋은 산림 도보 코스로 꼽힌다.',
    tags: ['도심 산책', '야경', '접근성'],
    detailUrl: 'https://www.namsanpark.com/',
  },
  {
    id: 'seoul-cheonggyecheon',
    name: '청계천 산책로',
    sigun: '서울 종로구·중구·동대문구',
    distanceKm: 10.9,
    estimatedTimeLabel: '약 2시간 30분',
    levelLabel: '쉬움',
    summary:
      '청계광장에서 시작해 동대문·신답을 거쳐 한양대 앞 중랑천 합류부까지 이어지는 도심 하천 산책로. 야간 조명과 분수가 어우러져 저녁 산책 코스로 인기.',
    tags: ['하천', '야간', '도심'],
    detailUrl: 'https://www.sisul.or.kr/open_content/cheonggye/',
  },
  {
    id: 'seoul-inwangsan-jaraegil',
    name: '인왕산 자락길',
    sigun: '서울 종로구·서대문구',
    distanceKm: 5.3,
    estimatedTimeLabel: '약 2시간',
    levelLabel: '쉬움',
    summary:
      '윤동주 문학관에서 시작해 무무대·인왕산 정상 갈림길까지 이어지는 무장애 산책로. 사직단·서촌으로 빠지면 도성길과 자연스럽게 연결된다.',
    tags: ['전망', '문학', '무장애'],
    detailUrl: 'https://parks.seoul.go.kr/inwang',
  },
  {
    id: 'seoul-ansan-jaraegil',
    name: '안산 자락길',
    sigun: '서울 서대문구',
    distanceKm: 7.0,
    estimatedTimeLabel: '약 2시간',
    levelLabel: '쉬움',
    summary:
      '국내 최초 순환형 무장애 자락길. 데크길로 조성되어 유아차·휠체어도 가능하며, 봉수대 전망에서 한양도성과 인왕산이 한눈에 들어온다.',
    tags: ['무장애', '데크길', '전망'],
    detailUrl: 'https://parks.seoul.go.kr/ansan',
  },
  {
    id: 'seoul-han-river-banpo',
    name: '한강공원 반포지구 달빛무지개분수길',
    sigun: '서울 서초구',
    distanceKm: 4.0,
    estimatedTimeLabel: '약 1시간',
    levelLabel: '쉬움',
    summary:
      '세빛섬·반포대교 무지개분수·서래섬을 잇는 한강 산책 코스. 야간 분수쇼와 피크닉으로 특화되어 있어 영화 감상 후 코스로도 좋다.',
    tags: ['한강', '야경', '데이트'],
    detailUrl: 'https://hangang.seoul.go.kr/www/contents/57',
  },
  {
    id: 'seoul-seoullo-7017',
    name: '서울로 7017 ~ 손기정공원',
    sigun: '서울 중구',
    distanceKm: 1.7,
    estimatedTimeLabel: '약 40분',
    levelLabel: '쉬움',
    summary:
      '폐쇄된 서울역 고가도로를 보행길로 재생한 도시 정원. 만리동·손기정공원과 이어 걷기 좋고, 서울역사·문화역서울284 와 가까워 도심 코스로 적합.',
    tags: ['도시 재생', '정원', '단거리'],
    detailUrl: 'https://seoullo7017.seoul.go.kr/',
  },
];

const GYEONGGI = [
  {
    id: 'gg-suwon-hwaseong',
    name: '수원 화성 행궁길',
    sigun: '경기 수원시 팔달구',
    distanceKm: 5.7,
    estimatedTimeLabel: '약 2시간',
    levelLabel: '쉬움',
    summary:
      '유네스코 세계유산 수원화성을 한 바퀴 도는 코스. 장안문→화서문→팔달문→창룡문 4문을 순회하며, 행궁·통닭거리와도 자연 연결.',
    tags: ['세계유산', '성곽', '도심'],
    detailUrl: 'https://www.swcf.or.kr/?p=152',
  },
  {
    id: 'gg-gwanggyo-dulle',
    name: '광교산 둘레길',
    sigun: '경기 수원·용인',
    distanceKm: 14.8,
    estimatedTimeLabel: '4개 구간 · 구간당 1~2시간',
    levelLabel: '보통',
    summary:
      '수도권 가족 산행 명소 광교산을 두르는 4구간 코스. 광교저수지·반딧불이화장실·형제봉을 지나며 사계절 표정이 다채롭다.',
    tags: ['숲길', '저수지', '가족'],
    detailUrl: 'https://www.suwon.go.kr/web/visit/recom/walking.do',
  },
  {
    id: 'gg-yangpyeong-dumulmeori',
    name: '양평 두물머리 물래길',
    sigun: '경기 양평군 양서면',
    distanceKm: 4.5,
    estimatedTimeLabel: '약 1시간 30분',
    levelLabel: '쉬움',
    summary:
      '북한강·남한강이 만나는 두물머리에서 세미원·연꽃박물관·운길산역으로 이어지는 강변 산책길. 새벽 물안개 풍경이 인생샷 명소.',
    tags: ['강변', '사진', '근교'],
    detailUrl: 'https://tour.yp21.go.kr/',
  },
  {
    id: 'gg-gapyeong-jaraseom',
    name: '가평 자라섬 한 바퀴',
    sigun: '경기 가평군 가평읍',
    distanceKm: 6.2,
    estimatedTimeLabel: '약 2시간',
    levelLabel: '쉬움',
    summary:
      '재즈페스티벌로 유명한 자라섬 일주 코스. 캠핑장·꽃단지·오토캠핑장을 지나며, 남이섬·자라섬 어트랙션과 묶어 당일치기로 좋다.',
    tags: ['섬', '캠핑', '근교'],
    detailUrl: 'https://www.gp.go.kr/tour/contents.do?key=2906',
  },
];

const DAEJEON = [
  {
    id: 'dj-gyejok-hwangto',
    name: '계족산 황톳길',
    sigun: '대전 동구·대덕구',
    distanceKm: 14.5,
    estimatedTimeLabel: '약 3시간 30분',
    levelLabel: '쉬움~보통',
    summary:
      '맨발로 걷는 황톳길로 유명한 대전 명소. 임도 형태의 평탄한 둘레길에 2003년부터 황토를 깔아 조성, 매년 봄·가을 맨발페스티벌이 열린다.',
    tags: ['맨발', '황톳길', '힐링'],
    detailUrl: 'https://www.daejeon.go.kr/dong/',
  },
  {
    id: 'dj-daecheong-500',
    name: '대청호 오백리길',
    sigun: '대전 동구·청주·옥천',
    distanceKm: 220,
    estimatedTimeLabel: '21개 구간 · 구간당 2~5시간',
    levelLabel: '보통',
    summary:
      '대청호를 한 바퀴 도는 약 220km 의 광역 둘레길. 21개 구간으로 나뉘며 4·5구간(찬샘마을~호반로) 이 인기 입문 코스.',
    tags: ['호수', '광역 둘레길', '드라이브'],
    detailUrl: 'http://www.dc500.org/',
  },
];

const GWANGJU = [
  {
    id: 'gj-mudeungsan-yet-gil',
    name: '무등산 옛길',
    sigun: '광주 동구·북구',
    distanceKm: 11.9,
    estimatedTimeLabel: '약 4시간',
    levelLabel: '보통',
    summary:
      '도심에서 무등산 정상부까지 이어지는 역사 도보 코스. 산수동·청풍쉼터·중머리재 구간이 잘 정비되어 있고, 가을 단풍이 명물이다.',
    tags: ['국립공원', '단풍', '역사'],
    detailUrl: 'https://www.knps.or.kr/front/portal/visit/dulleguide.do?parkId=290',
  },
];

const SEJONG = [
  {
    id: 'sj-miho-river',
    name: '미호강 자전거·도보길',
    sigun: '세종특별자치시',
    distanceKm: 17.0,
    estimatedTimeLabel: '약 4시간 (자전거 1시간)',
    levelLabel: '쉬움',
    summary:
      '세종 시내를 가로지르는 미호강을 따라 조성된 평탄한 강변 보행·자전거 통합 노선. 정부세종청사·세종호수공원 산책로와도 연결된다.',
    tags: ['강변', '평지', '자전거'],
    detailUrl: 'https://www.sejong.go.kr/tour.do',
  },
];

const CHUNGBUK = [
  {
    id: 'cb-cheongnamdae',
    name: '청남대 대청호반길',
    sigun: '충북 청주시 상당구',
    distanceKm: 10.5,
    estimatedTimeLabel: '5개 코스 · 구간당 1~2시간',
    levelLabel: '쉬움',
    summary:
      '대통령 별장 청남대를 중심으로 조성된 5개 코스의 호반길. 대통령길·갈대길·메타세쿼이아길 등 테마별로 짧게 끊어 걷기 좋다.',
    tags: ['호반', '역사', '근교'],
    detailUrl: 'https://chnam.chungbuk.go.kr/',
  },
];

const GYEONGBUK = [
  {
    id: 'gb-andong-hahoe',
    name: '안동 하회마을 부용대 둘레길',
    sigun: '경북 안동시 풍천면',
    distanceKm: 5.0,
    estimatedTimeLabel: '약 2시간',
    levelLabel: '쉬움',
    summary:
      '유네스코 세계유산 하회마을과 강 건너 부용대 절벽을 잇는 강변·언덕 산책 코스. 옥연정사·겸암정사 등 고택 풍경이 더해진다.',
    tags: ['세계유산', '강변', '고택'],
    detailUrl: 'https://www.tourandong.com/',
  },
];

/**
 * areaCode → 큐레이션 코스 배열.
 * 두루누비 정식 데이터가 충분한 해안 광역(부산6, 인천2, 강원32, 전남36,
 * 경남38, 제주39 등)은 비워둔다.
 */
export const CURATED_TREKKING_COURSES = {
  1: SEOUL,
  3: DAEJEON,
  5: GWANGJU,
  8: SEJONG,
  31: GYEONGGI,
  33: CHUNGBUK,
  37: GYEONGBUK,
};

/** 해당 areaCode 의 큐레이션 코스 배열 (없으면 빈 배열). */
export function getCuratedCourses(areaCode) {
  if (areaCode == null) return [];
  const key = typeof areaCode === 'string' ? Number(areaCode) : areaCode;
  return CURATED_TREKKING_COURSES[key] || [];
}
