import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { normalizeDodOpr, slugFor } from "./policy-organization-taxonomy.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const manifest = readJson("manifest.json");
const analytics = readJson("data/document-analytics-map.json");
const sourceDiscoveryMap = readJson("data/source-discovery-map.json");
const sourceRegistry = readJson("sources/source-discovery-registry.json");
const dodIssuancesCatalog = existsSync(join(ROOT, "data/dod-issuances-catalog.json"))
  ? readJson("data/dod-issuances-catalog.json")
  : { rows: [] };
const sourceDiscovery = existsSync(join(ROOT, "data/governance-artifact-source-discovery.json"))
  ? readJson("data/governance-artifact-source-discovery.json")
  : { by_source_system: [], candidates: [] };

const sourceRegistryByName = new Map(sourceRegistry.sources.map((source) => [source.name, source]));
const sourceDiscoveryRowsByName = new Map(sourceDiscoveryMap.rows.map((source) => [source.name, source]));
const currentDensity = currentDensityRows(analytics.rows || []);
const currentDensityNames = new Set(currentDensity.map((row) => row.organization));
const dodOprArtifacts = dodOprArtifactLinks(dodIssuancesCatalog.rows || [], analytics.rows || []);
const dodOprEntities = groupArtifactLinks(dodOprArtifacts, "entity_id").map((row) => {
  const first = row.artifacts[0] || {};
  return {
    entity_id: row.key,
    entity_name: first.entity_name || row.key,
    entity_code: first.entity_code || null,
    current_density_present: currentDensityNames.has(first.entity_name),
    source_basis: "DoW/DoD Issuances OPR column",
    artifact_count: row.artifact_count,
    public_artifact_count: count(row.artifacts, (artifact) => !artifact.certificate_restricted),
    restricted_artifact_count: count(row.artifacts, (artifact) => artifact.certificate_restricted),
    source_systems: unique(row.artifacts.map((artifact) => artifact.source_system)),
    families: unique(row.artifacts.map((artifact) => artifact.family)),
    artifacts: row.artifacts,
  };
});

const sourceOwnerEntities = sourceDiscoveryMap.rows.map((source) => {
  const registry = sourceRegistryByName.get(source.name) || {};
  const relatedSourceDiscovery = (sourceDiscovery.by_source_system || []).find((row) => row.source_system === source.name);
  return {
    entity_id: `source-owner-${slugFor(source.source_owner || source.name)}`,
    entity_name: source.source_owner || source.name,
    source_name: source.name,
    source_id: source.id,
    current_density_present: currentDensityNames.has(source.source_owner) || currentDensityNames.has(source.name),
    source_basis: "Official source discovery registry",
    priority: source.priority,
    automation_status: source.automation_status,
    coverage_status: source.coverage_status,
    artifact_count: source.counts?.artifacts || 0,
    mirrored_artifact_count: source.counts?.mirrored || 0,
    blocked_artifact_count: source.counts?.blocked || 0,
    reference_candidate_count: relatedSourceDiscovery?.candidate_count || relatedSourceDiscovery?.candidates || 0,
    landing_pages: registry.landing_pages || [],
    search_endpoints: registry.search_endpoints || [],
    api_endpoints: registry.api_endpoints || [],
    feed_endpoints: registry.feed_endpoints || [],
    sitemap_urls: registry.sitemap_urls || [],
    capture_strategies: source.capture_strategies || [],
    source_location_types: source.source_location_types || [],
    artifact_types: source.artifact_types || [],
    families: source.families || [],
    artifacts: (source.artifacts || []).map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      source_system: source.name,
      source_location_type: artifact.source_location_type,
      mirror_status: artifact.mirror_status,
      pipeline_state: artifact.pipeline_state,
      enumeration_status: "catalogued",
    })),
  };
});

const sourceOwnerGaps = sourceOwnerEntities
  .filter((entity) => !entity.current_density_present || entity.artifact_count === 0)
  .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.reference_candidate_count - a.reference_candidate_count || a.source_name.localeCompare(b.source_name));

const model = {
  generated_at: manifest.generated_at,
  exploration_version: "organization-entity-source-exploration-v1",
  scope: "Superficial enumeration only: entity/source/artifact discovery metadata, no new raw mirroring, text extraction, claims, or relationship processing.",
  summary: {
    current_density_organization_count: currentDensity.length,
    current_density_artifact_count: sum(currentDensity, "artifact_count"),
    dod_opr_entity_count: dodOprEntities.length,
    dod_opr_artifact_link_count: dodOprArtifacts.length,
    dod_opr_entities_missing_from_current_density: count(dodOprEntities, (entity) => !entity.current_density_present),
    source_owner_entity_count: sourceOwnerEntities.length,
    source_owner_entities_missing_or_empty_in_current_density: sourceOwnerGaps.length,
    official_source_systems_represented_in_reference_discovery: sourceDiscovery.summary?.official_source_systems || 0,
    reference_source_candidate_count: sourceDiscovery.summary?.candidate_count || 0,
  },
  current_density_organizations: currentDensity,
  dod_opr_entities: dodOprEntities,
  source_owner_entities: sourceOwnerEntities,
  source_owner_gaps: sourceOwnerGaps,
  reference_discovery_source_systems: sourceDiscovery.by_source_system || [],
};

await writeOrCheck("data/organization-entity-source-exploration.json", `${JSON.stringify(model, null, 2)}\n`);
await writeOrCheck("docs/organization-entity-source-exploration.md", renderMarkdown(model));

console.log(
  `Organization/entity exploration ${CHECK_ONLY ? "checked" : "generated"}: ${model.summary.dod_opr_entity_count} DoW OPR entities, ${model.summary.dod_opr_artifact_link_count} OPR-artifact links, ${model.summary.source_owner_entities_missing_or_empty_in_current_density} source-owner gaps.`
);

function currentDensityRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const facets = Array.isArray(row.organization_facets) && row.organization_facets.length
      ? row.organization_facets
      : [{ id: row.responsible_organization || row.issuing_organization || "Unknown organization", name: row.responsible_organization || row.issuing_organization || "Unknown organization" }];
    for (const facet of facets) {
      const organization = facet.name || "Unknown organization";
      const key = facet.id || organization;
      const group = groups.get(key) || {
        organization,
        organization_id: key,
        organization_code: facet.code || null,
        organization_tier: facet.tier || "unknown",
        artifact_count: 0,
        claim_count: 0,
        reference_count: 0,
        authority_edge_count: 0,
        word_count: 0,
        source_systems: new Set(),
      };
      group.artifact_count += 1;
      group.claim_count += Number(row.claim_count || 0);
      group.reference_count += Number(row.outgoing_reference_count || 0);
      group.authority_edge_count += Number(row.authority_edge_count || 0);
      group.word_count += Number(row.extracted_word_count || 0);
      group.source_systems.add(row.source_system || "Unknown");
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, source_systems: [...group.source_systems].sort() }))
    .sort((a, b) => b.artifact_count - a.artifact_count || a.organization.localeCompare(b.organization));
}

function dodOprArtifactLinks(catalogRows, analyticsRows) {
  const analyticsById = new Map(analyticsRows.map((row) => [row.id, row]));
  const links = [];
  for (const row of catalogRows) {
    const analyticsRow = analyticsById.get(row.artifact_id) || {};
    const entities = analyticsRow.responsible_organizations?.length
      ? analyticsRow.responsible_organizations
      : normalizeDodOpr(row.opr);
    for (const entity of entities) {
      links.push({
        entity_id: entity.id,
        entity_name: entity.name,
        entity_code: entity.code,
        raw_opr: row.opr || null,
        id: row.artifact_id,
        label: row.label,
        title: row.subject ? `${row.label}: ${row.subject}` : row.label,
        artifact_type: row.family === "dodd" ? "DoW/DoD Directive" : "DoW/DoD Instruction",
        family: row.family,
        source_system: "DoW/DoD Issuances",
        source_url: row.source_url || null,
        issuance_date: row.issuance_date || null,
        change_date: row.change_date || null,
        certificate_restricted: Boolean(row.certificate_restricted),
        mirror_status: analyticsRow.mirror_status || "catalogued",
        pipeline_state: analyticsRow.pipeline_state || "catalogued",
        enumeration_status: "source_known",
      });
    }
  }
  return links.sort((a, b) => a.entity_name.localeCompare(b.entity_name) || String(a.label).localeCompare(String(b.label)));
}

function groupArtifactLinks(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const key = row[field] || "unknown";
    const group = groups.get(key) || { key, artifact_count: 0, artifacts: [] };
    group.artifact_count += 1;
    group.artifacts.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.artifact_count - a.artifact_count || a.key.localeCompare(b.key));
}

function renderMarkdown(model) {
  const sourceGaps = model.source_owner_gaps.slice(0, 40);
  const oprRows = model.dod_opr_entities.slice(0, 40);
  return [
    "# Organization / Entity Source Exploration",
    "",
    "Generated from the current artifact analytics map, DoW/DoD issuance catalog OPR fields, source discovery registry, and reference source-discovery queue.",
    "",
    "Scope: superficial enumeration only. This map does not mirror new raw files, extract text, generate claims, or infer relationships.",
    "",
    "## Summary",
    "",
    `- Current density organizations: ${model.summary.current_density_organization_count}`,
    `- DoW/DoD OPR entities found: ${model.summary.dod_opr_entity_count}`,
    `- DoW/DoD OPR-to-artifact links enumerated: ${model.summary.dod_opr_artifact_link_count}`,
    `- OPR entities missing from current density labels: ${model.summary.dod_opr_entities_missing_from_current_density}`,
    `- Source-owner entities tracked: ${model.summary.source_owner_entity_count}`,
    `- Source-owner entities missing or empty in current density: ${model.summary.source_owner_entities_missing_or_empty_in_current_density}`,
    `- Reference-discovery source candidates: ${model.summary.reference_source_candidate_count}`,
    "",
    "## DoW/DoD OPR Entities",
    "",
    "| Entity | Code | In Current Density | Artifacts | Public | Restricted |",
    "| --- | --- | --- | ---: | ---: | ---: |",
    ...oprRows.map((row) => `| ${row.entity_name} | ${row.entity_code || ""} | ${row.current_density_present ? "yes" : "no"} | ${row.artifact_count} | ${row.public_artifact_count} | ${row.restricted_artifact_count} |`),
    "",
    "## Source-Owner Gaps",
    "",
    "| Source | Owner | Priority | Automation | Status | Artifacts | Reference Candidates |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
    ...sourceGaps.map((row) => `| ${row.source_name} | ${row.entity_name} | ${row.priority} | ${row.automation_status} | ${row.coverage_status} | ${row.artifact_count} | ${row.reference_candidate_count} |`),
    "",
    "## Full Enumeration",
    "",
    "- Full OPR artifact lists are in `data/organization-entity-source-exploration.json` under `dod_opr_entities[].artifacts`.",
    "- Full tracked source surfaces are in `source_owner_entities[]`.",
    "- Full reference-derived source/artifact candidates remain in `data/governance-artifact-source-discovery.json` and are summarized here under `reference_discovery_source_systems`.",
    "",
  ].join("\n");
}

function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 9;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run entities`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}
