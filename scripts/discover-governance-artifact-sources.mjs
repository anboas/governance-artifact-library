import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const queue = readJson("data/reference-ingestion-queue.json");
const manifest = readJson("manifest.json");
const sourceRegistry = readJson("sources/source-discovery-registry.json");
const generatedAt = queue.generated_at || manifest.generated_at;

const artifacts = manifest.artifacts.map((entry) => ({ ...entry, artifact: readJson(entry.path) }));
const artifactsById = new Map(artifacts.map((entry) => [entry.id, entry.artifact]));
const artifactNumberIndex = buildArtifactNumberIndex(artifacts.map((entry) => entry.artifact));
const sourceByName = new Map(sourceRegistry.sources.map((source) => [source.name, source]));

const candidates = queue.queue_items.map((item) => {
  const sourceCandidates = sourceCandidatesFor(item);
  const catalogMatch = artifactsById.get(item.recommended_artifact_id) || artifactNumberIndex.get(referenceNumberKey(item)) || null;
  const sourceSystems = [...new Set(sourceCandidates.map((source) => source.source_system).filter(Boolean))];
  const exactSourceCount = sourceCandidates.filter((source) => source.confidence === "exact" || source.confidence === "strong").length;
  return {
    id: item.id,
    queue_rank: item.queue_rank,
    queue_priority: item.queue_priority,
    label: item.label,
    reference_key: item.reference_key,
    reference_family: item.reference_family,
    reference_type: item.reference_type,
    authority_tier: item.authority_tier,
    recommended_artifact_id: item.recommended_artifact_id,
    recommended_source_system: item.recommended_source_system,
    occurrence_count: item.occurrence_count,
    source_artifact_count: item.source_artifact_count,
    source_artifact_ids: item.source_artifact_ids,
    discovery_status: catalogMatch ? "catalog_match" : exactSourceCount ? "source_discovered" : sourceCandidates.length ? "source_candidate" : "needs_source_discovery",
    catalog_match: catalogMatch ? {
      id: catalogMatch.id,
      title: catalogMatch.title,
      source_url: catalogMatch.source_url || null,
      source_system: catalogMatch.source_system || null,
      mirror_status: catalogMatch.mirror_status || null,
      pipeline_state: catalogMatch.pipeline_state || null,
    } : null,
    source_systems: sourceSystems,
    source_candidates: sourceCandidates,
    next_action: nextAction(item, catalogMatch, sourceCandidates),
  };
});

const totals = {
  candidate_count: candidates.length,
  catalog_matched: count(candidates, (item) => item.discovery_status === "catalog_match"),
  source_discovered: count(candidates, (item) => item.discovery_status === "source_discovered"),
  source_candidates: count(candidates, (item) => item.discovery_status === "source_candidate"),
  needs_source_discovery: count(candidates, (item) => item.discovery_status === "needs_source_discovery"),
  p0_count: count(candidates, (item) => item.queue_priority === "P0"),
  p1_count: count(candidates, (item) => item.queue_priority === "P1"),
  exact_or_strong_source_count: count(candidates, (item) => item.source_candidates.some((source) => source.confidence === "exact" || source.confidence === "strong")),
  official_source_systems: new Set(candidates.flatMap((item) => item.source_systems)).size,
};

const byFamily = groupRows(candidates, (item) => item.reference_family, "reference_family");
const bySourceSystem = groupRows(candidates.flatMap((item) => item.source_systems.map((sourceSystem) => ({ ...item, sourceSystem }))), (item) => item.sourceSystem, "source_system");
const priorityRows = candidates
  .filter((item) => item.queue_priority === "P0")
  .slice(0, 75)
  .map((item) => ({
    queue_rank: item.queue_rank,
    label: item.label,
    reference_family: item.reference_family,
    discovery_status: item.discovery_status,
    recommended_artifact_id: item.recommended_artifact_id,
    top_source: item.source_candidates[0] || null,
    next_action: item.next_action,
  }));

const model = {
  generated_at: generatedAt,
  discovery_version: "governance-artifact-source-discovery-v1",
  summary: totals,
  by_family: byFamily,
  by_source_system: bySourceSystem,
  priority_candidates: priorityRows,
  candidates,
};

await writeOrCheck("data/governance-artifact-source-discovery.json", `${JSON.stringify(model, null, 2)}\n`);
await writeOrCheck("docs/governance-artifact-source-discovery.md", renderMarkdown(model));

console.log(
  `Governance artifact source discovery ${CHECK_ONLY ? "checked" : "generated"}: ${totals.candidate_count} candidates, ${totals.catalog_matched} catalog matches, ${totals.exact_or_strong_source_count} exact/strong source paths.`
);

