import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const INDEX_VERSION = "governance-artifact-index-v1";
const manifest = readJson("manifest.json");

const artifacts = manifest.artifacts.map(entry => {
  const artifact = readJson(entry.path);
  return {
    id: artifact.id,
    title: artifact.title,
    short_title: artifact.short_title,
    artifact_type: artifact.artifact_type,
    domain: artifact.domain,
    authority_level: artifact.authority_level,
    hierarchy_rank: artifact.hierarchy_rank,
    family: artifact.family,
    jurisdiction: artifact.jurisdiction,
    issuing_authority: artifact.issuing_authority,
    issuing_organization: artifact.issuing_organization,
    source_system: artifact.source_system,
    source_location_type: artifact.source_location_type,
    source_url: artifact.source_url,
    source_date: artifact.source_date,
    publication_date: artifact.publication_date,
    effective_date: artifact.effective_date,
    captured_at: artifact.captured_at,
    raw_path: artifact.raw_path,
    extracted_text_path: artifact.extracted_text_path,
    metadata_path: artifact.metadata_path,
    analytics_path: artifact.analytics_path,
    analysis_path: artifact.analysis_path,
    structured_json_path: artifact.structured_json_path,
    version_index_path: artifact.version_index_path,
    extraction_path: artifact.extraction_path,
    claims_path: artifact.claims_path,
    reference_resolution_path: artifact.reference_resolution_path,
    authority_chain_path: artifact.authority_chain_path,
    pipeline_state: artifact.pipeline_state,
    mirror_status: artifact.mirror_status,
    parser_status: artifact.parser_status,
    review_status: artifact.review_status,
    tags: artifact.tags || [],
    analytic_lanes: artifact.analytic_lanes || [],
    relationships: artifact.relationships || [],
    provenance: artifact.provenance || {},
    manifest_path: entry.path,
    manifest_pipeline_state: entry.pipeline_state,
    manifest_mirror_status: entry.mirror_status,
  };
});

const index = {
  generated_at: manifest.generated_at,
  index_version: INDEX_VERSION,
  artifact_count: artifacts.length,
  artifacts,
};

let changed = 0;
changed += writeIfChanged("data/artifact-index.json", `${JSON.stringify(index, null, 2)}\n`);

if (CHECK && changed) {
  throw new Error(`Artifact index is stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} artifact index for ${artifacts.length} artifacts.`);

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
