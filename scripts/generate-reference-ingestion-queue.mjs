import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const QUEUE_VERSION = "governance-reference-ingestion-queue-v1";

const referenceCoverage = readJson("data/reference-coverage-map.json");
const manifest = readJson("manifest.json");
const artifactTitles = new Map(manifest.artifacts.map(entry => {
  const artifact = readJson(entry.path);
  return [artifact.id, artifact.short_title || artifact.title || artifact.id];
}));

const items = referenceCoverage.uncatalogued_references
  .map(buildQueueItem)
  .sort((a, b) => b.score - a.score || b.occurrence_count - a.occurrence_count || a.label.localeCompare(b.label))
  .map((item, index) => ({ ...item, queue_rank: index + 1 }));

const queue = {
  generated_at: referenceCoverage.generated_at,
  queue_version: QUEUE_VERSION,
  source_reference_coverage_generated_at: referenceCoverage.generated_at,
  summary: {
    queue_item_count: items.length,
    p0_count: items.filter(item => item.queue_priority === "P0").length,
    p1_count: items.filter(item => item.queue_priority === "P1").length,
    p2_count: items.filter(item => item.queue_priority === "P2").length,
    p3_count: items.filter(item => item.queue_priority === "P3").length,
    high_authority_count: items.filter(item => item.authority_tier === "high").length,
    source_artifact_count: new Set(items.flatMap(item => item.source_artifact_ids)).size,
  },
  family_summary: summarizeByFamily(items),
  queue_items: items,
};

let changed = 0;
changed += writeIfChanged("data/reference-ingestion-queue.json", `${JSON.stringify(queue, null, 2)}\n`);
changed += writeIfChanged("docs/reference-ingestion-queue.md", renderMarkdown(queue));

