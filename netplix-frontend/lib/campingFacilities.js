/**
 * GoCamping 야영장 편의·안전·사이트 시설 표시용 파서.
 * API: 수량 필드(toiletCo 등) + 쉼표 구분 부대시설(sbrsCl) 병행.
 */

export function splitFacilityList(raw) {
  if (raw == null || raw === "") return [];
  return String(raw)
    .split(/[,，、/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listIncludesKeyword(list, keywords) {
  return list.some((item) =>
    keywords.some((kw) => item.includes(kw)),
  );
}

function positiveCount(n) {
  return typeof n === "number" && n > 0 ? n : null;
}

/**
 * @param {object} site CampingSiteResponse
 * @returns {{ hasAny: boolean, sites: Array, coreAmenities: Array, safety: Array, sbrsTags: string[], extras: Array }}
 */
export function buildCampingFacilityView(site) {
  if (!site) {
    return { hasAny: false, sites: [], coreAmenities: [], safety: [], sbrsTags: [], extras: [] };
  }

  const sbrs = splitFacilityList(site.sbrsCl);

  const sites = [
    { key: "gnrl", count: positiveCount(site.gnrlSiteCo) },
    { key: "auto", count: positiveCount(site.autoSiteCo) },
    { key: "glamp", count: positiveCount(site.glampSiteCo) },
    { key: "carav", count: positiveCount(site.caravSiteCo) },
    { key: "indvdlCarav", count: positiveCount(site.indvdlCaravSiteCo) },
    { key: "dump", count: positiveCount(site.sitedStncCo) },
  ].filter((r) => r.count != null);

  const coreAmenities = [
    {
      key: "toilet",
      count: positiveCount(site.toiletCo),
      fromSbrs: listIncludesKeyword(sbrs, ["화장실"]),
    },
    {
      key: "shower",
      count: positiveCount(site.swrmCo),
      fromSbrs: listIncludesKeyword(sbrs, ["샤워"]),
    },
    {
      key: "sink",
      count: positiveCount(site.wpcfcCo),
      fromSbrs: listIncludesKeyword(sbrs, ["개수대"]),
    },
  ].filter((r) => r.count != null || r.fromSbrs);

  const safety = [
    { key: "extinguisher", count: positiveCount(site.extshrCo) },
    { key: "fireWater", count: positiveCount(site.frprvtWrppCo) },
    { key: "fireSand", count: positiveCount(site.frprvtSandCo) },
    { key: "fireSensor", count: positiveCount(site.fireSensorCo) },
  ].filter((r) => r.count != null);

  const coreLabels = new Set(["화장실", "샤워실", "샤워장", "개수대"]);
  const sbrsTags = sbrs.filter(
    (tag) => !Array.from(coreLabels).some((l) => tag.includes(l) || l.includes(tag)),
  );

  const extras = [
    site.sbrsEtc ? { key: "sbrsEtc", value: site.sbrsEtc } : null,
    site.posblFcltyCl ? { key: "nearby", value: site.posblFcltyCl } : null,
    site.themaEnvrnCl ? { key: "theme", value: site.themaEnvrnCl } : null,
    site.brazierCl ? { key: "brazier", value: site.brazierCl } : null,
    site.eqpmnLendCl ? { key: "rental", value: site.eqpmnLendCl } : null,
    site.animalCmgCl ? { key: "pet", value: site.animalCmgCl } : null,
  ].filter(Boolean);

  const hasAny =
    sites.length > 0
    || coreAmenities.length > 0
    || safety.length > 0
    || sbrsTags.length > 0
    || extras.length > 0;

  return { hasAny, sites, coreAmenities, safety, sbrsTags, extras };
}

/** 목록 카드용 한 줄 요약 (핵심 편의·안전만) */
export function campingFacilitySummaryLine(site, t) {
  const view = buildCampingFacilityView(site);
  const parts = [];
  for (const a of view.coreAmenities) {
    const label = t(`camping.amenity.${a.key}`);
    parts.push(a.count != null ? `${label} ${a.count}` : label);
  }
  for (const s of view.safety.slice(0, 2)) {
    const label = t(`camping.safety.${s.key}`);
    parts.push(`${label} ${s.count}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
