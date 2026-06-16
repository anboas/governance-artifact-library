import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();
const TARGETS_PATH = getArg("--targets") || "data/lower-echelon-cyber-ingest-targets.json";
const DRY_RUN = process.argv.includes("--dry-run");
const FAST_BROWSER_FETCH = "/home/anboas/clawd/scripts/fast_browser_fetch.sh";

const TERM_LANES = [
  "shall",
  "must",
  "may",
  "cyber",
  "zero trust",
  "artificial intelligence",
  "software",
  "acquisition",
  "risk",
  "records",
  "training",
  "deadline",
  "report",
  "implementation",
  "vulnerability",
  "asset",
  "identity",
  "cloud",
];

const DEFAULT_ANALYTIC_LANES = [
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

const manifest = readJson("manifest.json");
const targetPacket = readJson(TARGETS_PATH);
const existingIds = new Set(manifest.artifacts.map((entry) => entry.id));
const additions = [];

for (const target of targetPacket.targets || []) {
  if (existingIds.has(target.id)) {
    console.log(`Skip existing ${target.id}`);
    continue;
  }
  let artifact;
  if (target.capture_mode === "browser_html") {
    artifact = captureBrowserHtml(target);
  } else if (target.capture_mode === "direct_pdf") {
    artifact = await capturePdf(target);
  } else {
    artifact = registerBlocked(target);
  }
  additions.push(artifact);
}

if (DRY_RUN) {
  console.log(`Would add ${additions.length} official source target(s).`);
  for (const { artifact } of additions) {
    console.log(`- ${artifact.id} (${artifact.mirror_status}) ${artifact.source_system}`);
  }
  process.exit(0);
}

for (const addition of additions) writeArtifact(addition);

if (additions.length > 0) {
  manifest.generated_at = CAPTURED_AT;
  manifest.artifacts = [...manifest.artifacts, ...additions.map(({ manifestEntry }) => manifestEntry)]
    .sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.id.localeCompare(b.id));
  manifest.artifact_count = manifest.artifacts.length;
  manifest.taxonomy_summary = buildTaxonomySummary(manifest.artifacts);
  writeJson("manifest.json", manifest);
  rebuildSourceRegistry(manifest);
}

console.log(`Added ${additions.length} official source target(s).`);

