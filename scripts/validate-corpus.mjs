import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const manifest = readJson("manifest.json");

assert.equal(Array.isArray(manifest.artifacts), true, "manifest.artifacts must be an array");
assert.equal(manifest.artifact_count, manifest.artifacts.length, "manifest artifact count must match artifacts");
assert.ok(manifest.artifact_count >= 10, "seed corpus should include mirrored and queued official artifacts");
assert.ok(manifest.taxonomy_summary?.authority_levels?.length >= 6, "manifest should summarize authority taxonomy");

let mirrored = 0;
let blocked = 0;
let publicLaws = 0;
let operationalGuidance = 0;

for (const entry of manifest.artifacts) {
  assert.ok(entry.id, "artifact manifest entry needs id");
  assert.ok(entry.path, `${entry.id} needs path`);
  const artifact = readJson(entry.path);
  assert.equal(artifact.id, entry.id, `${entry.id} id mismatch`);
  assert.equal(artifact.domain, "policy", `${entry.id} should stay in policy domain`);
  assert.ok(artifact.title, `${entry.id} needs title`);
  assert.ok(artifact.artifact_type, `${entry.id} needs artifact_type`);
  assert.ok(artifact.authority_level, `${entry.id} needs authority_level`);
  assert.ok(Number.isInteger(artifact.hierarchy_rank), `${entry.id} needs integer hierarchy_rank`);
  assert.ok(artifact.family, `${entry.id} needs family`);
  assert.ok(artifact.jurisdiction, `${entry.id} needs jurisdiction`);
  assert.ok(artifact.issuing_authority, `${entry.id} needs issuing_authority`);
  assert.ok(artifact.issuing_organization, `${entry.id} needs issuing_organization`);
  assert.ok(artifact.source_system, `${entry.id} needs source_system`);
  assert.ok(artifact.source_location_type, `${entry.id} needs source_location_type`);
  assert.ok(artifact.source_url?.startsWith("https://"), `${entry.id} needs https source_url`);
  assert.ok(["source_known", "mirrored", "text_extracted", "normalized", "structured", "reviewed"].includes(artifact.pipeline_state), `${entry.id} invalid pipeline_state`);
  assert.ok(["mirrored", "blocked", "queued", "retired"].includes(artifact.mirror_status), `${entry.id} invalid mirror_status`);
  assert.ok(["not_started", "blocked", "parsed", "partial", "failed"].includes(artifact.parser_status), `${entry.id} invalid parser_status`);
  assert.ok(["unreviewed", "machine_reviewed", "analyst_review_needed", "analyst_reviewed"].includes(artifact.review_status), `${entry.id} invalid review_status`);
  assert.equal(existsSync(join(ROOT, "artifacts", artifact.id, "provenance.json")), true, `${entry.id} needs provenance.json`);
  assertSidecar(artifact, "metadata_path", "metadata sidecar");
  assertSidecar(artifact, "analytics_path", "analytics sidecar");
  assertSidecar(artifact, "analysis_path", "analysis sidecar");
  assertSidecar(artifact, "extraction_path", "entity/reference/concept extraction sidecar");
  assertSidecar(artifact, "claims_path", "claims sidecar");
  assertSidecar(artifact, "reference_resolution_path", "reference resolution sidecar");
  assertSidecar(artifact, "authority_chain_path", "authority chain sidecar");
  assertSidecar(artifact, "version_index_path", "version index");

  const metadata = readJson(artifact.metadata_path);
  const analytics = readJson(artifact.analytics_path);
  const analysis = readJson(artifact.analysis_path);
  const extractions = readJson(artifact.extraction_path);
  const claims = readJson(artifact.claims_path);
  const referenceResolution = readJson(artifact.reference_resolution_path);
  const authorityChain = readJson(artifact.authority_chain_path);
  const versions = readJson(artifact.version_index_path);
  assert.equal(metadata.id, artifact.id, `${entry.id} metadata id mismatch`);
  assert.equal(analytics.id, artifact.id, `${entry.id} analytics id mismatch`);
  assert.equal(analysis.id, artifact.id, `${entry.id} analysis id mismatch`);
  assert.equal(extractions.id, artifact.id, `${entry.id} extraction id mismatch`);
  assert.equal(claims.id, artifact.id, `${entry.id} claims id mismatch`);
  assert.equal(referenceResolution.id, artifact.id, `${entry.id} reference resolution id mismatch`);
  assert.equal(authorityChain.id, artifact.id, `${entry.id} authority chain id mismatch`);
  assert.equal(versions.id, artifact.id, `${entry.id} version index id mismatch`);
  assert.equal(Array.isArray(versions.versions), true, `${entry.id} versions must be an array`);
  assert.ok(artifact.analytic_lanes?.includes("obligation_extraction"), `${entry.id} should declare analytic lanes`);
  assert.ok(artifact.analytic_lanes?.includes("entity_reference_concept_extraction"), `${entry.id} should declare entity/reference/concept extraction lane`);
  assert.ok(artifact.analytic_lanes?.includes("claims_extraction"), `${entry.id} should declare claims extraction lane`);
  assert.ok(artifact.analytic_lanes?.includes("reference_resolution"), `${entry.id} should declare reference resolution lane`);
  assert.ok(artifact.analytic_lanes?.includes("authority_chain"), `${entry.id} should declare authority chain lane`);
  assert.equal(Array.isArray(extractions.entities), true, `${entry.id} extraction entities must be an array`);
  assert.equal(Array.isArray(extractions.references), true, `${entry.id} extraction references must be an array`);
  assert.equal(Array.isArray(extractions.concepts), true, `${entry.id} extraction concepts must be an array`);
  assert.equal(Array.isArray(extractions.line_annotations), true, `${entry.id} extraction line_annotations must be an array`);
  assert.equal(Array.isArray(claims.claims), true, `${entry.id} claims must be an array`);
  assert.equal(Array.isArray(referenceResolution.resolved_references), true, `${entry.id} resolved references must be an array`);
  assert.equal(Array.isArray(referenceResolution.uncatalogued_references), true, `${entry.id} uncatalogued references must be an array`);
  assert.equal(Array.isArray(authorityChain.nodes), true, `${entry.id} authority chain nodes must be an array`);
  assert.equal(Array.isArray(authorityChain.upstream_edges), true, `${entry.id} authority chain upstream_edges must be an array`);
  assert.equal(Array.isArray(authorityChain.downstream_edges), true, `${entry.id} authority chain downstream_edges must be an array`);
  assert.ok(authorityChain.summary?.authority_path_status, `${entry.id} authority chain needs path status`);

  if (artifact.mirror_status === "mirrored") {
    mirrored += 1;
    assert.ok(artifact.raw_path, `${entry.id} mirrored artifact needs raw_path`);
    assert.ok(artifact.extracted_text_path, `${entry.id} mirrored artifact needs extracted_text_path`);
    assert.ok(artifact.structured_json_path, `${entry.id} mirrored artifact needs structured_json_path`);
    assert.equal(existsSync(join(ROOT, artifact.raw_path)), true, `${entry.id} raw file missing`);
    assert.equal(existsSync(join(ROOT, artifact.extracted_text_path)), true, `${entry.id} extracted text missing`);
    assert.equal(existsSync(join(ROOT, artifact.structured_json_path)), true, `${entry.id} structured summary missing`);
    const checksum = createHash("sha256").update(readFileSync(join(ROOT, artifact.raw_path))).digest("hex");
    assert.equal(checksum, artifact.checksum_sha256, `${entry.id} raw checksum mismatch`);
    const extractedText = readFileSync(join(ROOT, artifact.extracted_text_path), "utf8");
    assert.ok(extractedText.trim().length > 100, `${entry.id} extracted text should be non-empty`);
    assert.equal(extractedText.includes("\u0000"), false, `${entry.id} extracted text should not contain NUL/control padding`);
    assert.equal(hasMeaningfulSourceText(extractedText), true, `${entry.id} mirrored artifact captured an access wall or placeholder instead of source text`);
    assert.equal(extractions.extraction_status, "parsed", `${entry.id} mirrored artifact should expose parsed extraction status`);
    assert.ok(extractions.summary?.annotated_line_count > 0, `${entry.id} should have line annotations`);
    assert.equal(claims.claims_status, "parsed", `${entry.id} claims should be parsed when extraction text is parsed`);
    assert.ok(claims.summary?.claim_count > 0, `${entry.id} should have extracted claim candidates`);
  }

  if (artifact.mirror_status === "blocked") {
    blocked += 1;
    assert.equal(artifact.raw_path, null, `${entry.id} blocked artifact should not claim raw_path`);
    assert.equal(artifact.pipeline_state, "source_known", `${entry.id} blocked artifact should stay source_known`);
    assert.equal(extractions.extraction_status, "source_text_unavailable", `${entry.id} blocked artifact should expose unavailable extraction status`);
    assert.equal(claims.claims_status, "source_text_unavailable", `${entry.id} blocked artifact should expose unavailable claims status`);
  }

  if (artifact.artifact_type === "Public Law") publicLaws += 1;
  if (artifact.authority_level === "service_operational_guidance") operationalGuidance += 1;
}

