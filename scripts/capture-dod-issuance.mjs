import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();
const TERM_LANES = ["shall", "must", "may", "cyber", "software", "acquisition", "risk", "deadline", "report", "implementation", "training", "student", "meal"];

const ids = valuesFor("--id");
const manifest = readJson("manifest.json");
const allMode = process.argv.includes("--all");
const force = process.argv.includes("--force");
const preserveRaw = process.argv.includes("--raw") || (!allMode && !process.argv.includes("--text-only"));
const limit = Number(valueFor("--limit") || 0);
const family = valueFor("--family") || "";
let captured = 0;
const skipped = [];
const failed = [];

if (!ids.length && !allMode) {
  throw new Error("Usage: npm run dod:capture -- --id <artifact-id> [--id <artifact-id>] [--text-only] OR npm run dod:capture -- --all [--family dodi|dodd] [--limit N] [--raw]");
}

const targetIds = allMode ? selectAllIds() : ids;

for (const id of targetIds) {
  try {
    const result = await captureOne(id);
    if (result.status === "captured") captured += 1;
    if (result.status === "skipped") skipped.push(result);
  } catch (error) {
    failed.push({ id, reason: error?.message || String(error) });
    console.warn(`Failed ${id}: ${error?.message || error}`);
    if (!allMode) throw error;
  }
}

manifest.generated_at = CAPTURED_AT;
manifest.artifacts = manifest.artifacts.map(entry => ({ ...entry }));
writeJson("manifest.json", manifest);
writeJson("data/dod-issuance-capture-report.json", {
  generated_at: CAPTURED_AT,
  report_version: "dod-issuance-capture-report-v1",
  mode: allMode ? "batch" : "selected",
  preserve_raw: preserveRaw,
  target_count: targetIds.length,
  captured_count: captured,
  skipped_count: skipped.length,
  failed_count: failed.length,
  skipped,
  failed,
});
console.log(`Captured ${captured} DoD issuance artifact(s); skipped ${skipped.length}; failed ${failed.length}.`);
if (!allMode && failed.length) process.exitCode = 1;

function selectAllIds() {
  const selected = [];
  for (const entry of manifest.artifacts) {
    if (!["dod_instruction", "dod_directive"].includes(entry.family)) continue;
    if (family === "dodi" && entry.family !== "dod_instruction") continue;
    if (family === "dodd" && entry.family !== "dod_directive") continue;
    const artifact = readJson(entry.path);
    if (!force && artifact.extracted_text_path && existsSync(join(ROOT, artifact.extracted_text_path))) {
      skipped.push({ id: entry.id, reason: "already has extracted text" });
      continue;
    }
    selected.push(entry.id);
    if (limit && selected.length >= limit) break;
  }
  return selected;
}