function sourceCandidatesFor(item) {
  const parsed = parseReference(item);
  const out = [];
  const add = (source) => {
    if (!source?.url) return;
    const key = `${source.label}|${source.url}`;
    if (out.some((existing) => `${existing.label}|${existing.url}` === key)) return;
    out.push(source);
  };

  if (item.reference_family === "public-law" && parsed.congress && parsed.number) {
    const packageId = `PLAW-${parsed.congress}publ${parsed.number}`;
    add(sourceRow("GovInfo PDF", "GovInfo", "govinfo_public_law_pdf", `https://www.govinfo.gov/content/pkg/${packageId}/pdf/${packageId}.pdf`, "exact", "Deterministic GovInfo public-law package PDF URL.", { apiKeyRequired: false }));
    add(sourceRow("GovInfo package", "GovInfo", "govinfo_public_law_pdf", `https://www.govinfo.gov/app/details/${packageId}`, "exact", "Deterministic GovInfo package landing page.", { apiKeyRequired: false }));
    add(sourceRow("Congress.gov law page", "Congress.gov", "congress_gov_html", `https://www.congress.gov/public-laws/${parsed.congress}th-congress`, "strong", "Congress public-law browse page for this Congress.", { apiKeyRequired: false }));
  }

  if (item.reference_family === "executive-order" && parsed.number) {
    const term = encodeURIComponent(`Executive Order ${parsed.number}`);
    add(sourceRow("Federal Register API search", "Federal Register", "federal_register_api", `https://www.federalregister.gov/api/v1/documents?conditions%5Bterm%5D=${term}&conditions%5Btype%5D=PRESDOCU&per_page=20`, "strong", "Federal Register keyless API search for presidential documents."));
    add(sourceRow("Federal Register web search", "Federal Register", "federal_register_html", `https://www.federalregister.gov/documents/search?conditions%5Bterm%5D=${term}&conditions%5Btype%5D=PRESDOCU`, "strong", "Federal Register presidential-document search."));
  }

  if (item.reference_family === "usc" && parsed.title && parsed.section) {
    add(sourceRow("OLRC HTML", "U.S. Code", "us_code_html", `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${parsed.title}-section${parsed.section}&num=0&edition=prelim`, "exact", "Deterministic OLRC prelim U.S. Code section URL."));
    add(sourceRow("OLRC search", "U.S. Code", "us_code_html", `https://uscode.house.gov/search/criteria.shtml`, "candidate", "OLRC search fallback for edge-case section formats."));
  }

  if (item.reference_family === "dodi" || item.reference_family === "dodd") {
    add(sourceRow("DoD Issuances search", "DoW/DoD Issuances", "dod_issuances_pdf", "https://www.esd.whs.mil/DD/DoD-Issuances/", "strong", "Official WHS/ESD issuance index for DoD directives and instructions."));
  }

  if (item.reference_family === "nist-sp" && parsed.series) {
    const term = encodeURIComponent(`NIST SP ${parsed.series}`);
    add(sourceRow("NIST CSRC search", "NIST CSRC", "nist_csrc_html", `https://csrc.nist.gov/search?searchtext=${term}`, "strong", "NIST CSRC publication search."));
    add(sourceRow("NIST publications search", "NIST NVL Publications", "nist_nvlpubs_pdf", `https://www.nist.gov/publications/search?k=${term}`, "candidate", "NIST publications search fallback."));
  }

  if (item.reference_family === "omb-memo") {
    const term = encodeURIComponent(item.label);
    add(sourceRow("OMB memoranda", "OMB", "white_house_html", "https://www.whitehouse.gov/omb/information-for-agencies/memoranda/", "strong", "OMB memoranda index."));
    add(sourceRow("White House search", "White House", "white_house_html", `https://www.whitehouse.gov/?s=${term}`, "candidate", "White House search for hosted OMB memoranda."));
  }

  if (item.reference_family === "cfr" && parsed.title) {
    add(sourceRow("eCFR title", "eCFR", "ecfr_html", `https://www.ecfr.gov/current/title-${parsed.title}`, "strong", "Current eCFR title landing page."));
    add(sourceRow("eCFR API", "eCFR", "ecfr_api", `https://www.ecfr.gov/api/versioner/v1/full/current/title-${parsed.title}.xml`, "strong", "Current eCFR XML API for the title."));
  }

  if (item.reference_family === "far") {
    const term = encodeURIComponent(item.label);
    add(sourceRow("Acquisition.gov FAR search", "Acquisition.gov", "acquisition_gov_html", `https://www.acquisition.gov/search?search_api_fulltext=${term}`, "strong", "Acquisition.gov FAR search."));
  }

  if (item.reference_family === "dfars") {
    const term = encodeURIComponent(item.label);
    add(sourceRow("Acquisition.gov DFARS search", "Acquisition.gov", "acquisition_gov_html", `https://www.acquisition.gov/search?search_api_fulltext=${term}`, "strong", "Acquisition.gov DFARS search."));
  }

  if (item.reference_family === "secnav") {
    add(sourceRow("DON Issuances", "Department of the Navy Issuances", "don_issuances_pdf", "https://www.secnav.navy.mil/doni/default.aspx", "strong", "Official DON Issuances index for SECNAV material."));
  }

  if (item.reference_family === "opnavinst") {
    add(sourceRow("DON Issuances", "Department of the Navy Issuances", "don_issuances_pdf", "https://www.secnav.navy.mil/doni/default.aspx", "strong", "Official DON Issuances index for OPNAV instructions."));
  }

  for (const existing of item.official_source_candidates || []) {
    const inheritedSystem = existing.source_system || item.recommended_source_system || "";
    const inheritedUrl = existing.url || "";
    const isGenericSearch = /official-web-search|google/i.test(`${inheritedSystem} ${inheritedUrl}`);
    const normalizedInheritedSystem = normalizeSourceSystem(inheritedSystem);
    const inheritedConfidence = existing.expected_capture_method === "official_index_search" ? "candidate" : "weak";
    const hasStrongerSameSystem = out.some(
      (source) => source.source_system === normalizedInheritedSystem && (source.confidence === "exact" || source.confidence === "strong")
    );
    if (isGenericSearch && out.some((source) => source.confidence === "exact" || source.confidence === "strong")) continue;
    if (hasStrongerSameSystem && inheritedConfidence === "weak") continue;
    add({
      label: existing.label || "Existing source candidate",
      source_system: normalizedInheritedSystem,
      source_location_type: sourceLocationForSystem(inheritedSystem),
      url: existing.url,
      confidence: inheritedConfidence,
      capture_method: existing.expected_capture_method || "source_discovery",
      notes: "Candidate inherited from reference ingestion queue.",
    });
  }

  return out;
}