assert.ok(mirrored >= 9, `expected at least 9 mirrored seed artifacts, got ${mirrored}`);
assert.ok(blocked >= 3, `expected blocked official-source records to be explicit, got ${blocked}`);
assert.ok(publicLaws >= 2, `expected at least 2 NDAA/public law artifacts, got ${publicLaws}`);
assert.ok(operationalGuidance >= 1, "expected at least one lower-echelon operational guidance artifact");
assert.equal(existsSync(join(ROOT, "sources", "source-registry.json")), true, "source registry missing");
assert.equal(existsSync(join(ROOT, "sources", "source-discovery-registry.json")), true, "source discovery registry missing");
assert.equal(existsSync(join(ROOT, "taxonomies", "authority-echelons.json")), true, "authority taxonomy missing");
assert.equal(existsSync(join(ROOT, "taxonomies", "source-locations.json")), true, "source location taxonomy missing");
assert.equal(existsSync(join(ROOT, "taxonomies", "governance-item-universe.json")), true, "governance item universe missing");
assert.equal(existsSync(join(ROOT, "data", "artifact-index.json")), true, "artifact index missing");
assert.equal(existsSync(join(ROOT, "data", "reference-coverage-map.json")), true, "reference coverage map missing");
assert.equal(existsSync(join(ROOT, "docs", "reference-coverage-map.md")), true, "reference coverage docs missing");
assert.equal(existsSync(join(ROOT, "data", "authority-chain-map.json")), true, "authority chain map missing");
assert.equal(existsSync(join(ROOT, "docs", "authority-chain-map.md")), true, "authority chain docs missing");
assert.equal(existsSync(join(ROOT, "data", "reference-ingestion-queue.json")), true, "reference ingestion queue missing");
assert.equal(existsSync(join(ROOT, "data", "reference-ingestion-queue-summary.json")), true, "reference ingestion queue summary missing");
assert.equal(existsSync(join(ROOT, "docs", "reference-ingestion-queue.md")), true, "reference ingestion queue docs missing");
assert.equal(existsSync(join(ROOT, "data", "source-acquisition-queue.json")), true, "source acquisition queue missing");
assert.equal(existsSync(join(ROOT, "data", "source-acquisition-queue-summary.json")), true, "source acquisition queue summary missing");
assert.equal(existsSync(join(ROOT, "docs", "source-acquisition-queue.md")), true, "source acquisition queue docs missing");
assert.equal(existsSync(join(ROOT, "data", "dod-issuances-catalog.json")), true, "DoD issuances catalog missing");
assert.equal(existsSync(join(ROOT, "docs", "dod-issuances-catalog.md")), true, "DoD issuances catalog docs missing");
assert.equal(existsSync(join(ROOT, "schemas", "source-acquisition-packet.schema.json")), true, "source acquisition packet schema missing");
assert.equal(existsSync(join(ROOT, "docs", "source-acquisition-packets.md")), true, "source acquisition packet docs missing");
assert.equal(existsSync(join(ROOT, "data", "source-acquisition-packet-example.json")), true, "source acquisition packet example missing");
assert.equal(existsSync(join(ROOT, "data", "source-acquisition-capture-plan.example.json")), true, "source acquisition capture plan example missing");

