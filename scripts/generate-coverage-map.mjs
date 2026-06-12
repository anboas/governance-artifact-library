import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const manifest = readJson("manifest.json");
const universe = readJson("taxonomies/governance-item-universe.json");
const generatedAt = manifest.generated_at;

const artifacts = manifest.artifacts.map((entry) => {
  const artifact = readJson(entry.path);
  return {
    ...artifact,
    path: entry.path,
    has_raw: Boolean(artifact.raw_path && existsSync(join(ROOT, artifact.raw_path))),
    has_text: Boolean(artifact.extracted_text_path && existsSync(join(ROOT, artifact.extracted_text_path))),
    has_metadata: Boolean(artifact.metadata_path && existsSync(join(ROOT, artifact.metadata_path))),
    has_analytics: Boolean(artifact.analytics_path && existsSync(join(ROOT, artifact.analytics_path))),
    has_analysis: Boolean(artifact.analysis_path && existsSync(join(ROOT, artifact.analysis_path))),
    has_structured: Boolean(artifact.structured_json_path && existsSync(join(ROOT, artifact.structured_json_path))),
    has_versions: Boolean(artifact.version_index_path && existsSync(join(ROOT, artifact.version_index_path))),
  };
});

const rows = universe.items
  .map((item) => {
    const matches = artifacts.filter((artifact) => matchesUniverseItem(item, artifact));
    const counts = {
      in_repo: matches.length,
      mirrored: count(matches, (artifact) => artifact.mirror_status === "mirrored"),
      blocked: count(matches, (artifact) => artifact.mirror_status === "blocked"),
      raw: count(matches, (artifact) => artifact.has_raw),
      text: count(matches, (artifact) => artifact.has_text),
      metadata: count(matches, (artifact) => artifact.has_metadata),
      analytics: count(matches, (artifact) => artifact.has_analytics),
      analysis: count(matches, (artifact) => artifact.has_analysis),
      structured: count(matches, (artifact) => artifact.has_structured),
      versions: count(matches, (artifact) => artifact.has_versions),
    };

    return {
      id: item.id,
      label: item.label,
      authority_level: item.authority_level,
      hierarchy_rank: item.hierarchy_rank,
      source_location_types: item.source_location_types,
      required_tags: item.required_tags || [],
      status: getStatus(counts),
      counts,
      artifacts: matches.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        mirror_status: artifact.mirror_status,
        pipeline_state: artifact.pipeline_state,
        path: artifact.path,
      })),
      examples: item.examples,
    };
  })
  .sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.label.localeCompare(b.label));

const totals = {
  universe_items: rows.length,
  covered_items: count(rows, (row) => row.counts.in_repo > 0),
  empty_items: count(rows, (row) => row.counts.in_repo === 0),
  artifact_count: artifacts.length,
  mirrored_artifacts: count(artifacts, (artifact) => artifact.mirror_status === "mirrored"),
  blocked_artifacts: count(artifacts, (artifact) => artifact.mirror_status === "blocked"),
  text_extracted_artifacts: count(artifacts, (artifact) => artifact.has_text),
  analytics_artifacts: count(artifacts, (artifact) => artifact.has_analytics),
  analysis_artifacts: count(artifacts, (artifact) => artifact.has_analysis),
  structured_artifacts: count(artifacts, (artifact) => artifact.has_structured),
  versioned_artifacts: count(artifacts, (artifact) => artifact.has_versions),
};

const byAuthority = rows.reduce((groups, row) => {
  const group = groups.get(row.authority_level) || {
    authority_level: row.authority_level,
    hierarchy_rank: row.hierarchy_rank,
    universe_items: 0,
    covered_items: 0,
    artifact_count: 0,
    mirrored_artifacts: 0,
    blocked_artifacts: 0,
  };
  group.universe_items += 1;
  if (row.counts.in_repo > 0) group.covered_items += 1;
  group.artifact_count += row.counts.in_repo;
  group.mirrored_artifacts += row.counts.mirrored;
  group.blocked_artifacts += row.counts.blocked;
  groups.set(row.authority_level, group);
  return groups;
}, new Map());

const coverage = {
  generated_at: generatedAt,
  totals,
  by_authority_level: [...byAuthority.values()].sort((a, b) => a.hierarchy_rank - b.hierarchy_rank),
  rows,
};

const markdown = renderMarkdown(coverage);

await writeOrCheck("data/coverage-map.json", `${JSON.stringify(coverage, null, 2)}\n`);
await writeOrCheck("docs/coverage-map.md", markdown);

console.log(
  `Coverage map ${CHECK_ONLY ? "checked" : "generated"}: ${totals.covered_items}/${totals.universe_items} item types covered, ${totals.artifact_count} artifacts.`
);

