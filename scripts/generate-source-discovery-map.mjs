import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const registry = readJson("sources/source-discovery-registry.json");
const manifest = readJson("manifest.json");
const sourceLocations = readJson("taxonomies/source-locations.json").source_locations;
const generatedAt = manifest.generated_at;

const knownLocationTypes = new Set(sourceLocations.map((source) => source.source_location_type));
const artifacts = manifest.artifacts.map((entry) => ({ ...readJson(entry.path), path: entry.path }));
const sourceIds = new Set();

const rows = registry.sources
  .map((source) => {
    assert.ok(source.id, "source needs id");
    assert.equal(sourceIds.has(source.id), false, `duplicate source id ${source.id}`);
    sourceIds.add(source.id);
    assert.ok(source.name, `${source.id} needs name`);
    assert.ok(source.source_owner, `${source.id} needs source_owner`);
    assert.ok(source.issuing_authority_scope?.length, `${source.id} needs issuing_authority_scope`);
    assert.ok(source.source_location_types?.length, `${source.id} needs source_location_types`);
    assert.ok(source.landing_pages?.length, `${source.id} needs at least one landing page`);
    assert.ok(source.capture_strategies?.length, `${source.id} needs capture_strategies`);
    assert.ok(source.automation_status, `${source.id} needs automation_status`);
    assert.ok(source.priority, `${source.id} needs priority`);

    for (const sourceLocationType of source.source_location_types) {
      assert.ok(knownLocationTypes.has(sourceLocationType), `${source.id} references unknown source_location_type ${sourceLocationType}`);
    }

    const matches = artifacts.filter((artifact) => source.source_location_types.includes(artifact.source_location_type));
    const counts = {
      artifacts: matches.length,
      mirrored: count(matches, (artifact) => artifact.mirror_status === "mirrored"),
      blocked: count(matches, (artifact) => artifact.mirror_status === "blocked"),
      text_extracted: count(matches, (artifact) => Boolean(artifact.extracted_text_path)),
      analytics: count(matches, (artifact) => Boolean(artifact.analytics_path)),
      analysis: count(matches, (artifact) => Boolean(artifact.analysis_path)),
      structured: count(matches, (artifact) => Boolean(artifact.structured_json_path)),
      versioned: count(matches, (artifact) => Boolean(artifact.version_index_path)),
    };

    return {
      id: source.id,
      name: source.name,
      source_owner: source.source_owner,
      issuing_authority_scope: source.issuing_authority_scope,
      source_location_types: source.source_location_types,
      capture_strategies: source.capture_strategies,
      automation_status: source.automation_status,
      api_key_required: source.api_key_required,
      priority: source.priority,
      discovery_surface_counts: {
        landing_pages: source.landing_pages.length,
        api_endpoints: source.api_endpoints.length,
        feed_endpoints: source.feed_endpoints.length,
        search_endpoints: source.search_endpoints.length,
        sitemap_urls: source.sitemap_urls.length,
        has_robots: Boolean(source.robots_url),
      },
      coverage_status: getCoverageStatus(counts),
      counts,
      artifacts: matches.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        mirror_status: artifact.mirror_status,
        pipeline_state: artifact.pipeline_state,
        source_location_type: artifact.source_location_type,
        path: artifact.path,
      })),
      notes: source.notes,
    };
  })
  .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name));

const totals = {
  sources: rows.length,
  sources_with_artifacts: count(rows, (row) => row.counts.artifacts > 0),
  sources_not_started: count(rows, (row) => row.counts.artifacts === 0),
  direct_fetch_ready: count(rows, (row) => row.automation_status === "direct_fetch_ready"),
  blocked_or_browser_needed: count(rows, (row) => ["blocked_by_host", "browser_shell_detected"].includes(row.automation_status)),
  needs_probe: count(rows, (row) => row.automation_status === "needs_probe"),
  api_key_required: count(rows, (row) => row.api_key_required),
  api_sources: count(rows, (row) => row.capture_strategies.includes("api")),
  feed_sources: count(rows, (row) => row.discovery_surface_counts.feed_endpoints > 0),
  sitemap_sources: count(rows, (row) => row.discovery_surface_counts.sitemap_urls > 0),
};

const byAutomationStatus = groupCount(rows, (row) => row.automation_status);
const byPriority = groupCount(rows, (row) => row.priority);
const byCaptureStrategy = rows.reduce((groups, row) => {
  for (const strategy of row.capture_strategies) {
    groups.set(strategy, (groups.get(strategy) || 0) + 1);
  }
  return groups;
}, new Map());