const referenceCoverage = readJson("data/reference-coverage-map.json");
const authorityChainMap = readJson("data/authority-chain-map.json");
const artifactIndex = readJson("data/artifact-index.json");
const ingestionQueue = readJson("data/reference-ingestion-queue.json");
const ingestionQueueSummary = readJson("data/reference-ingestion-queue-summary.json");
const sourceAcquisitionQueue = readJson("data/source-acquisition-queue.json");
const sourceAcquisitionQueueSummary = readJson("data/source-acquisition-queue-summary.json");
const dodIssuancesCatalog = readJson("data/dod-issuances-catalog.json");
const sourceAcquisitionPacketExample = readJson("data/source-acquisition-packet-example.json");
const sourceAcquisitionCapturePlanExample = readJson("data/source-acquisition-capture-plan.example.json");
assert.equal(artifactIndex.artifact_count, manifest.artifact_count, "artifact index count should match manifest");
assert.equal(artifactIndex.artifacts?.length, manifest.artifact_count, "artifact index artifacts should match manifest");
assert.ok(artifactIndex.artifacts.every(artifact => artifact.id && artifact.manifest_path), "artifact index rows need ids and manifest paths");
assert.equal(authorityChainMap.artifact_count, manifest.artifact_count, "authority chain map count should match manifest");
assert.equal(Array.isArray(authorityChainMap.nodes), true, "authority chain map nodes must be an array");
assert.equal(Array.isArray(authorityChainMap.edges), true, "authority chain map edges must be an array");
assert.ok(authorityChainMap.summary?.edge_count >= authorityChainMap.summary?.resolved_reference_edge_count, "authority chain summary should count edges");
assert.equal(Array.isArray(ingestionQueue.queue_items), true, "reference ingestion queue items must be an array");
assert.equal(ingestionQueue.summary?.queue_item_count, referenceCoverage.uncatalogued_references.length, "reference ingestion queue should cover every uncatalogued reference");
assert.equal(ingestionQueue.queue_items.length, referenceCoverage.uncatalogued_references.length, "reference ingestion queue item count mismatch");
assert.deepEqual(ingestionQueueSummary.summary, ingestionQueue.summary, "reference ingestion queue summary should mirror queue counts");
assert.ok(ingestionQueueSummary.top_queue_items?.length <= 50, "reference ingestion queue summary should stay compact");
assert.ok(ingestionQueue.queue_items[0]?.queue_rank === 1, "reference ingestion queue should be ranked");
assert.ok(ingestionQueue.queue_items.some(item => item.queue_priority === "P0"), "reference ingestion queue should identify P0 items");
assert.ok(ingestionQueue.queue_items.every(item => item.official_source_candidates?.length), "reference ingestion queue items need official source candidates");
assert.equal(Array.isArray(sourceAcquisitionQueue.queue_items), true, "source acquisition queue items must be an array");
assert.ok(sourceAcquisitionQueue.summary?.queue_item_count >= 10, "source acquisition queue should expose corpus acquisition work");
assert.deepEqual(sourceAcquisitionQueueSummary.summary, sourceAcquisitionQueue.summary, "source acquisition queue summary should mirror queue counts");
assert.ok(sourceAcquisitionQueueSummary.top_queue_items?.length <= 50, "source acquisition queue summary should stay compact");
assert.ok(sourceAcquisitionQueue.queue_items[0]?.queue_rank === 1, "source acquisition queue should be ranked");
assert.ok(sourceAcquisitionQueue.queue_items.some(item => item.item_type === "source_recovery"), "source acquisition queue should include source recovery work");
assert.ok(sourceAcquisitionQueue.queue_items.some(item => item.item_type === "governance_gap"), "source acquisition queue should include governance gap work");
assert.ok(dodIssuancesCatalog.summary?.dodi_count >= 800, "DoD issuances catalog should exhaustively cover DoDI page records");
assert.ok(dodIssuancesCatalog.summary?.dodd_count >= 250, "DoD issuances catalog should exhaustively cover DoDD page records");
assert.equal(
  manifest.artifacts.filter(entry => ["dod_instruction", "dod_directive"].includes(entry.family)).length,
  dodIssuancesCatalog.summary.total_count,
  "manifest should include every DoDI/DoDD catalog row as a policy artifact",
);
assert.equal(sourceAcquisitionPacketExample.packetVersion, "policy-source-acquisition-packet-v1", "source acquisition packet example should use the product packet contract");
assert.ok(sourceAcquisitionPacketExample.items?.[0]?.corpusTargets?.length >= 1, "source acquisition packet example should include corpus targets");
assert.equal(sourceAcquisitionCapturePlanExample.planVersion, "source-acquisition-capture-plan-v1", "source acquisition capture plan example should use the corpus plan contract");
assert.equal(sourceAcquisitionCapturePlanExample.packetVersion, sourceAcquisitionPacketExample.packetVersion, "source acquisition capture plan should preserve packet version");
assert.equal(sourceAcquisitionCapturePlanExample.summary?.itemCount, sourceAcquisitionPacketExample.items.length, "source acquisition capture plan item count should match packet");
assert.ok(sourceAcquisitionCapturePlanExample.workItems?.[0]?.acceptanceCriteria?.length >= 3, "source acquisition capture plan should include acceptance criteria");

console.log(`Validated ${manifest.artifact_count} artifacts (${mirrored} mirrored, ${blocked} source-known blocked).`);

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function assertSidecar(artifact, field, label) {
  assert.ok(artifact[field], `${artifact.id} needs ${field}`);
  assert.equal(existsSync(join(ROOT, artifact[field])), true, `${artifact.id} missing ${label}`);
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
