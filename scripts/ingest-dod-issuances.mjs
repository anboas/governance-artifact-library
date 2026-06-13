import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const GENERATED_AT = new Date().toISOString();
const USER_AGENT = "governance-artifact-library-dod-issuance-ingestion/0.1";
const ANALYTIC_LANES = [
  "authority_lineage",
  "obligation_extraction",
  "deadline_detection",
  "defined_terms",
  "issuing_org_graph",
  "implementation_tasks",
  "supersession_tracking",
  "compliance_evidence",
  "entity_reference_concept_extraction",
  "line_annotation",
  "claims_extraction",
  "decision_authority_extraction",
  "reference_resolution",
  "catalog_gap_detection",
  "authority_chain",
  "upstream_downstream_trace",
];

const SOURCES = [
  {
    family: "dodi",
    label: "DoD Instruction",
    artifactType: "DoD Instruction",
    authorityLevel: "defense_department_instruction",
    hierarchyRank: 72,
    pageUrl: "https://www.esd.whs.mil/Directives/issuances/dodi/",
  },
  {
    family: "dodd",
    label: "DoD Directive",
    artifactType: "DoD Directive",
    authorityLevel: "defense_department_directive",
    hierarchyRank: 70,
    pageUrl: "https://www.esd.whs.mil/Directives/issuances/dodd/",
  },
];

const manifest = readJson("manifest.json");
const existingArtifacts = new Map(manifest.artifacts.map(entry => [entry.id, readJson(entry.path)]));
const existingByShortTitle = new Map([...existingArtifacts.values()].map(artifact => [normalizeKey(artifact.short_title), artifact.id]));
const existingBySourceUrl = new Map([...existingArtifacts.values()].map(artifact => [stripQuery(artifact.source_url), artifact.id]));
const catalogRows = [];
const manifestEntries = new Map(manifest.artifacts.map(entry => [entry.id, entry]));

for (const source of SOURCES) {
  const rows = await fetchIssuanceRows(source);
  catalogRows.push(...rows);
  const duplicateLabels = duplicateLabelCounts(rows);
  for (const row of rows) {
    const artifact = buildArtifact(source, row, duplicateLabels);
    const artifactDir = `artifacts/${artifact.id}`;
    writeJson(`${artifactDir}/artifact.json`, artifact);
    writeJson(`${artifactDir}/provenance.json`, artifact.provenance);
    writeJson(artifact.metadata_path, buildMetadata(artifact, row));
    writeJson(artifact.analytics_path, buildAnalytics(artifact));
    writeJson(artifact.analysis_path, buildAnalysis(artifact, row));
    writeJson(artifact.version_index_path, buildVersionIndex(artifact));
    manifestEntries.set(artifact.id, manifestEntry(artifact));
  }
}

const artifacts = [...manifestEntries.values()]
  .sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.id.localeCompare(b.id));
writeJson("manifest.json", {
  ...manifest,
  generated_at: GENERATED_AT,
  artifact_count: artifacts.length,
  artifacts,
  taxonomy_summary: buildTaxonomySummary(artifacts),
});
writeJson("sources/source-registry.json", buildSourceRegistry(artifacts));

