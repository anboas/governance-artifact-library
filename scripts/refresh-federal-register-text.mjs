import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();
const USER_AGENT = "governance-artifact-library-refresh/0.1";

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
];

const manifest = readJson("manifest.json");
let refreshed = 0;

for (const entry of manifest.artifacts) {
  const artifact = readJson(entry.path);
  if (artifact.source_system !== "Federal Register") continue;
  const documentNumber = documentNumberFromFederalRegisterUrl(artifact.source_url);
  if (!documentNumber) throw new Error(`${artifact.id} does not expose a Federal Register document number`);

  const documentApiUrl = `https://www.federalregister.gov/api/v1/documents/${documentNumber}.json`;
  const documentRecord = await fetchJson(documentApiUrl);
  if (!documentRecord.raw_text_url) throw new Error(`${artifact.id} Federal Register API record does not expose raw_text_url`);

  const fetched = await fetchText(documentRecord.raw_text_url);
  const rawText = fetched.text.endsWith("\n") ? fetched.text : `${fetched.text}\n`;
  const extractedText = looksLikeHtml(rawText) ? htmlToText(rawText) : rawText;
  if (!hasMeaningfulSourceText(extractedText)) {
    throw new Error(`${artifact.id} Federal Register API returned an access wall or placeholder`);
  }

  const rawPath = `artifacts/${artifact.id}/raw/source-federal-register.${looksLikeHtml(rawText) ? "html" : "txt"}`;
  const textPath = `artifacts/${artifact.id}/text/extracted-federal-register.txt`;
  await writeFileChecked(rawPath, rawText);
  await writeFileChecked(textPath, extractedText);

  if (artifact.raw_path && artifact.raw_path !== rawPath) await rm(join(ROOT, artifact.raw_path), { force: true });
  if (artifact.extracted_text_path && artifact.extracted_text_path !== textPath) await rm(join(ROOT, artifact.extracted_text_path), { force: true });

  const bytes = Buffer.from(rawText, "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const nextArtifact = {
    ...artifact,
    source_location_type: "federal_register_api",
    source_mime_type: looksLikeHtml(rawText) ? "text/html; charset=utf-8" : (fetched.contentType || "text/plain; charset=utf-8"),
    captured_at: CAPTURED_AT,
    checksum_sha256: checksum,
    raw_path: rawPath,
    extracted_text_path: textPath,
    pipeline_state: "structured",
    mirror_status: "mirrored",
    parser_status: "parsed",
    review_status: "machine_reviewed",
    provenance: {
      ...artifact.provenance,
      source_system: "Federal Register",
      capture_method: "federal_register_api_raw_text",
      capture_notes: `Raw artifact mirrored from official Federal Register API raw_text_url ${documentRecord.raw_text_url}. Human canonical source remains ${artifact.source_url}.`,
      api_record_url: documentApiUrl,
      raw_text_url: documentRecord.raw_text_url,
    },
  };

  const metrics = buildMetrics(nextArtifact, extractedText, bytes);
  await writeJson(entry.path, nextArtifact);
  await writeJson(`artifacts/${artifact.id}/provenance.json`, nextArtifact.provenance);
  await writeJson(nextArtifact.metadata_path, buildMetadata(nextArtifact, metrics, documentRecord));
  await writeJson(nextArtifact.analytics_path, metrics);
  await writeJson(nextArtifact.analysis_path, buildAnalysis(nextArtifact, metrics));
  await writeJson(nextArtifact.structured_json_path, buildSummary(nextArtifact, metrics));
  await writeJson(nextArtifact.version_index_path, buildVersionIndex(nextArtifact, metrics, documentRecord));
  refreshed += 1;
}

if (!refreshed) throw new Error("No Federal Register artifacts found to refresh");
console.log(`Refreshed ${refreshed} Federal Register artifact(s) from official API raw text.`);