async function captureOne(id) {
  const entry = manifest.artifacts.find(row => row.id === id);
  if (!entry) throw new Error(`Artifact not found in manifest: ${id}`);
  const artifact = readJson(entry.path);
  if (!["dod_instruction", "dod_directive"].includes(artifact.family)) {
    throw new Error(`${id} is not a DoDI/DoDD artifact`);
  }
  if (!force && artifact.extracted_text_path && existsSync(join(ROOT, artifact.extracted_text_path))) {
    return { id, status: "skipped", reason: "already has extracted text" };
  }
  if (artifact.dod_issuance?.certificate_restricted) {
    return { id, status: "skipped", reason: "certificate restricted" };
  }
  if (!artifact.source_url) {
    return { id, status: "skipped", reason: "missing source url" };
  }
  const source = await fetchSource(artifact.source_url);
  const sourceBytes = source.bytes;
  const sourceKind = source.contentType.includes("pdf") ? "pdf" : "html";
  const rawPath = `artifacts/${id}/raw/source.${sourceKind}`;
  const extractionSourcePath = preserveRaw ? rawPath : `artifacts/${id}/raw/.source.tmp.${sourceKind}`;
  const textPath = `artifacts/${id}/text/extracted.txt`;
  const structuredPath = `artifacts/${id}/structured/summary.json`;
  let extractedText = "";

  if (sourceKind === "pdf") {
    await writeFileChecked(extractionSourcePath, sourceBytes);
    extractedText = await extractPdfText(extractionSourcePath);
    if (!preserveRaw) await rm(join(ROOT, extractionSourcePath), { force: true });
  } else {
    if (preserveRaw) await writeFileChecked(extractionSourcePath, sourceBytes);
    extractedText = htmlToText(sourceBytes.toString("utf8"));
  }
  if (!hasMeaningfulSourceText(extractedText)) {
    throw new Error(`${id} did not produce meaningful extracted text`);
  }
  await writeFileChecked(textPath, extractedText);

  const checksum = createHash("sha256").update(sourceBytes).digest("hex");
  const nextArtifact = {
    ...artifact,
    pipeline_state: "structured",
    mirror_status: preserveRaw ? "mirrored" : "queued",
    parser_status: "parsed",
    review_status: "machine_reviewed",
    captured_at: CAPTURED_AT,
    checksum_sha256: checksum,
    raw_path: preserveRaw ? rawPath : artifact.raw_path,
    extracted_text_path: textPath,
    structured_json_path: structuredPath,
    source_mime_type: source.contentType || artifact.source_mime_type,
    provenance: {
      ...(artifact.provenance || {}),
      source_system: artifact.source_system,
      capture_method: preserveRaw ? "direct_pdf_fetch" : "direct_pdf_text_extraction",
      capture_notes: preserveRaw
        ? "Raw PDF mirrored from the official DoD Issuances source URL and text extracted with pdftotext by capture-dod-issuance.mjs."
        : "Official DoD Issuances PDF fetched for text extraction with pdftotext by capture-dod-issuance.mjs. Raw PDF preservation remains queued separately.",
    },
  };

  const metrics = buildMetrics(nextArtifact, extractedText, sourceBytes);
  writeJson(entry.path, nextArtifact);
  writeJson(nextArtifact.metadata_path, buildMetadata(nextArtifact, metrics));
  writeJson(nextArtifact.analytics_path, metrics);
  writeJson(nextArtifact.analysis_path, buildAnalysis(nextArtifact, metrics));
  writeJson(structuredPath, buildStructuredSummary(nextArtifact, metrics));
  writeJson(nextArtifact.version_index_path, buildVersionIndex(nextArtifact, metrics));
  writeJson(`artifacts/${id}/provenance.json`, nextArtifact.provenance);

  entry.pipeline_state = nextArtifact.pipeline_state;
  entry.mirror_status = nextArtifact.mirror_status;
  console.log(`Captured ${id}: ${sourceBytes.byteLength.toLocaleString()} bytes, ${extractedText.length.toLocaleString()} text chars`);
  return { id, status: "captured", bytes: sourceBytes.byteLength, text_chars: extractedText.length, preserve_raw: preserveRaw };
}

function valuesFor(flag) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function valueFor(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

async function fetchSource(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "application/pdf,*/*",
      "referer": "https://www.esd.whs.mil/Directives/issuances/",
      "user-agent": "Mozilla/5.0 governance-artifact-library/1.0",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`Source fetch failed: ${response.status} ${response.statusText} ${url}`);
  const contentType = response.headers.get("content-type") || "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (contentType.includes("pdf") && (bytes.byteLength < 1024 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))) {
    throw new Error(`Fetched source is not a valid PDF: ${url}`);
  }
  if (!contentType.includes("pdf") && !contentType.includes("html") && !looksLikeHtml(bytes.toString("utf8", 0, 200))) {
    throw new Error(`Expected PDF or HTML content type, got ${contentType || "unknown"}`);
  }
  return { bytes, contentType };
}

async function extractPdfText(rawPath) {
  const rawFile = join(ROOT, rawPath);
  const outFile = `${rawFile}.txt`;
  const result = spawnSync("pdftotext", ["-layout", rawFile, outFile], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`pdftotext failed for ${rawPath}: ${result.stderr || result.stdout}`);
  }
  const text = readFileSync(outFile, "utf8").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trimEnd() + "\n";
  await rm(outFile, { force: true });
  if (hasMeaningfulSourceText(text)) return text;
  const ocrText = ocrPdfText(rawFile);
  return hasMeaningfulSourceText(ocrText) ? ocrText : text;
}