const catalog = {
  generated_at: GENERATED_AT,
  catalog_version: "dod-issuances-catalog-v1",
  source_system: "DoW/DoD Issuances",
  source_pages: SOURCES.map(source => source.pageUrl),
  summary: {
    total_count: catalogRows.length,
    dodi_count: catalogRows.filter(row => row.family === "dodi").length,
    dodd_count: catalogRows.filter(row => row.family === "dodd").length,
    public_pdf_count: catalogRows.filter(row => row.source_url.toLowerCase().includes(".pdf")).length,
    certificate_restricted_count: catalogRows.filter(row => row.certificate_restricted).length,
    changed_item_count: catalogRows.filter(row => row.change_number).length,
  },
  rows: catalogRows
    .map(row => ({
      artifact_id: row.artifact_id,
      family: row.family,
      label: row.label,
      subject: row.subject,
      issuance_date: row.issuance_date,
      change_number: row.change_number,
      change_date: row.change_date,
      opr: row.opr,
      source_url: row.source_url,
      certificate_restricted: row.certificate_restricted,
    }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.label.localeCompare(b.label) || a.subject.localeCompare(b.subject)),
};
writeJson("data/dod-issuances-catalog.json", catalog);
writeFile("docs/dod-issuances-catalog.md", renderCatalogMarkdown(catalog));

console.log(`Ingested DoD issuances catalog: ${catalog.summary.dodi_count} DoDI and ${catalog.summary.dodd_count} DoDD records (${catalog.summary.total_count} total).`);

async function fetchIssuanceRows(source) {
  const response = await fetch(source.pageUrl, { headers: { "user-agent": USER_AGENT }, redirect: "follow" });
  if (!response.ok) throw new Error(`${source.pageUrl} failed: HTTP ${response.status}`);
  const html = await response.text();
  const rows = [...html.matchAll(/<tr class="dnnGrid(?:Alt)?Item"[\s\S]*?<\/tr>/g)]
    .map(match => parseRow(source, match[0]))
    .filter(Boolean);
  if (rows.length < 100) throw new Error(`${source.pageUrl} produced only ${rows.length} issuance rows`);
  return rows;
}

function parseRow(source, rowHtml) {
  const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
  const link = cells[0]?.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!link) return null;
  const label = cleanText(link[2]);
  if (!/^Do[DW][ID]\b/i.test(label)) return null;
  const sourceUrl = new URL(decodeHtml(link[1]), source.pageUrl).href;
  const subject = cleanText(cells[2] || "");
  return {
    family: source.family,
    label,
    normalized_label: normalizeKey(label),
    subject,
    issuance_date: toIsoDate(cleanText(cells[1] || "")),
    change_number: cleanText(cells[3] || ""),
    change_date: toIsoDate(cleanText(cells[4] || "")),
    related_memo: cleanText(cells[5] || ""),
    opr: cleanText(cells[6] || ""),
    source_url: sourceUrl,
    source_page_url: source.pageUrl,
    certificate_restricted: /certificate required|CAC required|trouble logging in/i.test(subject + " " + rowHtml),
  };
}

function buildArtifact(source, row, duplicateLabels) {
  const sourceUrlKey = stripQuery(row.source_url);
  const existingId = existingBySourceUrl.get(sourceUrlKey) || existingByShortTitle.get(row.normalized_label);
  const id = existingId || uniqueArtifactId(row, duplicateLabels);
  row.artifact_id = id;
  const previous = existingArtifacts.get(id);
  const metadataPath = `artifacts/${id}/metadata/metadata.json`;
  const analyticsPath = `artifacts/${id}/analytics/document-metrics.json`;
  const analysisPath = `artifacts/${id}/analysis/machine-analysis.json`;
  const versionPath = `artifacts/${id}/versions/index.json`;
  const sourceUrl = row.source_url;
  const title = `${row.label}: ${row.subject || source.label}`;
  const captureState = previous?.mirror_status === "mirrored" ? {
    pipeline_state: previous.pipeline_state,
    mirror_status: previous.mirror_status,
    parser_status: previous.parser_status,
    review_status: previous.review_status,
    captured_at: previous.captured_at,
    checksum_sha256: previous.checksum_sha256,
    raw_path: previous.raw_path,
    extracted_text_path: previous.extracted_text_path,
    structured_json_path: previous.structured_json_path,
    source_mime_type: previous.source_mime_type,
  } : {
    pipeline_state: "source_known",
    mirror_status: previous?.mirror_status === "blocked" ? "blocked" : "queued",
    parser_status: previous?.parser_status === "blocked" ? "blocked" : "not_started",
    review_status: "unreviewed",
    captured_at: null,
    checksum_sha256: null,
    raw_path: null,
    extracted_text_path: null,
    structured_json_path: null,
    source_mime_type: sourceUrl.toLowerCase().includes(".pdf") ? "application/pdf" : null,
  };

  return {
    ...(previous || {}),
    id,
    title,
    short_title: row.label,
    artifact_type: source.artifactType,
    domain: "policy",
    authority_level: source.authorityLevel,
    hierarchy_rank: source.hierarchyRank,
    family: source.family === "dodi" ? "dod_instruction" : "dod_directive",
    jurisdiction: "DoW/DoD",
    issuing_authority: "Secretary of Defense",
    issuing_organization: "Washington Headquarters Services / Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_location_type: "dod_issuances_pdf",
    source_url: sourceUrl,
    source_date: row.issuance_date,
    publication_date: row.issuance_date,
    effective_date: row.issuance_date,
    ...captureState,
    metadata_path: metadataPath,
    analytics_path: analyticsPath,
    analysis_path: analysisPath,
    version_index_path: versionPath,
    tags: unique([...(previous?.tags || []), source.family, "dod-issuance", "exhaustive-ingestion", row.change_number ? "changed" : "current-source-record"]),
    analytic_lanes: unique([...(previous?.analytic_lanes || []), ...ANALYTIC_LANES]),
    relationships: previous?.relationships || [],
    dod_issuance: {
      family: source.family,
      label: row.label,
      subject: row.subject,
      issuance_date: row.issuance_date,
      change_number: row.change_number || null,
      change_date: row.change_date,
      related_memo: row.related_memo || null,
      opr: row.opr || null,
      source_page_url: row.source_page_url,
      certificate_restricted: row.certificate_restricted,
    },
    provenance: {
      source_system: "DoW/DoD Issuances",
      capture_method: captureState.mirror_status === "mirrored" ? previous.provenance?.capture_method || "automated_fetch" : "official_issuance_index_ingestion",
      capture_notes: captureState.mirror_status === "mirrored"
        ? previous.provenance?.capture_notes || "Raw source already mirrored."
        : `Registered from the official ${source.label} index at ${row.source_page_url}. Raw PDF mirroring is queued for batch capture.`,
    },
  };
}