function documentNumberFromFederalRegisterUrl(url) {
  return String(url || "").match(/\/(\d{4}-\d{5})(?:\/|$)/)?.[1] || "";
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} fetch failed: ${response.status}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} fetch failed: ${response.status}`);
  return {
    text: await response.text(),
    contentType: response.headers.get("content-type") || "",
  };
}

function buildMetrics(artifact, text, bytes) {
  const normalizedText = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const term_counts = Object.fromEntries(
    TERM_LANES.map(term => [term, countTerm(normalizedText, term)])
  );
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    byte_length: bytes.byteLength,
    extracted_text_chars: text.length,
    extracted_word_count: words.length,
    line_count: text ? text.split(/\n/).length : 0,
    approximate_pages: Math.max(0, Math.round(words.length / 500)),
    term_counts,
    obligation_signal_count: term_counts.shall + term_counts.must,
    implementation_signal_count: term_counts.implementation + term_counts.training + term_counts.deadline,
    analysis_ready: hasMeaningfulSourceText(text),
  };
}

function buildMetadata(artifact, metrics, documentRecord) {
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
      api_record_url: artifact.provenance.api_record_url,
      raw_text_url: artifact.provenance.raw_text_url,
      pdf_url: documentRecord.pdf_url || null,
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

function buildAnalysis(artifact, metrics) {
  const primarySignals = Object.entries(metrics.term_counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    analysis_type: "machine_bootstrap",
    authority_interpretation: {
      authority_level: artifact.authority_level,
      hierarchy_rank: artifact.hierarchy_rank,
      upstream_authority_expected: artifact.hierarchy_rank > 20,
      downstream_guidance_expected: artifact.hierarchy_rank < 90,
    },
    extraction_readiness: {
      obligation_extraction: metrics.obligation_signal_count > 0 ? "candidate" : "needs_review",
      deadline_extraction: metrics.term_counts.deadline > 0 ? "candidate" : "needs_review",
      implementation_extraction: metrics.implementation_signal_count > 0 ? "candidate" : "needs_review",
      blocked_reason: null,
    },
    likely_analytics: artifact.analytic_lanes,
    primary_term_signals: primarySignals,
    review_notes: "Machine bootstrap analysis only. Human review is still required before treating obligations or deadlines as authoritative.",
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

function buildVersionIndex(artifact, metrics, documentRecord) {
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    version_strategy: "source_url_plus_checksum",
    current_version: {
      source_url: artifact.source_url,
      api_record_url: artifact.provenance.api_record_url,
      raw_text_url: artifact.provenance.raw_text_url,
      pdf_url: documentRecord.pdf_url || null,
      source_date: artifact.source_date,
      publication_date: artifact.publication_date,
      effective_date: artifact.effective_date,
      checksum_sha256: artifact.checksum_sha256,
      captured_at: artifact.captured_at,
      extracted_text_chars: metrics.extracted_text_chars,
    },
    versions: [
      {
        version_id: `${artifact.source_date || artifact.publication_date || "undated"}-${artifact.checksum_sha256.slice(0, 12)}`,
        source_url: artifact.source_url,
        checksum_sha256: artifact.checksum_sha256,
        captured_at: artifact.captured_at,
        status: "current",
      },
    ],
  };
}

function countTerm(text, term) {
  return (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

function hasMeaningfulSourceText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length < 100) return false;
  if (normalized.includes("\u0000")) return false;
  if (/Request Access Due to aggressive automated scraping/i.test(normalized)) return false;
  if (/Your request has been flagged as potentially automated/i.test(normalized)) return false;
  if (/complete the CAPTCHA/i.test(normalized)) return false;
  if (/Access Denied|Cloudflare Ray ID|temporarily blocked/i.test(normalized)) return false;
  return true;
}

function looksLikeHtml(value) {
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(String(value || ""));
}

function htmlToText(html) {
  return html
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|tr|h[1-6]|li|pre)>/gi, "\n")
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

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

async function writeJson(path, value) {
  await writeFileChecked(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileChecked(path, contents) {
  const absolute = join(ROOT, path);
  await mkdir(dirname(absolute), { recursive: true });
  if (existsSync(absolute) && readFileSync(absolute, "utf8") === contents) return;
  await writeFile(absolute, contents);
}