function ocrPdfText(rawFile) {
  const ocrDir = `${rawFile}.ocr`;
  rmSyncIfExists(ocrDir);
  mkdirSync(ocrDir, { recursive: true });
  const prefix = join(ocrDir, "page");
  const render = spawnSync("pdftoppm", ["-r", "200", "-png", rawFile, prefix], { encoding: "utf8" });
  if (render.status !== 0) {
    rmSyncIfExists(ocrDir);
    return "";
  }
  const chunks = [];
  for (const file of readdirSync(ocrDir).filter(name => name.endsWith(".png")).sort()) {
    const result = spawnSync("tesseract", [join(ocrDir, file), "stdout", "--psm", "6"], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) chunks.push(result.stdout.trim());
  }
  rmSyncIfExists(ocrDir);
  return chunks.join("\n\n").replace(/\u0000/g, "").replace(/\r\n/g, "\n").trimEnd() + "\n";
}

function rmSyncIfExists(path) {
  if (existsSync(path)) rmSync(path, { recursive: true, force: true });
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

function looksLikeHtml(value) {
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(String(value || ""));
}

function buildMetrics(artifact, text, bytes) {
  const normalizedText = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const term_counts = Object.fromEntries(TERM_LANES.map(term => [term, countTerm(normalizedText, term)]));
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    byte_length: bytes.byteLength,
    extracted_text_chars: text.length,
    extracted_word_count: words.length,
    line_count: text.split(/\n/).length,
    approximate_pages: Math.max(1, Math.round(words.length / 500)),
    term_counts,
    obligation_signal_count: term_counts.shall + term_counts.must,
    implementation_signal_count: term_counts.implementation + term_counts.training + term_counts.deadline,
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
    dod_issuance: artifact.dod_issuance,
    tags: artifact.tags,
  };
}

function buildAnalysis(artifact, metrics) {
  const primarySignals = Object.entries(metrics.term_counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term, count]) => ({ term, count }));
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    analysis_type: "dod_issuance_capture_bootstrap",
    authority_interpretation: {
      authority_level: artifact.authority_level,
      hierarchy_rank: artifact.hierarchy_rank,
      upstream_authority_expected: true,
      downstream_guidance_expected: true,
    },
    extraction_readiness: {
      obligation_extraction: metrics.obligation_signal_count > 0 ? "candidate" : "needs_review",
      deadline_extraction: metrics.term_counts.deadline > 0 ? "candidate" : "needs_review",
      implementation_extraction: metrics.implementation_signal_count > 0 ? "candidate" : "needs_review",
      blocked_reason: null,
    },
    likely_analytics: artifact.analytic_lanes || [],
    primary_term_signals: primarySignals,
    review_notes: "Machine bootstrap analysis from official DoD issuance PDF capture. Human review is still required before treating obligations as authoritative.",
  };
}

function buildStructuredSummary(artifact, metrics) {
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
    publication_date: artifact.publication_date,
    effective_date: artifact.effective_date,
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

function buildVersionIndex(artifact, metrics) {
  return {
    id: artifact.id,
    generated_at: CAPTURED_AT,
    version_strategy: "source_url_plus_checksum",
    current_version: {
      source_url: artifact.source_url,
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

function hasMeaningfulSourceText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length < 100) return false;
  if (normalized.includes("\u0000")) return false;
  if (/Request Access Due to aggressive automated scraping/i.test(normalized)) return false;
  if (/Your request has been flagged as potentially automated/i.test(normalized)) return false;
  if (/complete the CAPTCHA/i.test(normalized)) return false;
  if (normalized.length < 5000 && /Access Denied|Cloudflare Ray ID|temporarily blocked/i.test(normalized)) return false;
  return true;
}

function countTerm(text, term) {
  return (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function writeJson(path, value) {
  writeFileCheckedSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileChecked(path, contents) {
  const absolute = join(ROOT, path);
  await mkdir(dirname(absolute), { recursive: true });
  if (Buffer.isBuffer(contents)) {
    if (existsSync(absolute) && readFileSync(absolute).equals(contents)) return;
    await writeFile(absolute, contents);
    return;
  }
  if (existsSync(absolute) && readFileSync(absolute, "utf8") === contents) return;
  await writeFile(absolute, contents);
}

function writeFileCheckedSync(path, contents) {
  const absolute = join(ROOT, path);
  if (existsSync(absolute) && readFileSync(absolute, "utf8") === contents) return;
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}