function matchesUniverseItem(item, artifact) {
  if (artifact.authority_level !== item.authority_level) return false;
  const typeMatch = item.artifact_types?.includes(artifact.artifact_type);
  const familyMatch = item.families?.includes(artifact.family);
  const sourceMatch = item.source_location_types?.includes(artifact.source_location_type);
  const tagMatch = (item.required_tags || []).every((tag) => artifact.tags?.includes(tag));

  if (!typeMatch) return false;
  if (item.source_location_types?.length && !sourceMatch) return false;
  if (item.families?.length && !familyMatch) return false;
  if (item.required_tags?.length && !tagMatch) return false;
  return true;
}

function getStatus(counts) {
  if (counts.in_repo === 0) return "not_started";
  if (counts.mirrored === 0 && counts.blocked > 0) return "source_known_blocked";
  if (counts.text < counts.in_repo) return "partially_extracted";
  if (counts.analytics < counts.in_repo || counts.analysis < counts.in_repo) return "partially_analyzed";
  if (counts.structured < counts.in_repo) return "partially_structured";
  return "analysis_ready";
}

function renderMarkdown(model) {
  const lines = [
    "# Governance Coverage Map",
    "",
    "Generated from `manifest.json` and `taxonomies/governance-item-universe.json`.",
    "",
    "## Summary",
    "",
    `- Universe item types: ${model.totals.universe_items}`,
    `- Covered item types: ${model.totals.covered_items}`,
    `- Empty item types: ${model.totals.empty_items}`,
    `- Artifacts in repo: ${model.totals.artifact_count}`,
    `- Mirrored artifacts: ${model.totals.mirrored_artifacts}`,
    `- Source-known blocked artifacts: ${model.totals.blocked_artifacts}`,
    `- Text extracted: ${model.totals.text_extracted_artifacts}`,
    `- Analytics sidecars: ${model.totals.analytics_artifacts}`,
    `- Analysis sidecars: ${model.totals.analysis_artifacts}`,
    `- Structured summaries: ${model.totals.structured_artifacts}`,
    `- Version ledgers: ${model.totals.versioned_artifacts}`,
    "",
    "## Authority Coverage",
    "",
    "| Rank | Authority Level | Covered Types | Artifacts | Mirrored | Blocked |",
    "| ---: | --- | ---: | ---: | ---: | ---: |",
    ...model.by_authority_level.map((row) =>
      `| ${row.hierarchy_rank} | ${row.authority_level} | ${row.covered_items}/${row.universe_items} | ${row.artifact_count} | ${row.mirrored_artifacts} | ${row.blocked_artifacts} |`
    ),
    "",
    "## Governance Item Coverage",
    "",
    "| Rank | Governance Item | Status | In Repo | Raw | Text | Metadata | Analytics | Analysis | Structured | Versions | Artifacts |",
    "| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...model.rows.map((row) =>
      [
        `| ${row.hierarchy_rank}`,
        row.label,
        row.status,
        row.counts.in_repo,
        row.counts.raw,
        row.counts.text,
        row.counts.metadata,
        row.counts.analytics,
        row.counts.analysis,
        row.counts.structured,
        row.counts.versions,
        row.artifacts.map((artifact) => artifact.id).join("<br>") || "none",
      ].join(" | ") + " |"
    ),
    "",
    "## Source Location Coverage",
    "",
    "| Source Location Type | Item Types | In Repo | Mirrored | Blocked |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...sourceLocationRows(model.rows).map((row) =>
      `| ${row.source_location_type} | ${row.item_types} | ${row.in_repo} | ${row.mirrored} | ${row.blocked} |`
    ),
    "",
    "## Status Key",
    "",
    "- `not_started`: no artifact in the repo for that governance item yet.",
    "- `source_known_blocked`: official source is registered, but raw mirroring is blocked or not yet captured.",
    "- `partially_extracted`: at least one artifact lacks raw or extracted text.",
    "- `partially_analyzed`: at least one artifact lacks analytics or analysis sidecars.",
    "- `partially_structured`: at least one artifact lacks structured summary.",
    "- `analysis_ready`: all artifacts for that item have raw source, extracted text, metadata, analytics, analysis, structured summary, and version ledger.",
    "",
  ];

  return `${lines.join("\n")}`;
}

function sourceLocationRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    for (const sourceLocationType of row.source_location_types) {
      const group = groups.get(sourceLocationType) || {
        source_location_type: sourceLocationType,
        item_types: 0,
        in_repo: 0,
        mirrored: 0,
        blocked: 0,
      };
      group.item_types += 1;
      const matchingArtifacts = row.artifacts.filter((artifact) => {
        const full = readJson(artifact.path);
        return full.source_location_type === sourceLocationType;
      });
      group.in_repo += matchingArtifacts.length;
      group.mirrored += count(matchingArtifacts, (artifact) => artifact.mirror_status === "mirrored");
      group.blocked += count(matchingArtifacts, (artifact) => artifact.mirror_status === "blocked");
      groups.set(sourceLocationType, group);
    }
  }
  return [...groups.values()].sort((a, b) => a.source_location_type.localeCompare(b.source_location_type));
}

function count(items, predicate) {
  return items.filter(predicate).length;
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run coverage`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
