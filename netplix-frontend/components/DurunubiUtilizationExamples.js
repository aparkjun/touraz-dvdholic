'use client';

import { ExternalLink, Smartphone, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EXAMPLES = [
  {
    id: 'snapic',
    href: 'https://play.google.com/store/apps/details?id=com.path2way.snapic&hl=ko',
    icon: Smartphone,
    accent: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    titleKey: 'trekking.examples.snapicTitle',
    titleFb: '스내픽 Snapic',
    bodyKey: 'trekking.examples.snapicBody',
    bodyFb: '포토스팟·포토메이트·문화재 큐레이션을 결합한 모바일 앱 활용 사례',
  },
  {
    id: 'heyroute',
    href: 'https://hey-route.com/',
    icon: Globe,
    accent: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)',
    titleKey: 'trekking.examples.heyrouteTitle',
    titleFb: '헤이루트',
    bodyKey: 'trekking.examples.heyrouteBody',
    bodyFb: '트레킹 코스 검색·가이드·사용자 코스를 제공하는 웹 플랫폼 활용 사례',
  },
];

export default function DurunubiUtilizationExamples() {
  const { t } = useTranslation();

  return (
    <section className="durunubi-examples" aria-labelledby="durunubi-examples-title">
      <h2 id="durunubi-examples-title" className="durunubi-examples-title">
        {t('trekking.examples.sectionTitle', '두루누비 API 활용 사례')}
      </h2>
      <p className="durunubi-examples-sub">
        {t(
          'trekking.examples.sectionSub',
          '한국관광공사 코리아둘레길 GPX·코스 데이터는 아래와 같이 모바일·웹 서비스에서 재생산되고 있습니다. Touraz도 같은 공공 API로 걷기 코스를 제공합니다.',
        )}
      </p>
      <ul className="durunubi-examples-grid">
        {EXAMPLES.map((ex) => {
          const Icon = ex.icon;
          return (
            <li key={ex.id}>
              <a
                href={ex.href}
                target="_blank"
                rel="noopener noreferrer"
                className="durunubi-examples-card"
              >
                <span className="durunubi-examples-icon" style={{ background: ex.accent }}>
                  <Icon size={18} aria-hidden />
                </span>
                <span className="durunubi-examples-text">
                  <span className="durunubi-examples-card-title">
                    {t(ex.titleKey, ex.titleFb)}
                  </span>
                  <span className="durunubi-examples-card-body">
                    {t(ex.bodyKey, ex.bodyFb)}
                  </span>
                </span>
                <ExternalLink size={14} className="durunubi-examples-ext" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
      <style jsx>{`
        .durunubi-examples {
          max-width: 1160px;
          margin: 28px auto 0;
          padding: 0 20px;
        }
        .durunubi-examples-title {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 800;
          color: #ecfdf5;
        }
        .durunubi-examples-sub {
          margin: 0 0 14px;
          font-size: 13px;
          line-height: 1.55;
          color: rgba(220, 252, 231, 0.72);
          max-width: 720px;
        }
        .durunubi-examples-grid {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        }
        .durunubi-examples-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 16px;
          text-decoration: none;
          color: inherit;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(110, 231, 183, 0.22);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .durunubi-examples-card:hover {
          transform: translateY(-2px);
          border-color: rgba(110, 231, 183, 0.45);
        }
        .durunubi-examples-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          color: #fff;
        }
        .durunubi-examples-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .durunubi-examples-card-title {
          font-size: 14px;
          font-weight: 800;
          color: #f0fdf4;
        }
        .durunubi-examples-card-body {
          font-size: 12px;
          line-height: 1.45;
          color: rgba(220, 252, 231, 0.7);
        }
        .durunubi-examples-ext {
          flex-shrink: 0;
          color: #6ee7b7;
          margin-top: 4px;
        }
      `}</style>
    </section>
  );
}