function parseReference(item) {
  const key = item.reference_key || "";
  const label = item.label || "";
  let match = key.match(/^public-law:(\d+)-(\d+)$/i) || label.match(/Public Law\s+(\d+)-(\d+)/i);
  if (match) return { congress: match[1], number: match[2] };
  match = key.match(/^executive-order:(\d+)$/i) || label.match(/Executive Order\s+(\d+)/i);
  if (match) return { number: match[1] };
  match = key.match(/^usc:(\d+):([a-z0-9.-]+)$/i) || label.match(/^(\d+)\s+U\.?S\.?C\.?\s+([a-z0-9.-]+)/i);
  if (match) return { title: match[1], section: match[2] };
  match = key.match(/^nist-sp:([0-9a-z.-]+)$/i) || label.match(/NIST\s+SP\s+([0-9a-z.-]+)/i);
  if (match) return { series: match[1] };
  match = key.match(/^cfr:(\d+)\s+cfr/i) || label.match(/^(\d+)\s+CFR/i);
  if (match) return { title: match[1] };
  return {};
}

function sourceRow(label, sourceSystem, sourceLocationType, url, confidence, notes, options = {}) {
  const source = sourceByName.get(sourceSystem);
  return {
    label,
    source_system: sourceSystem,
    source_owner: source?.source_owner || null,
    source_location_type: sourceLocationType,
    url,
    confidence,
    capture_method: source?.capture_strategies?.[0] || "source_discovery",
    automation_status: source?.automation_status || "needs_probe",
    api_key_required: options.apiKeyRequired ?? Boolean(source?.api_key_required),
    notes,
  };
}

function normalizeSourceSystem(value = "") {
  if (/dod issuances/i.test(value)) return "DoW/DoD Issuances";
  if (/^don issuances$/i.test(value)) return "Department of the Navy Issuances";
  if (/official source/i.test(value)) return "Official Source";
  return value || "Unknown";
}

function sourceLocationForSystem(value = "") {
  if (/dod/i.test(value)) return "dod_issuances_pdf";
  if (/federal register/i.test(value)) return "federal_register_html";
  if (/u\.?s\.? code|olrc/i.test(value)) return "us_code_html";
  if (/govinfo/i.test(value)) return "govinfo_public_law_pdf";
  return "source_discovery";
}

function referenceNumberKey(item) {
  const key = item.reference_key || "";
  const match = key.match(/^(dodi|dodd):([0-9.]+)/i);
  if (match) return `${match[1].toLowerCase()}:${match[2]}`;
  return "";
}

