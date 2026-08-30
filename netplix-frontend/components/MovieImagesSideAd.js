"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { getAdSenseClient, getAdSenseSideSlot } from "@/lib/adsense";
import { isNativeCapacitor } from "@/lib/openExternalUrl";

const DESKTOP_MQ = "(min-width: 1400px)";

function useDesktopAdRail() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = async () => {
      if (!alive) return;
      const native = await isNativeCapacitor();
      setShow(!native && mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      alive = false;
      mq.removeEventListener("change", sync);
    };
  }, []);

  return show;
}

function AdSenseUnit({ client, slot }) {
  const insRef = useRef(null);

  useEffect(() => {
    const el = insRef.current;
    if (!el || !client || !slot) return;
    if (el.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 스크립트 미로드·중복 push */
    }
  }, [client, slot]);

  return (
    <ins
      ref={insRef}
      className="adsbygoogle movie-images-adsense"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="false"
    />
  );
}

function HouseAd({ href, title, sub }) {
  const { t } = useTranslation();
  return (
    <Link href={href} className="movie-images-house-ad">
      <span className="movie-images-ad-label">{t("movieImages.adLabel")}</span>
      <strong>{title}</strong>
      <span>{sub}</span>
    </Link>
  );
}

function HouseStack() {
  const { t } = useTranslation();
  return (
    <div className="movie-images-house-stack">
      <HouseAd
        href="/cine-trip"
        title={t("movieImages.adCineTrip")}
        sub={t("movieImages.adCineTripSub")}
      />
      <HouseAd
        href="/wellness"
        title={t("movieImages.adWellness")}
        sub={t("movieImages.adWellnessSub")}
      />
    </div>
  );
}

/**
 * PC 상세 좌측: AdSense 디스플레이(pc ad). 우측: 시네트립·웰니스 하우스.
 * 좁은 화면·네이티브 앱에서는 마운트하지 않는다(숨긴 광고 금지).
 */
export default function MovieImagesSideAd({ side = "left" }) {
  const show = useDesktopAdRail();
  const client = getAdSenseClient();
  const slot = getAdSenseSideSlot();

  if (!show) return null;

  return (
    <div className="movie-images-ad-rail-inner">
      {side === "left" && client && slot ? (
        <AdSenseUnit client={client} slot={slot} />
      ) : (
        <HouseStack />
      )}
    </div>
  );
}
