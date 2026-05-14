'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
  Navigation,
  Sparkles,
  Tag,
} from 'lucide-react';
import useBackButtonClose from '@/lib/useBackButtonClose';
import { MapServiceLinkButton } from '@/components/MapServiceLinkButton';

/**
 * 웰니스 스팟 상세 모달.
 *
 * 백엔드 /api/v1/wellness 응답에는 overview/description 같은 상세 텍스트 필드가 없다.
 * (KTO TourAPI areaBasedList/searchKeyword/locationBasedList 공통 스키마 한계)
 *
 * 그래서 이 모달은 카드가 이미 보유한 데이터(이름·주소·전화·이미지·좌표·분류코드)를
 * 정돈해서 보여주고, 카카오맵 / 전화 / VisitKorea 공식 페이지로 빠르게 이어주는 데
 * 집중한다. 추후 KTO detailCommon/Intro/Image 엔드포인트가 백엔드에 추가되면
 * 본문 영역(<section className="ws-mod-overview">)에 그 데이터를 채우면 된다.
 *
 * 시스템 뒤로가기 / Esc / 오버레이 클릭 모두로 닫힌다.
 */

const REGION_LABEL = {
  '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주',
  '6': '부산', '7': '울산', '8': '세종',
  '31': '경기', '32': '강원', '33': '충북', '34': '충남',
  '35': '전북', '36': '전남', '37': '경북', '38': '경남', '39': '제주',
};

/** 웰니스 목록 API의 areaCode는 Kor 광역(1~39)이 아니라 법정동 광역 lDongRegnCd(11, 26, …). */
const LDONG_REGN_LABEL = {
  '11': '서울', '26': '부산', '27': '대구', '28': '인천', '29': '광주',
  '30': '대전', '31': '울산', '36': '세종', '41': '경기', '42': '강원',
  '43': '충북', '44': '충남', '45': '경북', '46': '경남', '47': '전북', '48': '전남',
  '50': '제주', '51': '강원', '52': '경북',
};

function regionLabelForSpot(spot) {
  const ac = String(spot?.areaCode ?? '').trim();
  if (!ac) return '';
  if (LDONG_REGN_LABEL[ac]) return LDONG_REGN_LABEL[ac];
  return REGION_LABEL[ac] || '';
}

const CONTENT_TYPE_LABEL = {
  '12': '관광지',
  '14': '문화시설',
  '15': '행사·축제',
  '25': '여행코스',
  '28': '레포츠',
  '32': '숙박',
  '38': '쇼핑',
  '39': '음식점',
};

