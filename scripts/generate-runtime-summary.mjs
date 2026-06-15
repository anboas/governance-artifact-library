import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const manifest = readJson("manifest.json");
const coverageMap = readOptionalJson("data/coverage-map.json");
const claimCoverage = readOptionalJson("data/claim-coverage-map.json");
const referenceCoverage = readOptionalJson("data/reference-coverage-map.json");
const sourceDiscovery = readOptionalJson("data/source-discovery-map.json");
const sourceAcquisition = readOptionalJson("data/source-acquisition-queue-summary.json");
const authorityChain = readOptionalJson("data/authority-chain-map.json");
const documentAnalytics = readOptionalJson("data/document-analytics-map.json");
const artifactSourceDiscovery = readOptionalJson("data/governance-artifact-source-discovery-summary.json");
const organizationExploration = readOptionalJson("data/organization-entity-source-exploration.json");

const model = {
  generated_at: manifest.generated_at,
  summary_version: "policy-corpus-runtime-summary-v1",
  source_paths: {
    manifest: "manifest.json",
    coverage: "data/coverage-map.json",
    claims: "data/claim-coverage-map.json",
    references: "data/reference-coverage-map.json",
    source_discovery: "data/source-discovery-map.json",
    source_acquisition: "data/source-acquisition-queue-summary.json",
    authority: "data/authority-chain-map.json",
    document_analytics: "data/document-analytics-map.json",
    artifact_source_discovery: "data/governance-artifact-source-discovery-summary.json",
    organization_exploration: "data/organization-entity-source-exploration.json",
  },
  manifest: {
    artifact_count: manifest.artifact_count || manifest.artifacts?.length || 0,
    mirrored_count: manifest.mirrored_count || 0,
    blocked_count: manifest.blocked_count || 0,
    taxonomy_summary: manifest.taxonomy_summary || {},
  },
  coverage: coverageMap?.totals || {},
  claims: claimCoverage?.summary || {},
  references: referenceCoverage?.summary || {},
  source_discovery: sourceDiscovery?.totals || {},
  source_acquisition: sourceAcquisition?.summary || {},
  authority: {
    ...(authorityChain?.summary || {}),
    lane_count: Array.isArray(authorityChain?.lanes) ? authorityChain.lanes.length : 0,
  },
  document_analytics: documentAnalytics?.summary || {},
  artifact_source_discovery: artifactSourceDiscovery?.summary || {},
  organization_exploration: organizationExploration?.summary || {},
};

await writeOrCheck("data/policy-corpus-runtime-summary.json", `${JSON.stringify(model, null, 2)}\n`);

console.log(
  `Policy corpus runtime summary ${CHECK_ONLY ? "checked" : "generated"}: ${model.manifest.artifact_count.toLocaleString()} artifacts, ${Number(model.authority.edge_count || 0).toLocaleString()} authority edges.`
);

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run runtime:summary`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readOptionalJson(path) {
  const fullPath = join(ROOT, path);
  return existsSync(fullPath) ? JSON.parse(readFileSync(fullPath, "utf8")) : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