function captureBrowserHtml(target) {
  const result = spawnSync(FAST_BROWSER_FETCH, [
    "--engine",
    "chromium",
    "--timeout",
    "35",
    "--quiet-meta",
    target.source_url,
  ], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${target.id} browser fetch failed: ${result.stderr || result.stdout}`);
  }
  const html = result.stdout || "";
  const text = htmlToText(html);
  assertMeaningfulCapture(target, html, text);
  const bytes = Buffer.from(html, "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  return buildAddition(target, {
    capturedAt: CAPTURED_AT,
    checksum,
    rawBytes: bytes,
    rawPath: `artifacts/${target.id}/raw/source.html`,
    text,
    textPath: `artifacts/${target.id}/text/extracted-browser.txt`,
    sourceMimeType: "text/html; charset=utf-8",
    pipelineState: "structured",
    mirrorStatus: "mirrored",
    parserStatus: "parsed",
    reviewStatus: "machine_reviewed",
    captureMethod: "browser_html_fetch",
    captureNotes: "Raw HTML mirrored from the official source with browser-assisted fetch after plain HTTP fetch was denied by edge protection.",
  });
}

async function capturePdf(target) {
  const response = await fetch(target.source_url, {
    headers: {
      "accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      "user-agent": "governance-artifact-library/0.1 (+official-source-corpus)",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`${target.id} PDF fetch failed: HTTP ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  if (bytes.byteLength < 500 || !bytes.subarray(0, 8).toString("utf8").startsWith("%PDF")) {
    throw new Error(`${target.id} did not return a PDF payload`);
  }
  const text = extractPdfText(target, bytes);
  assertMeaningfulCapture(target, "", text);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  return buildAddition(target, {
    capturedAt: CAPTURED_AT,
    checksum,
    rawBytes: bytes,
    rawPath: `artifacts/${target.id}/raw/source.pdf`,
    text,
    textPath: `artifacts/${target.id}/text/extracted-pdf.txt`,
    sourceMimeType: "application/pdf",
    pipelineState: "structured",
    mirrorStatus: "mirrored",
    parserStatus: "parsed",
    reviewStatus: "machine_reviewed",
    captureMethod: "direct_pdf_fetch",
    captureNotes: "Official PDF mirrored from the source URL and text extracted locally with pdftotext.",
  });
}

function extractPdfText(target, bytes) {
  const tempDir = mkdtempSync(join(tmpdir(), "governance-artifact-pdf-"));
  const pdfPath = join(tempDir, "source.pdf");
  try {
    writeFileSync(pdfPath, bytes);
    const result = spawnSync("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 80 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(`${target.id} pdftotext failed: ${result.stderr || result.stdout}`);
    }
    return `${result.stdout.replace(/\r/g, "\n").trim()}\n`;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function registerBlocked(target) {
  return buildAddition(target, {
    capturedAt: null,
    checksum: null,
    rawBytes: null,
    rawPath: null,
    text: "",
    textPath: null,
    sourceMimeType: null,
    pipelineState: "source_known",
    mirrorStatus: "blocked",
    parserStatus: "blocked",
    reviewStatus: "unreviewed",
    captureMethod: "official_source_registration",
    captureNotes: target.blocked_reason || "Official source identified. Automated mirroring is blocked by the source host.",
  });
}

function buildAddition(target, capture) {
  const metadataPath = `artifacts/${target.id}/metadata/metadata.json`;
  const analyticsPath = `artifacts/${target.id}/analytics/document-metrics.json`;
  const analysisPath = `artifacts/${target.id}/analysis/machine-analysis.json`;
  const structuredPath = capture.mirrorStatus === "mirrored" ? `artifacts/${target.id}/structured/summary.json` : null;
  const versionPath = `artifacts/${target.id}/versions/index.json`;
  const artifact = {
    id: target.id,
    title: target.title,
    short_title: target.short_title,
    artifact_type: target.artifact_type,
    domain: "policy",
    authority_level: target.authority_level,
    hierarchy_rank: target.hierarchy_rank,
    family: target.family,
    jurisdiction: target.jurisdiction,
    issuing_authority: target.issuing_authority,
    issuing_organization: target.issuing_organization,
    source_system: target.source_system,
    source_location_type: target.source_location_type,
    source_url: target.source_url,
    source_mime_type: capture.sourceMimeType,
    source_date: target.source_date || null,
    publication_date: target.publication_date || target.source_date || null,
    effective_date: target.effective_date || target.source_date || null,
    captured_at: capture.capturedAt,
    checksum_sha256: capture.checksum,
    raw_path: capture.rawPath,
    extracted_text_path: capture.textPath,
    metadata_path: metadataPath,
    analytics_path: analyticsPath,
    analysis_path: analysisPath,
    structured_json_path: structuredPath,
    version_index_path: versionPath,
    pipeline_state: capture.pipelineState,
    mirror_status: capture.mirrorStatus,
    parser_status: capture.parserStatus,
    review_status: capture.reviewStatus,
    tags: target.tags || [],
    analytic_lanes: DEFAULT_ANALYTIC_LANES,
    relationships: [],
    provenance: {
      source_system: target.source_system,
      capture_method: capture.captureMethod,
      capture_notes: capture.captureNotes,
    },
    extraction_path: `artifacts/${target.id}/extractions/extractions.json`,
    claims_path: `artifacts/${target.id}/claims/claims.json`,
    reference_resolution_path: `artifacts/${target.id}/references/reference-map.json`,
    authority_chain_path: `artifacts/${target.id}/authority/authority-chain.json`,
  };
  const metrics = buildMetrics(target, capture.text, capture.rawBytes);
  return {
    artifact,
    rawBytes: capture.rawBytes,
    rawPath: capture.rawPath,
    text: capture.text,
    textPath: capture.textPath,
    metadata: buildMetadata(target, artifact, metrics),
    metrics,
    analysis: buildAnalysis(target, artifact, metrics),
    summary: structuredPath ? buildSummary(target, artifact, metrics) : null,
    versionIndex: buildVersionIndex(target, artifact, metrics),
    manifestEntry: {
      id: artifact.id,
      path: `artifacts/${artifact.id}/artifact.json`,
      pipeline_state: artifact.pipeline_state,
      mirror_status: artifact.mirror_status,
      authority_level: artifact.authority_level,
      hierarchy_rank: artifact.hierarchy_rank,
      family: artifact.family,
      source_system: artifact.source_system,
    },
  };
}

function writeArtifact(addition) {
  const artifactDir = join(ROOT, "artifacts", addition.artifact.id);
  for (const dir of ["raw", "text", "metadata", "analytics", "analysis", "structured", "versions"]) {
    mkdirSync(join(artifactDir, dir), { recursive: true });
  }
  if (addition.rawPath) writeFileSync(join(ROOT, addition.rawPath), addition.rawBytes);
  if (addition.textPath) writeFileSync(join(ROOT, addition.textPath), addition.text);
  writeJson(`artifacts/${addition.artifact.id}/artifact.json`, addition.artifact);
  writeJson(`artifacts/${addition.artifact.id}/provenance.json`, addition.artifact.provenance);
  writeJson(addition.artifact.metadata_path, addition.metadata);
  writeJson(addition.artifact.analytics_path, addition.metrics);
  writeJson(addition.artifact.analysis_path, addition.analysis);
  if (addition.artifact.structured_json_path) writeJson(addition.artifact.structured_json_path, addition.summary);
  writeJson(addition.artifact.version_index_path, addition.versionIndex);
}

function assertMeaningfulCapture(target, html, text) {
  const normalized = normalizeWhitespace(`${html}\n${text}`);
  if (!hasMeaningfulSourceText(text)) throw new Error(`${target.id} did not produce meaningful source text`);
  if (/LWR\.define|salesforce-lightning-design-system|webruntime|Your browser isn't supported/i.test(normalized)) {
    throw new Error(`${target.id} produced browser application shell instead of document text`);
  }
  if (target.required_terms?.length) {
    const lower = normalized.toLowerCase();
    for (const term of target.required_terms) {
      if (!lower.includes(String(term).toLowerCase())) {
        throw new Error(`${target.id} missing required source term ${term}`);
      }
    }
  }
}

function buildMetrics(target, text, bytes) {
  const normalizedText = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const term_counts = Object.fromEntries(TERM_LANES.map((term) => [term, countTerm(normalizedText, term)]));
  return {
    id: target.id,
    generated_at: CAPTURED_AT,
    byte_length: bytes?.byteLength || 0,
    extracted_text_chars: text.length,
    extracted_word_count: words.length,
    line_count: text ? text.split(/\n/).length : 0,
    approximate_pages: Math.max(0, Math.round(words.length / 500)),
    term_counts,
    obligation_signal_count: term_counts.shall + term_counts.must,
    implementation_signal_count: term_counts.implementation + term_counts.training + term_counts.deadline,
    analysis_ready: text.trim().length > 100,
  };
}

function buildMetadata(target, artifact, metrics) {
  return {
    id: target.id,
    title: target.title,
    short_title: target.short_title,
    artifact_type: target.artifact_type,
    authority_level: target.authority_level,
    hierarchy_rank: target.hierarchy_rank,
    family: target.family,
    jurisdiction: target.jurisdiction,
    issuing_authority: target.issuing_authority,
    issuing_organization: target.issuing_organization,
    source: {
      system: target.source_system,
      location_type: target.source_location_type,
      url: target.source_url,
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
    tags: target.tags || [],
  };
}

function buildAnalysis(target, artifact, metrics) {
  const primarySignals = Object.entries(metrics.term_counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));
  return {
    id: target.id,
    generated_at: CAPTURED_AT,
    analysis_type: "machine_bootstrap",
    authority_interpretation: {
      authority_level: target.authority_level,
      hierarchy_rank: target.hierarchy_rank,
      upstream_authority_expected: target.hierarchy_rank > 20,
      downstream_guidance_expected: target.hierarchy_rank < 90,
    },
    extraction_readiness: {
      obligation_extraction: metrics.obligation_signal_count > 0 ? "candidate" : "needs_review",
      deadline_extraction: metrics.term_counts.deadline > 0 ? "candidate" : "needs_review",
      implementation_extraction: metrics.implementation_signal_count > 0 ? "candidate" : "needs_review",
      blocked_reason: artifact.mirror_status === "blocked" ? artifact.provenance.capture_notes : null,
    },
    likely_analytics: DEFAULT_ANALYTIC_LANES,
    primary_term_signals: primarySignals,
    review_notes: artifact.mirror_status === "blocked"
      ? "Official source is registered but automated raw mirroring is blocked. Re-run with an accepted browser/manual capture before relying on text analytics."
      : "Machine bootstrap analysis only. Human review is still required before treating obligations or deadlines as authoritative.",
  };
}

function buildSummary(target, artifact, metrics) {
  return {
    id: target.id,
    title: target.title,
    short_title: target.short_title,
    artifact_type: target.artifact_type,
    authority_level: target.authority_level,
    hierarchy_rank: target.hierarchy_rank,
    family: target.family,
    jurisdiction: target.jurisdiction,
    issuing_authority: target.issuing_authority,
    issuing_organization: target.issuing_organization,
    source_url: target.source_url,
    source_date: target.source_date || null,
    pipeline_state: artifact.pipeline_state,
    mirror_status: artifact.mirror_status,
    parser_status: artifact.parser_status,
    review_status: artifact.review_status,
    extracted_text_chars: metrics.extracted_text_chars,
    extracted_word_count: metrics.extracted_word_count,
    obligation_signal_count: metrics.obligation_signal_count,
    implementation_signal_count: metrics.implementation_signal_count,
    normalized_fields: [
      "id",
      "title",
      "artifact_type",
      "authority_level",
      "hierarchy_rank",
      "family",
      "jurisdiction",
      "issuing_authority",
      "issuing_organization",
      "source_url",
      "source_date",
      "publication_date",
      "effective_date",
      "pipeline_state",
      "mirror_status",
      "parser_status",
      "review_status",
    ],
  };
}

function buildVersionIndex(target, artifact, metrics) {
  return {
    id: target.id,
    current_version: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
    versions: [
      {
        version_id: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
        source_url: target.source_url,
        source_date: target.source_date || null,
        captured_at: artifact.captured_at,
        checksum_sha256: artifact.checksum_sha256,
        raw_path: artifact.raw_path,
        extracted_text_path: artifact.extracted_text_path,
        byte_length: metrics.byte_length,
        mirror_status: artifact.mirror_status,
      },
    ],
  };
}

function buildTaxonomySummary(entries) {
  const authorityLevels = new Map();
  const families = new Map();
  for (const entry of entries) {
    if (!authorityLevels.has(entry.authority_level)) {
      authorityLevels.set(entry.authority_level, {
        name: entry.authority_level,
        hierarchy_rank: entry.hierarchy_rank,
        artifact_count: 0,
      });
    }
    authorityLevels.get(entry.authority_level).artifact_count += 1;
    families.set(entry.family, (families.get(entry.family) || 0) + 1);
  }
  return {
    authority_levels: [...authorityLevels.values()]
      .sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.name.localeCompare(b.name)),
    families: [...families.entries()]
      .map(([name, artifact_count]) => ({ name, artifact_count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function rebuildSourceRegistry(nextManifest) {
  const sources = new Map();
  for (const entry of nextManifest.artifacts) {
    const artifact = readJson(entry.path);
    if (!sources.has(artifact.source_system)) {
      sources.set(artifact.source_system, {
        name: artifact.source_system,
        artifact_count: 0,
        source_location_types: new Set(),
      });
    }
    const source = sources.get(artifact.source_system);
    source.artifact_count += 1;
    source.source_location_types.add(artifact.source_location_type);
  }
  writeJson("sources/source-registry.json", {
    generated_at: CAPTURED_AT,
    sources: [...sources.values()]
      .map((source) => ({
        name: source.name,
        artifact_count: source.artifact_count,
        source_location_types: [...source.source_location_types].sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
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
  if (normalized.length < 100) return false;
  if (normalized.includes("\u0000")) return false;
  if (/Request Access Due to aggressive automated scraping/i.test(normalized)) return false;
  if (/Your request has been flagged as potentially automated/i.test(normalized)) return false;
  if (/complete the CAPTCHA/i.test(normalized)) return false;
  if (/^Document not Found\b/i.test(normalized)) return false;
  if (/\bDocument not found\b/i.test(normalized)) return false;
  if (normalized.length < 5000 && /Access Denied|Cloudflare Ray ID|temporarily blocked/i.test(normalized)) return false;
  return true;
}

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function countTerm(text, term) {
  if (!text) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length || 0;
}

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function writeJson(path, value) {
  const absolute = join(ROOT, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}
