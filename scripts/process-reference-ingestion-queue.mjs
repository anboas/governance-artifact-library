import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();
const DEFAULT_LIMIT = 5;
const limit = numberArg("--limit", DEFAULT_LIMIT);
const priority = stringArg("--priority", "P0");
const dryRun = process.argv.includes("--dry-run");

const queue = readJson("data/reference-ingestion-queue.json");
const manifest = readJson("manifest.json");
const existingIds = new Set(manifest.artifacts.map(entry => entry.id));
const candidates = queue.queue_items
  .filter(item => item.queue_priority === priority)
  .filter(item => item.reference_family === "usc")
  .filter(item => !existingIds.has(item.recommended_artifact_id))
  .slice(0, limit);

if (!candidates.length) {
  console.log(`No ${priority} U.S. Code queue items are ready for ingestion.`);
  process.exit(0);
}

if (dryRun) {
  console.log(JSON.stringify(candidates.map(item => ({
    queue_rank: item.queue_rank,
    label: item.label,
    recommended_artifact_id: item.recommended_artifact_id,
    source_artifact_ids: item.source_artifact_ids,
  })), null, 2));
  process.exit(0);
}

const newEntries = [];
for (const item of candidates) {
  const parsed = parseUsc(item);
  const sourceUrl = `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${parsed.title}-section${parsed.section}&num=0&edition=prelim`;
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "governance-artifact-library-reference-ingestion/0.1" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${item.recommended_artifact_id} fetch failed: HTTP ${response.status}`);

  const sourceMimeType = response.headers.get("content-type") || "text/html";
  const sourceBytes = Buffer.from(await response.arrayBuffer());
  const checksum = createHash("sha256").update(sourceBytes).digest("hex");
  const extractedText = htmlToText(sourceBytes.toString("utf8"));
  if (!hasMeaningfulSourceText(extractedText)) throw new Error(`${item.recommended_artifact_id} did not produce meaningful source text`);

  const artifactDir = join(ROOT, "artifacts", item.recommended_artifact_id);
  const rawPath = `artifacts/${item.recommended_artifact_id}/raw/source.html`;
  const textPath = `artifacts/${item.recommended_artifact_id}/text/extracted.txt`;
  const metadataPath = `artifacts/${item.recommended_artifact_id}/metadata/metadata.json`;
  const analyticsPath = `artifacts/${item.recommended_artifact_id}/analytics/document-metrics.json`;
  const analysisPath = `artifacts/${item.recommended_artifact_id}/analysis/machine-analysis.json`;
  const structuredPath = `artifacts/${item.recommended_artifact_id}/structured/summary.json`;
  const versionPath = `artifacts/${item.recommended_artifact_id}/versions/index.json`;

  writeFile(rawPath, sourceBytes);
  writeFile(textPath, extractedText);

  const artifact = {
    id: item.recommended_artifact_id,
    title: `${item.recommended_title}: ${titleFromText(extractedText)}`,
    short_title: item.recommended_title,
    artifact_type: "U.S. Code",
    domain: "policy",
    authority_level: "us_code",
    hierarchy_rank: 20,
    family: familyForUsc(parsed),
    jurisdiction: "United States",
    issuing_authority: "Congress",
    issuing_organization: "Office of the Law Revision Counsel",
    source_system: "U.S. Code",
    source_location_type: "us_code_html",
    source_url: sourceUrl,
    source_mime_type: sourceMimeType,
    source_date: null,
    publication_date: null,
    effective_date: null,
    captured_at: CAPTURED_AT,
    checksum_sha256: checksum,
    raw_path: rawPath,
    extracted_text_path: textPath,
    metadata_path: metadataPath,
    analytics_path: analyticsPath,
    analysis_path: analysisPath,
    structured_json_path: structuredPath,
    version_index_path: versionPath,
    pipeline_state: "structured",
    mirror_status: "mirrored",
    parser_status: "parsed",
    review_status: "machine_reviewed",
    tags: ["statute", "us-code", `title-${parsed.title}`, `section-${parsed.section.toLowerCase()}`, "reference-ingestion"],
    analytic_lanes: [
      "authority_lineage",
      "obligation_extraction",
      "deadline_detection",
      "defined_terms",
      "issuing_org_graph",
      "implementation_tasks",
      "supersession_tracking",
      "compliance_evidence",
    ],
    relationships: [],
    provenance: {
      source_system: "U.S. Code",
      capture_method: "reference_ingestion_queue",
      capture_notes: `Processed queue item ${item.id} rank ${item.queue_rank}; referenced by ${item.source_artifact_ids.join(", ")}.`,
    },
  };

  const metrics = buildMetrics(artifact, extractedText, sourceBytes);
  writeJson(`artifacts/${artifact.id}/artifact.json`, artifact);
  writeJson(`artifacts/${artifact.id}/provenance.json`, artifact.provenance);
  writeJson(metadataPath, buildMetadata(artifact, metrics));
  writeJson(analyticsPath, metrics);
  writeJson(analysisPath, buildAnalysis(artifact, metrics, item));
  writeJson(structuredPath, buildSummary(artifact, metrics));
  writeJson(versionPath, buildVersionIndex(artifact, metrics));

  newEntries.push(manifestEntry(artifact));
  console.log(`Ingested ${item.label} -> ${artifact.id}`);
}

const artifacts = [
  ...manifest.artifacts,
  ...newEntries,
].sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.id.localeCompare(b.id));

writeJson("manifest.json", {
  ...manifest,
  generated_at: CAPTURED_AT,
  artifact_count: artifacts.length,
  artifacts,
  taxonomy_summary: buildTaxonomySummary(artifacts),
});
writeJson("sources/source-registry.json", buildSourceRegistry(artifacts));

console.log(`Processed ${newEntries.length} ${priority} reference ingestion queue item(s).`);

function parseUsc(item) {
  const match = item.reference_key?.match(/^usc:(\d+):([a-z0-9.-]+)$/i)
    || item.label.match(/^(\d+)\s+U\.?S\.?C\.?\s+([a-z0-9.-]+)$/i);
  if (!match) throw new Error(`Unable to parse U.S. Code reference ${item.label}`);
  return { title: match[1], section: match[2] };
}

function titleFromText(text) {
  const sectionTitle = text.match(/^\s*\d+\s+USC\s+[\w.-]+:\s+(.+)$/m)?.[1]
    || text.match(/^\s*\d+\s+U\.S\.C\.\s+[\w.-]+:\s+(.+)$/m)?.[1]
    || text.match(/^\s*[\w.-]+\s+USC\s+[\w.-]+:\s+(.+)$/m)?.[1]
    || text.match(/^\s*§\s*[\w.-]+\.\s+(.+)$/m)?.[1]
    || text.match(/^\s*Sec\.\s*[\w.-]+\.\s+(.+)$/mi)?.[1]
    || text.match(/^\s*Section\s+[\w.-]+\.\s+(.+)$/mi)?.[1]
    || "U.S. Code section";
  return normalizeWhitespace(sectionTitle).replace(/\.$/, "");
}

function familyForUsc({ title, section }) {
  const sectionNumber = Number.parseInt(section, 10);
  if (title === "10" && sectionNumber >= 4000 && sectionNumber < 5000) return "defense_acquisition";
  if (title === "10") return "defense_authority";
  if (title === "22") return "foreign_affairs";
  if (title === "42") return "environmental_policy";
  if (title === "44") return "information_policy";
  if (title === "50") return "national_security";
  return `usc_title_${title}`;
}

function buildMetrics(artifact, text, bytes) {
  const normalizedText = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const termCounts = Object.fromEntries(["shall", "must", "may", "cyber", "artificial intelligence", "software", "acquisition", "risk", "deadline", "report", "implementation"].map(term => [term, countTerm(normalizedText, term)]));
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    byte_length: bytes.byteLength,
    extracted_text_chars: text.length,
    extracted_word_count: words.length,
    line_count: text.split(/\n/).length,
    approximate_pages: Math.max(1, Math.round(words.length / 500)),
    term_counts: termCounts,
    obligation_signal_count: termCounts.shall + termCounts.must,
    implementation_signal_count: termCounts.implementation + termCounts.deadline,
    analysis_ready: true,
  };
}

function buildMetadata(artifact, metrics) {
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
      byte_length: metrics.byte_length,
      extracted_text_chars: metrics.extracted_text_chars,
      extracted_word_count: metrics.extracted_word_count,
      approximate_pages: metrics.approximate_pages,
    },
    tags: artifact.tags,
  };
}

function buildAnalysis(artifact, metrics, item) {
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    analysis_type: "reference_ingestion_bootstrap",
    queue_context: {
      queue_item_id: item.id,
      queue_rank: item.queue_rank,
      queue_priority: item.queue_priority,
      occurrence_count: item.occurrence_count,
      source_artifact_ids: item.source_artifact_ids,
    },
    authority_interpretation: {
      authority_level: artifact.authority_level,
      hierarchy_rank: artifact.hierarchy_rank,
      upstream_authority_expected: false,
      downstream_guidance_expected: true,
    },
    extraction_readiness: {
      obligation_extraction: metrics.obligation_signal_count > 0 ? "candidate" : "needs_review",
      implementation_extraction: metrics.implementation_signal_count > 0 ? "candidate" : "needs_review",
      blocked_reason: null,
    },
    review_notes: "Machine bootstrap analysis from reference ingestion queue. Human review is still required before treating obligations as authoritative.",
  };
}

function buildSummary(artifact, metrics) {
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
    source_url: artifact.source_url,
    source_date: artifact.source_date,
    pipeline_state: artifact.pipeline_state,
    mirror_status: artifact.mirror_status,
    parser_status: artifact.parser_status,
    review_status: artifact.review_status,
    extracted_text_chars: metrics.extracted_text_chars,
    extracted_word_count: metrics.extracted_word_count,
    obligation_signal_count: metrics.obligation_signal_count,
    implementation_signal_count: metrics.implementation_signal_count,
    normalized_fields: ["id", "title", "artifact_type", "authority_level", "hierarchy_rank", "family", "jurisdiction", "issuing_authority", "issuing_organization", "source_url", "source_date", "publication_date", "effective_date", "pipeline_state", "mirror_status", "parser_status", "review_status"],
  };
}

function buildVersionIndex(artifact, metrics) {
  return {
    id: artifact.id,
    current_version: `sha256:${artifact.checksum_sha256}`,
    versions: [{
      version_id: `sha256:${artifact.checksum_sha256}`,
      source_url: artifact.source_url,
      source_date: artifact.source_date,
      captured_at: artifact.captured_at,
      checksum_sha256: artifact.checksum_sha256,
      raw_path: artifact.raw_path,
      extracted_text_path: artifact.extracted_text_path,
      byte_length: metrics.byte_length,
      mirror_status: artifact.mirror_status,
    }],
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
    generated_at: CAPTURED_AT,
    sources: [...sources.values()]
      .map(source => ({ ...source, source_location_types: [...source.source_location_types].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function hasMeaningfulSourceText(text) {
  const normalized = normalizeWhitespace(text);
  return normalized.length > 100 && !/Request Access Due to aggressive automated scraping|complete the CAPTCHA|Access Denied|Cloudflare Ray ID/i.test(normalized);
}

function countTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length || 0;
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function stringArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function numberArg(name, fallback) {
  const value = Number.parseInt(stringArg(name, String(fallback)), 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