function uniqueArtifactId(row, duplicateLabels) {
  const base = slug(row.label);
  const suffix = duplicateLabels.get(row.normalized_label) > 1 ? `-${slug(row.subject).slice(0, 56)}` : "";
  let id = `${base}${suffix}`;
  let index = 2;
  while (manifestEntries.has(id)) {
    id = `${base}${suffix}-${index}`;
    index += 1;
  }
  return id;
}

function duplicateLabelCounts(rows) {
  const counts = new Map();
  rows.forEach(row => counts.set(row.normalized_label, (counts.get(row.normalized_label) || 0) + 1));
  return counts;
}

function buildMetadata(artifact, row) {
  return {
    id: artifact.id,
    title: artifact.title,
    short_title: artifact.short_title,
    artifact_type: artifact.artifact_type,
    authority_level: artifact.authority_level,
    hierarchy_rank: artifact.hierarchy_rank,
    family: artifact.family,
    jurisdiction: artifact.jurisdiction,
    issuing_authority: artifact.issuing_authority,
    issuing_organization: artifact.issuing_organization,
    source: {
      system: artifact.source_system,
      location_type: artifact.source_location_type,
      url: artifact.source_url,
      mime_type: artifact.source_mime_type,
      checksum_sha256: artifact.checksum_sha256,
      captured_at: artifact.captured_at,
      mirror_status: artifact.mirror_status,
    },
    lifecycle: {
      pipeline_state: artifact.pipeline_state,
      parser_status: artifact.parser_status,
      review_status: artifact.review_status,
    },
    document_shape: {
      byte_length: 0,
      extracted_text_chars: 0,
      extracted_word_count: 0,
      approximate_pages: 0,
    },
    dod_issuance: artifact.dod_issuance,
    tags: artifact.tags,
  };
}

function buildAnalytics(artifact) {
  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    byte_length: 0,
    extracted_text_chars: 0,
    extracted_word_count: 0,
    line_count: 0,
    approximate_pages: 0,
    term_counts: {},
    obligation_signal_count: 0,
    implementation_signal_count: 0,
    analysis_ready: artifact.mirror_status === "mirrored",
  };
}

function buildAnalysis(artifact) {
  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    analysis_type: "dod_issuance_catalog_ingestion",
    authority_interpretation: {
      authority_level: artifact.authority_level,
      hierarchy_rank: artifact.hierarchy_rank,
      upstream_authority_expected: true,
      downstream_guidance_expected: true,
    },
    extraction_readiness: {
      obligation_extraction: artifact.extracted_text_path ? "candidate" : "source_text_queued",
      deadline_extraction: artifact.extracted_text_path ? "candidate" : "source_text_queued",
      implementation_extraction: artifact.extracted_text_path ? "candidate" : "source_text_queued",
      blocked_reason: artifact.mirror_status === "blocked" ? "Official source requires browser/CAC/manual recovery." : null,
    },
    review_notes: "Exhaustive catalog ingestion from official DoD Issuances index. Raw source mirroring and text analytics should be batched separately.",
  };
}