export default function WellnessSpotDetailModal({ spot, onClose }) {
  const { t } = useTranslation();
  useBackButtonClose(!!spot, onClose);

  React.useEffect(() => {
    if (!spot) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [spot, onClose]);

  if (!spot) return null;

  const regionLabel = regionLabelForSpot(spot);
  const contentTypeLabel = CONTENT_TYPE_LABEL[String(spot.contentTypeId || '')] || '';

  const kakaoMapUrl = spot.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent(spot.address)}`
    : (spot.latitude != null && spot.longitude != null
      ? `https://map.kakao.com/link/map/${encodeURIComponent(spot.name || '힐링 스팟')},${spot.latitude},${spot.longitude}`
      : null);
  const naverMapUrl = spot.address
    ? `https://map.naver.com/p/search/${encodeURIComponent(spot.address)}`
    : (spot.latitude != null && spot.longitude != null
      ? `https://map.naver.com/p/search/${encodeURIComponent(`${spot.longitude},${spot.latitude}`)}`
      : null);
  const telDigits = spot.tel ? String(spot.tel).replace(/[^\d+]/g, '') : '';
  const telHref = telDigits ? `tel:${telDigits}` : null;
  const visitKoreaUrl = spot.id
    ? `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${encodeURIComponent(spot.id)}`
    : null;

  return (
    <div
      className="ws-mod-root"
      role="dialog"
      aria-modal="true"
      aria-label={spot.name}
      onClick={onClose}
    >
      <div
        className="ws-mod-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ws-mod-close"
          onClick={onClose}
          aria-label={t('common.close', '닫기')}
        >
          <X size={18} />
        </button>

        <div className="ws-mod-hero">
          {spot.imageUrl ? (
            <img
              src={spot.imageUrl}
              alt={spot.name || ''}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.classList.add('ws-mod-hero-fallback');
              }}
            />
          ) : (
            <div className="ws-mod-hero-empty">
              <Sparkles size={42} />
            </div>
          )}
          <div className="ws-mod-hero-shade" aria-hidden />
          <div className="ws-mod-hero-meta">
            <div className="ws-mod-tags">
              {regionLabel && (
                <span className="ws-mod-tag ws-mod-tag-region">
                  <MapPin size={11} />
                  {regionLabel}
                </span>
              )}
              {contentTypeLabel && (
                <span className="ws-mod-tag">
                  <Tag size={11} />
                  {contentTypeLabel}
                </span>
              )}
              {spot.distanceKm != null && (
                <span className="ws-mod-tag ws-mod-tag-dist">
                  <Navigation size={11} />
                  {spot.distanceKm < 1
                    ? `${Math.round(spot.distanceKm * 1000)}m`
                    : `${spot.distanceKm.toFixed(1)}km`}
                </span>
              )}
            </div>
            <h2 className="ws-mod-title">{spot.name || '—'}</h2>
          </div>
        </div>

        <div className="ws-mod-body">
          <ul className="ws-mod-info">
            {spot.address && (
              <li>
                <MapPin size={14} className="ws-mod-info-icn" />
                <span>{spot.address}</span>
              </li>
            )}
            {spot.zipcode && (
              <li>
                <span className="ws-mod-info-icn ws-mod-info-zip">우편</span>
                <span>{spot.zipcode}</span>
              </li>
            )}
            {spot.tel ? (
              <li>
                <Phone size={14} className="ws-mod-info-icn" />
                {telHref ? (
                  <a href={telHref} className="ws-mod-link">
                    {spot.tel}
                  </a>
                ) : (
                  <span>{spot.tel}</span>
                )}
              </li>
            ) : (
              <li className="ws-mod-info-muted">
                <Phone size={14} className="ws-mod-info-icn" />
                <span>
                  목록에 전화번호 없음 — 공공 데이터에 연락처가 비어 있는 경우가 많습니다. 지도·공식 페이지를 이용해 주세요.
                </span>
              </li>
            )}
          </ul>

          <div className="ws-mod-actions">
            {kakaoMapUrl && (
              <MapServiceLinkButton
                href={kakaoMapUrl}
                brand="kakao"
                label={t('wellness.modal.kakaoMap', '카카오맵에서 보기')}
              />
            )}
            {naverMapUrl && (
              <MapServiceLinkButton
                href={naverMapUrl}
                brand="naver"
                label={t('wellness.modal.naverMap', '네이버 지도')}
              />
            )}
            {spot.homepage && String(spot.homepage).trim() !== '' && (
              <a
                href={spot.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-mod-act ws-mod-act-home"
              >
                <ExternalLink size={14} />
                업체·공식 홈페이지
              </a>
            )}
            {telHref && (
              <a href={telHref} className="ws-mod-act ws-mod-act-tel">
                <Phone size={14} />
                전화 걸기
              </a>
            )}
            {visitKoreaUrl && (
              <a
                href={visitKoreaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-mod-act ws-mod-act-vk"
              >
                <Sparkles size={14} />
                VisitKorea 공식
                <ExternalLink size={12} className="ws-mod-act-ext" />
              </a>
            )}
          </div>

          <p className="ws-mod-note">
            데이터 출처 · 한국관광공사 TourAPI(웰니스관광 목록). 상세 소개·추가 연락처는 지도·공식 사이트에서 확인할 수 있습니다.
          </p>
        </div>
      </div>

      <style jsx>{`
        .ws-mod-root {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: ws-mod-fade 200ms ease-out;
        }
        .ws-mod-card {
          position: relative;
          width: 100%;
          max-width: 560px;
          max-height: calc(100dvh - 32px);
          overflow-y: auto;
          background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          color: #e2e8f0;
          box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;
          animation: ws-mod-rise 240ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ws-mod-close {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f1f5f9;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition: background 160ms ease, transform 160ms ease;
        }
        .ws-mod-close:hover {
          background: rgba(15, 23, 42, 0.95);
          transform: scale(1.05);
        }

        .ws-mod-hero {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          background: #0a1020;
          overflow: hidden;
          border-radius: 18px 18px 0 0;
        }
        .ws-mod-hero img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ws-mod-hero-empty,
        .ws-mod-hero-fallback::after {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(185, 198, 188, 0.65);
          background: radial-gradient(
            120% 100% at 50% 0%,
            rgba(102, 118, 108, 0.2) 0%,
            transparent 60%
          ), linear-gradient(135deg, rgba(95,110,100,0.08), rgba(105,95,115,0.06));
        }
        .ws-mod-hero-fallback::after {
          content: '🌿';
          font-size: 36px;
        }
        .ws-mod-hero-shade {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(2, 6, 23, 0) 35%,
            rgba(2, 6, 23, 0.72) 100%
          );
          pointer-events: none;
        }
        .ws-mod-hero-meta {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ws-mod-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ws-mod-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #e2e8f0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
          backdrop-filter: blur(6px);
        }
        .ws-mod-tag-region {
          background: rgba(95, 110, 100, 0.22);
          border-color: rgba(140, 155, 145, 0.45);
          color: #c5cfc4;
        }
        .ws-mod-tag-dist {
          background: rgba(56, 189, 248, 0.18);
          border-color: rgba(125, 211, 252, 0.45);
          color: #bae6fd;
        }
        .ws-mod-title {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1.25;
          color: #ffffff;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
        }

        .ws-mod-body {
          padding: 16px 18px 20px;
        }
        .ws-mod-info {
          margin: 0 0 14px;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ws-mod-info li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13.5px;
          line-height: 1.45;
          color: #cbd5e1;
        }
        .ws-mod-info-icn {
          flex-shrink: 0;
          color: #94a3b8;
          margin-top: 2px;
        }
        .ws-mod-info-zip {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          background: rgba(148, 163, 184, 0.16);
          color: #94a3b8;
          letter-spacing: 0.04em;
          margin-top: 1px;
        }
        .ws-mod-link {
          color: #9bb8b8;
          text-decoration: none;
          border-bottom: 1px dotted rgba(145, 168, 168, 0.45);
        }
        .ws-mod-link:hover {
          color: #c2d4d4;
        }
        .ws-mod-info-muted {
          color: #94a3b8;
          font-size: 12.5px;
        }

        .ws-mod-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .ws-mod-act {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 13px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
          font-size: 12.5px;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 160ms ease, transform 160ms ease,
            border-color 160ms ease;
        }
        .ws-mod-act:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }
        .ws-mod-act-ext {
          opacity: 0.5;
          margin-left: 1px;
        }
        .ws-mod-act-primary {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #2a1900;
          border-color: rgba(252, 211, 77, 0.6);
        }
        .ws-mod-act-primary:hover {
          background: linear-gradient(135deg, #fcd34d 0%, #fb923c 100%);
          color: #1a0f00;
        }
        .ws-mod-act-naver {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          color: #052e16;
          border-color: rgba(187, 247, 208, 0.55);
        }
        .ws-mod-act-naver:hover {
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          color: #022c14;
        }
        .ws-mod-act-home {
          background: rgba(148, 163, 184, 0.14);
          color: #f1f5f9;
          border-color: rgba(148, 163, 184, 0.35);
        }
        .ws-mod-act-home:hover {
          background: rgba(148, 163, 184, 0.22);
        }
        .ws-mod-act-tel {
          background: linear-gradient(135deg, #5a6b60 0%, #4d5e55 100%);
          color: #f0f1ef;
          border-color: rgba(145, 160, 150, 0.55);
        }
        .ws-mod-act-tel:hover {
          background: linear-gradient(135deg, #657668 0%, #56665c 100%);
        }
        .ws-mod-act-vk {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #fff;
          border-color: rgba(165, 180, 252, 0.5);
        }
        .ws-mod-act-vk:hover {
          background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
        }

        .ws-mod-note {
          margin: 6px 0 0;
          color: #64748b;
          font-size: 11px;
          letter-spacing: 0.03em;
        }

        @keyframes ws-mod-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ws-mod-rise {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