if (CHECK && changed) {
  throw new Error(`Reference ingestion queue is stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} reference ingestion queue with ${items.length} items (${queue.summary.p0_count} P0, ${queue.summary.p1_count} P1).`);

function buildQueueItem(reference) {
  const authorityWeight = authorityWeightFor(reference.reference_family);
  const occurrenceCount = Number(reference.total_count || reference.count || 0);
  const sourceCount = reference.source_artifact_ids?.length || 0;
  const score = authorityWeight
    + Math.min(occurrenceCount * 2, 48)
    + Math.min(sourceCount * 9, 36)
    + (reference.priority === "high" ? 18 : reference.priority === "medium" ? 8 : 0);
  const recommendation = recommendedArtifact(reference);
  const queuePriority = priorityFromScore(score);
  return {
    id: `ingest-${slug(reference.suggested_catalog_key || `${reference.reference_family}:${reference.label}`)}`,
    reference_key: reference.suggested_catalog_key,
    label: reference.label,
    reference_family: reference.reference_family,
    reference_type: reference.type,
    authority_tier: authorityWeight >= 85 ? "high" : authorityWeight >= 72 ? "medium" : "supporting",
    queue_priority: queuePriority,
    score,
    occurrence_count: occurrenceCount,
    source_artifact_count: sourceCount,
    source_artifact_ids: reference.source_artifact_ids || [],
    source_artifact_titles: (reference.source_artifact_ids || []).map(id => artifactTitles.get(id) || id),
    first_line: reference.first_line || null,
    lines_sample: reference.lines_sample || [],
    recommended_artifact_id: recommendation.id,
    recommended_title: recommendation.title,
    recommended_artifact_type: recommendation.artifact_type,
    recommended_authority_level: recommendation.authority_level,
    recommended_source_system: recommendation.source_system,
    recommended_source_location_type: recommendation.source_location_type,
    capture_strategy: recommendation.capture_strategy,
    official_source_candidates: officialSourceCandidates(reference),
    ingestion_status: "queued",
    mirror_requirements: [
      "Identify authoritative landing/source URL",
      "Mirror source document or authoritative HTML snapshot",
      "Extract full text",
      "Generate metadata, analytics, analysis, structured summary, claims, extractions, and reference map",
      "Regenerate reference coverage and ingestion queue",
    ],
    analyst_notes: analystNotes(reference, queuePriority),
  };
}

function authorityWeightFor(family) {
  return {
    "public-law": 100,
    usc: 96,
    "executive-order": 92,
    "omb-memo": 88,
    dodi: 84,
    dodd: 84,
    cfr: 80,
    far: 78,
    dfars: 78,
    secnav: 74,
    opnavinst: 72,
    navadmin: 66,
    "nist-sp": 64,
  }[family] || 55;
}

function priorityFromScore(score) {
  if (score >= 150) return "P0";
  if (score >= 132) return "P1";
  if (score >= 112) return "P2";
  return "P3";
}

function recommendedArtifact(reference) {
  const parsed = parseReference(reference);
  const base = {
    id: slug(reference.suggested_catalog_key || `${reference.reference_family}:${reference.label}`),
    title: reference.label,
    artifact_type: reference.type || "Governance Artifact",
    authority_level: "guidance",
    source_system: "Official Source",
    source_location_type: `${reference.reference_family}_official_source`,
    capture_strategy: "source_discovery_then_mirror",
  };

  if (reference.reference_family === "usc" && parsed.title && parsed.section) {
    return {
      ...base,
      id: `usc-title-${parsed.title}-section-${parsed.section.toLowerCase()}`,
      title: `${parsed.title} U.S.C. ${parsed.section}`,
      artifact_type: "U.S. Code",
      authority_level: "law",
      source_system: "U.S. Code",
      source_location_type: "uscode_house_gov_section_html",
      capture_strategy: "official_html_snapshot",
    };
  }
  if (reference.reference_family === "executive-order" && parsed.number) {
    return {
      ...base,
      id: `eo-${parsed.number}`,
      title: `Executive Order ${parsed.number}`,
      artifact_type: "Executive Order",
      authority_level: "executive_order",
      source_system: "Federal Register",
      source_location_type: "federal_register_document",
      capture_strategy: "federal_register_api_or_html",
    };
  }
  if (reference.reference_family === "cfr" && parsed.title && parsed.section) {
    return {
      ...base,
      id: `cfr-title-${parsed.title}-section-${parsed.section.toLowerCase()}`,
      title: `${parsed.title} CFR ${parsed.section}`,
      artifact_type: "Code of Federal Regulations",
      authority_level: "regulation",
      source_system: "eCFR",
      source_location_type: "ecfr_section_html",
      capture_strategy: "ecfr_api_or_html",
    };
  }
  if (reference.reference_family === "nist-sp" && parsed.series) {
    return {
      ...base,
      id: `nist-sp-${parsed.series.replace(/\./g, "-")}`,
      title: `NIST SP ${parsed.series}`,
      artifact_type: "NIST Special Publication",
      authority_level: "standards_guidance",
      source_system: "NIST CSRC",
      source_location_type: "nist_csrc_publication",
      capture_strategy: "official_pdf_or_publication_page",
    };
  }
  return base;
}

function officialSourceCandidates(reference) {
  const parsed = parseReference(reference);
  const encodedLabel = encodeURIComponent(reference.label);
  if (reference.reference_family === "usc" && parsed.title && parsed.section) {
    return [
      {
        label: "U.S. Code section view",
        url: `https://uscode.house.gov/view.xhtml?req=(title:${parsed.title}%20section:${parsed.section}%20edition:prelim)`,
        source_system: "U.S. Code",
        expected_capture_method: "official_html_snapshot",
      },
      {
        label: "GovInfo U.S. Code collection",
        url: "https://www.govinfo.gov/app/collection/uscode",
        source_system: "GovInfo",
        expected_capture_method: "collection_search",
      },
    ];
  }
  if (reference.reference_family === "executive-order" && parsed.number) {
    return [
      {
        label: "Federal Register search",
        url: `https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=${encodedLabel}`,
        source_system: "Federal Register",
        expected_capture_method: "api_or_html_search",
      },
      {
        label: "National Archives executive orders",
        url: "https://www.archives.gov/federal-register/executive-orders",
        source_system: "National Archives",
        expected_capture_method: "official_index_search",
      },
    ];
  }
  if (reference.reference_family === "cfr") {
    return [
      {
        label: "eCFR search",
        url: `https://www.ecfr.gov/search?search%5Bquery%5D=${encodedLabel}`,
        source_system: "eCFR",
        expected_capture_method: "ecfr_api_or_html",
      },
    ];
  }
  if (reference.reference_family === "far") {
    return [
      {
        label: "Acquisition.gov FAR",
        url: `https://www.acquisition.gov/search?search_api_fulltext=${encodedLabel}`,
        source_system: "Acquisition.gov",
        expected_capture_method: "official_html_search",
      },
    ];
  }
  if (reference.reference_family === "dfars") {
    return [
      {
        label: "Acquisition.gov DFARS",
        url: `https://www.acquisition.gov/search?search_api_fulltext=${encodedLabel}`,
        source_system: "Acquisition.gov",
        expected_capture_method: "official_html_search",
      },
    ];
  }
  if (reference.reference_family === "nist-sp") {
    return [
      {
        label: "NIST CSRC search",
        url: `https://csrc.nist.gov/search?keywords=${encodedLabel}`,
        source_system: "NIST CSRC",
        expected_capture_method: "official_publication_search",
      },
    ];
  }
  if (["dodi", "dodd"].includes(reference.reference_family)) {
    return [
      {
        label: "DoD issuances",
        url: "https://www.esd.whs.mil/Directives/issuances/",
        source_system: "DoD Issuances",
        expected_capture_method: "official_index_search",
      },
    ];
  }
  if (["secnav", "opnavinst", "navadmin"].includes(reference.reference_family)) {
    return [
      {
        label: "Department of the Navy issuances",
        url: "https://www.secnav.navy.mil/doni/",
        source_system: "DON Issuances",
        expected_capture_method: "official_index_search",
      },
    ];
  }
  return [
    {
      label: "Official source search",
      url: `https://www.google.com/search?q=site%3A.gov%20${encodedLabel}`,
      source_system: "official-web-search",
      expected_capture_method: "analyst_confirmed_source",
    },
  ];
}

function analystNotes(reference, priority) {
  const notes = [`${priority} because ${reference.label} appears ${reference.total_count || reference.count || 0} time(s) across ${(reference.source_artifact_ids || []).length} catalogued artifact(s).`];
  if (reference.priority === "high") notes.push("High-authority family should be catalogued before lower-echelon guidance that depends on it.");
  if ((reference.source_artifact_ids || []).some(id => /ndaa|pl-/.test(id))) notes.push("Appears in NDAA/public law text, so it is a strong candidate for law-layer expansion.");
  return notes;
}

function summarizeByFamily(items) {
  const map = new Map();
  for (const item of items) {
    const row = map.get(item.reference_family) || {
      reference_family: item.reference_family,
      item_count: 0,
      occurrence_count: 0,
      p0_count: 0,
      p1_count: 0,
      p2_count: 0,
      p3_count: 0,
    };
    row.item_count += 1;
    row.occurrence_count += item.occurrence_count;
    row[`${item.queue_priority.toLowerCase()}_count`] += 1;
    map.set(item.reference_family, row);
  }
  return [...map.values()].sort((a, b) => b.occurrence_count - a.occurrence_count || a.reference_family.localeCompare(b.reference_family));
}

function parseReference(reference) {
  const key = reference.suggested_catalog_key || "";
  const label = reference.label || "";
  const usc = key.match(/^usc:(\d+):([a-z0-9.-]+)$/i) || label.match(/^(\d+)\s+U\.?S\.?C\.?\s+(?:§\s*)?([a-z0-9.-]+)/i);
  if (usc) return { title: usc[1], section: usc[2] };
  const cfr = key.match(/^cfr:(\d+):([a-z0-9.-]+)$/i) || label.match(/^(\d+)\s+CFR\s+([a-z0-9.-]+)/i);
  if (cfr) return { title: cfr[1], section: cfr[2] };
  const eo = key.match(/^executive-order:(\d+)$/i) || label.match(/Executive Order\s+(\d+)/i);
  if (eo) return { number: eo[1] };
  const nist = key.match(/^nist-sp:(.+)$/i) || label.match(/NIST\s+SP\s+([0-9.-]+)/i);
  if (nist) return { series: nist[1].replace(/-/g, ".").replace(/^(\d{3})\.(\d+)/, "$1-$2") };
  return {};
}

function renderMarkdown(queue) {
  const lines = [
    "# Reference Ingestion Queue",
    "",
    `Generated: ${queue.generated_at}`,
    "",
    `- Queue items: ${queue.summary.queue_item_count}`,
    `- P0: ${queue.summary.p0_count}`,
    `- P1: ${queue.summary.p1_count}`,
    `- P2: ${queue.summary.p2_count}`,
    `- P3: ${queue.summary.p3_count}`,
    `- Source artifacts with gaps: ${queue.summary.source_artifact_count}`,
    "",
    "## Family Summary",
    "",
    "| Family | Items | Occurrences | P0 | P1 | P2 | P3 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...queue.family_summary.map(item => `| ${item.reference_family} | ${item.item_count} | ${item.occurrence_count} | ${item.p0_count} | ${item.p1_count} | ${item.p2_count} | ${item.p3_count} |`),
    "",
    "## Top Queue Items",
    "",
    "| Rank | Priority | Reference | Occurrences | Sources | Recommended artifact | Capture |",
    "| ---: | --- | --- | ---: | ---: | --- | --- |",
    ...queue.queue_items.slice(0, 100).map(item => `| ${item.queue_rank} | ${item.queue_priority} | ${item.label} | ${item.occurrence_count} | ${item.source_artifact_count} | ${item.recommended_artifact_id} | ${item.capture_strategy} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90) || "reference";
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function writeIfChanged(path, contents) {
  const absolute = join(ROOT, path);
  if (existsSync(absolute) && readFileSync(absolute, "utf8") === contents) return 0;
  if (CHECK) return 1;
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  return 1;
}