function buildVersionIndex(artifact) {
  return {
    id: artifact.id,
    current_version: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
    versions: [
      {
        version_id: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
        source_url: artifact.source_url,
        source_date: artifact.source_date,
        captured_at: artifact.captured_at,
        checksum_sha256: artifact.checksum_sha256,
        raw_path: artifact.raw_path,
        extracted_text_path: artifact.extracted_text_path,
        byte_length: 0,
        mirror_status: artifact.mirror_status,
      },
    ],
  };
}

function manifestEntry(artifact) {
  return {
    id: artifact.id,
    path: `artifacts/${artifact.id}/artifact.json`,
    pipeline_state: artifact.pipeline_state,
    mirror_status: artifact.mirror_status,
    authority_level: artifact.authority_level,
    hierarchy_rank: artifact.hierarchy_rank,
    family: artifact.family,
    source_system: artifact.source_system,
  };
}

function buildTaxonomySummary(artifacts) {
  const authority = new Map();
  const families = new Map();
  for (const entry of artifacts) {
    const authorityItem = authority.get(entry.authority_level) || { name: entry.authority_level, hierarchy_rank: entry.hierarchy_rank, artifact_count: 0 };
    authorityItem.artifact_count += 1;
    authority.set(entry.authority_level, authorityItem);
    families.set(entry.family, (families.get(entry.family) || 0) + 1);
  }
  return {
    authority_levels: [...authority.values()].sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.name.localeCompare(b.name)),
    families: [...families.entries()].map(([name, artifact_count]) => ({ name, artifact_count })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function buildSourceRegistry(artifacts) {
  const sources = new Map();
  for (const entry of artifacts) {
    const artifact = readJson(entry.path);
    const source = sources.get(artifact.source_system) || { name: artifact.source_system, artifact_count: 0, source_location_types: new Set() };
    source.artifact_count += 1;
    source.source_location_types.add(artifact.source_location_type);
    sources.set(source.name, source);
  }
  return {
    generated_at: GENERATED_AT,
    sources: [...sources.values()]
      .map(source => ({ ...source, source_location_types: [...source.source_location_types].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function renderCatalogMarkdown(catalog) {
  const lines = [
    "# DoD Issuances Catalog",
    "",
    `Generated: ${catalog.generated_at}`,
    "",
    `- Total DoDI/DoDD page records: ${catalog.summary.total_count}`,
    `- DoDI page records: ${catalog.summary.dodi_count}`,
    `- DoDD page records: ${catalog.summary.dodd_count}`,
    `- Public PDF links: ${catalog.summary.public_pdf_count}`,
    `- Certificate-restricted records: ${catalog.summary.certificate_restricted_count}`,
    "",
    "## Source Pages",
    "",
    ...catalog.source_pages.map(url => `- ${url}`),
    "",
    "## Sample Records",
    "",
    "| Family | Label | Subject | Issuance Date | Change | OPR | Artifact |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...catalog.rows.slice(0, 120).map(row => `| ${row.family} | ${row.label} | ${escapeCell(row.subject)} | ${row.issuance_date || ""} | ${escapeCell(row.change_number || "")} | ${escapeCell(row.opr || "")} | ${row.artifact_id} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function cleanText(html) {
  return decodeHtml(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().replace(/^&nbsp;$/i, "");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/%20/g, " ");
}

function toIsoDate(value) {
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return text;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function stripQuery(url) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.toLowerCase();
  } catch {
    return String(url || "").toLowerCase();
  }
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function slug(value) {
  return normalizeKey(value).replace(/\s+/g, "-").slice(0, 110).replace(/^-|-$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeCell(value) {
  return String(value || "").replace(/\|/g, "\\|");
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function writeJson(path, value) {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(path, contents) {
  const absolute = join(ROOT, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}