const model = {
  generated_at: generatedAt,
  totals,
  by_automation_status: mapToRows(byAutomationStatus, "automation_status"),
  by_priority: mapToRows(byPriority, "priority"),
  by_capture_strategy: mapToRows(byCaptureStrategy, "capture_strategy"),
  rows,
};

await writeOrCheck("data/source-discovery-map.json", `${JSON.stringify(model, null, 2)}\n`);
await writeOrCheck("docs/source-discovery-map.md", renderMarkdown(model));

console.log(
  `Source discovery map ${CHECK_ONLY ? "checked" : "generated"}: ${totals.sources_with_artifacts}/${totals.sources} sources have artifacts, ${totals.blocked_or_browser_needed} blocked/browser-needed.`
);

function getCoverageStatus(counts) {
  if (counts.artifacts === 0) return "not_started";
  if (counts.mirrored === 0 && counts.blocked > 0) return "source_known_blocked";
  if (counts.mirrored > 0 && counts.blocked > 0) return "mixed";
  if (counts.mirrored > 0) return "mirrored";
  return "registered";
}

function renderMarkdown(model) {
  const lines = [
    "# Source Discovery Map",
    "",
    "Generated from `sources/source-discovery-registry.json`, `manifest.json`, and `taxonomies/source-locations.json`.",
    "",
    "## Summary",
    "",
    `- Official sources tracked: ${model.totals.sources}`,
    `- Sources with artifacts in repo: ${model.totals.sources_with_artifacts}`,
    `- Sources not started: ${model.totals.sources_not_started}`,
    `- Direct-fetch ready sources: ${model.totals.direct_fetch_ready}`,
    `- Blocked/browser-needed sources: ${model.totals.blocked_or_browser_needed}`,
    `- Sources needing probe: ${model.totals.needs_probe}`,
    `- API-key-required sources: ${model.totals.api_key_required}`,
    `- API-capable sources: ${model.totals.api_sources}`,
    `- Feed-capable sources: ${model.totals.feed_sources}`,
    `- Sitemap-capable sources: ${model.totals.sitemap_sources}`,
    "",
    "## Source Coverage",
    "",
    "| Priority | Source | Owner | Status | Automation | Capture Strategies | Artifacts | Mirrored | Blocked | Text | Analytics | Analysis | Structured | Versioned |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...model.rows.map((row) =>
      [
        `| ${row.priority}`,
        row.name,
        row.source_owner,
        row.coverage_status,
        row.automation_status,
        row.capture_strategies.join("<br>"),
        row.counts.artifacts,
        row.counts.mirrored,
        row.counts.blocked,
        row.counts.text_extracted,
        row.counts.analytics,
        row.counts.analysis,
        row.counts.structured,
        row.counts.versioned,
      ].join(" | ") + " |"
    ),
    "",
    "## Discovery Surfaces",
    "",
    "| Source | Landing | API | Feeds | Search | Sitemaps | Robots | Location Types | Artifacts |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |",
    ...model.rows.map((row) =>
      [
        `| ${row.name}`,
        row.discovery_surface_counts.landing_pages,
        row.discovery_surface_counts.api_endpoints,
        row.discovery_surface_counts.feed_endpoints,
        row.discovery_surface_counts.search_endpoints,
        row.discovery_surface_counts.sitemap_urls,
        row.discovery_surface_counts.has_robots ? "yes" : "no",
        row.source_location_types.join("<br>"),
        row.artifacts.map((artifact) => artifact.id).join("<br>") || "none",
      ].join(" | ") + " |"
    ),
    "",
    "## Capture Strategy Counts",
    "",
    "| Capture Strategy | Sources |",
    "| --- | ---: |",
    ...model.by_capture_strategy.map((row) => `| ${row.capture_strategy} | ${row.count} |`),
    "",
    "## Automation Status Counts",
    "",
    "| Automation Status | Sources |",
    "| --- | ---: |",
    ...model.by_automation_status.map((row) => `| ${row.automation_status} | ${row.count} |`),
    "",
  ];

  return `${lines.join("\n")}`;
}

function priorityRank(priority) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "medium") return 2;
  return 3;
}

function groupCount(items, selector) {
  return items.reduce((groups, item) => {
    const key = selector(item);
    groups.set(key, (groups.get(key) || 0) + 1);
    return groups;
  }, new Map());
}

function mapToRows(map, keyName) {
  return [...map.entries()]
    .map(([key, value]) => ({ [keyName]: key, count: value }))
    .sort((a, b) => String(a[keyName]).localeCompare(String(b[keyName])));
}

function count(items, predicate) {
  return items.filter(predicate).length;
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run sources`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