function buildArtifactNumberIndex(rows) {
  const index = new Map();
  for (const artifact of rows) {
    const label = `${artifact.id || ""} ${artifact.short_title || ""} ${artifact.title || ""}`;
    const match = label.match(/\b(DoDI|DoDD|DoWI|DoWD)\s+([0-9.]+)/i) || label.match(/\b(do[dw]i|do[dw]d)-([0-9-]+)/i);
    if (!match) continue;
    const family = match[1].toLowerCase().replace("dowd", "dodd").replace("dowi", "dodi");
    const number = match[2].replace(/-/g, ".");
    const key = `${family}:${number}`;
    if (!index.has(key)) index.set(key, artifact);
  }
  return index;
}

function nextAction(item, catalogMatch, sources) {
  if (catalogMatch?.extracted_text_path && catalogMatch?.claims_path && catalogMatch?.authority_chain_path) return "Already catalogued and analyzed; review references for alias cleanup.";
  if (catalogMatch) return "Open the catalogued artifact and complete missing source/text/analysis sidecars.";
  if (sources.some((source) => source.confidence === "exact")) return "Capture exact official source URL, mirror raw source, extract text, and regenerate analytics.";
  if (sources.some((source) => source.confidence === "strong")) return "Open strong official source surface, resolve exact document URL, then capture.";
  return "Research official source manually and add a stronger source candidate.";
}

function groupRows(items, selector, keyName) {
  const groups = new Map();
  for (const item of items) {
    const key = selector(item) || "unknown";
    const group = groups.get(key) || {
      [keyName]: key,
      candidate_count: 0,
      p0_count: 0,
      catalog_matched: 0,
      source_discovered: 0,
      source_candidates: 0,
      needs_source_discovery: 0,
      occurrence_count: 0,
    };
    group.candidate_count += 1;
    if (item.queue_priority === "P0") group.p0_count += 1;
    if (item.discovery_status === "catalog_match") group.catalog_matched += 1;
    if (item.discovery_status === "source_discovered") group.source_discovered += 1;
    if (item.discovery_status === "source_candidate") group.source_candidates += 1;
    if (item.discovery_status === "needs_source_discovery") group.needs_source_discovery += 1;
    group.occurrence_count += item.occurrence_count || 0;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.p0_count - a.p0_count || b.candidate_count - a.candidate_count || String(a[keyName]).localeCompare(String(b[keyName])));
}

function renderMarkdown(model) {
  const lines = [
    "# Governance Artifact Source Discovery",
    "",
    "Generated from `data/reference-ingestion-queue.json`, `manifest.json`, and `sources/source-discovery-registry.json`.",
    "",
    "## Summary",
    "",
    `- Known candidates: ${model.summary.candidate_count}`,
    `- Catalog matches: ${model.summary.catalog_matched}`,
    `- Source discovered: ${model.summary.source_discovered}`,
    `- Source candidates: ${model.summary.source_candidates}`,
    `- Needs source discovery: ${model.summary.needs_source_discovery}`,
    `- P0 candidates: ${model.summary.p0_count}`,
    `- Exact or strong source paths: ${model.summary.exact_or_strong_source_count}`,
    `- Official source systems represented: ${model.summary.official_source_systems}`,
    "",
    "## Candidate Families",
    "",
    "| Family | Candidates | P0 | Catalog Matches | Source Discovered | Source Candidates | Needs Discovery | Occurrences |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...model.by_family.map((row) => `| ${row.reference_family} | ${row.candidate_count} | ${row.p0_count} | ${row.catalog_matched} | ${row.source_discovered} | ${row.source_candidates} | ${row.needs_source_discovery} | ${row.occurrence_count} |`),
    "",
    "## Source Systems",
    "",
    "| Source System | Candidates | P0 | Catalog Matches | Source Discovered | Source Candidates | Needs Discovery | Occurrences |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...model.by_source_system.map((row) => `| ${row.source_system} | ${row.candidate_count} | ${row.p0_count} | ${row.catalog_matched} | ${row.source_discovered} | ${row.source_candidates} | ${row.needs_source_discovery} | ${row.occurrence_count} |`),
    "",
    "## Top Priority Candidates",
    "",
    "| Rank | Candidate | Family | Status | Recommended Artifact | Top Source | Next Action |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
    ...model.priority_candidates.map((row) => `| ${row.queue_rank} | ${row.label} | ${row.reference_family} | ${row.discovery_status} | ${row.recommended_artifact_id} | ${row.top_source ? `[${row.top_source.label}](${row.top_source.url})` : "none"} | ${row.next_action} |`),
    "",
  ];
  return `${lines.join("\n")}`;
}

function count(items, predicate) {
  return items.filter(predicate).length;
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run discover:sources`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
