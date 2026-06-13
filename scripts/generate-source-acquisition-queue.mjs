import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const coverageMap = readJson("data/coverage-map.json");
const sourceDiscoveryMap = readJson("data/source-discovery-map.json");
const discoveryRegistry = readJson("sources/source-discovery-registry.json");
const generatedAt = coverageMap.generated_at || sourceDiscoveryMap.generated_at;
const sourceRegistryById = new Map(discoveryRegistry.sources.map((source) => [source.id, source]));

const sourceRowsByLocation = sourceDiscoveryMap.rows.reduce((map, source) => {
  for (const locationType of source.source_location_types || []) {
    const bucket = map.get(locationType) || [];
    bucket.push(source);
    map.set(locationType, bucket);
  }
  return map;
}, new Map());

const items = [
  ...sourceRecoveryItems(),
  ...sourceStartItems(),
  ...governanceGapItems(),
  ...coverageCompletionItems(),
]
  .sort((a, b) => b.score - a.score || priorityRank(a.queue_priority) - priorityRank(b.queue_priority) || a.label.localeCompare(b.label))
  .map((item, index) => ({
    ...item,
    queue_rank: index + 1,
  }));

const summary = {
  queue_item_count: items.length,
  p0_count: count(items, (item) => item.queue_priority === "P0"),
  p1_count: count(items, (item) => item.queue_priority === "P1"),
  p2_count: count(items, (item) => item.queue_priority === "P2"),
  governance_gap_count: count(items, (item) => item.item_type === "governance_gap"),
  source_start_count: count(items, (item) => item.item_type === "source_start"),
  source_recovery_count: count(items, (item) => item.item_type === "source_recovery"),
  coverage_completion_count: count(items, (item) => item.item_type === "coverage_completion"),
  critical_source_count: count(items, (item) => item.source_priority === "critical"),
  blocked_or_browser_needed_count: count(items, (item) => ["blocked_by_host", "browser_shell_detected"].includes(item.automation_status)),
};

const model = {
  generated_at: generatedAt,
  queue_version: "source-acquisition-queue-v1",
  summary,
  queue_items: items,
};

const compact = {
  generated_at: model.generated_at,
  queue_version: model.queue_version,
  summary: model.summary,
  top_queue_items: model.queue_items.slice(0, 50),
};

await writeOrCheck("data/source-acquisition-queue.json", `${JSON.stringify(model, null, 2)}\n`);
await writeOrCheck("data/source-acquisition-queue-summary.json", `${JSON.stringify(compact, null, 2)}\n`);
await writeOrCheck("docs/source-acquisition-queue.md", renderMarkdown(model));

console.log(
  `Source acquisition queue ${CHECK_ONLY ? "checked" : "generated"}: ${summary.queue_item_count} items, ${summary.p0_count} P0, ${summary.source_recovery_count} source recovery.`
);

function sourceRecoveryItems() {
  return sourceDiscoveryMap.rows
    .filter((source) => source.coverage_status === "source_known_blocked" || ["blocked_by_host", "browser_shell_detected"].includes(source.automation_status))
    .map((source) => {
      const registry = sourceRegistryById.get(source.id) || {};
      const score = 92 + priorityBoost(source.priority) + Math.min(8, source.counts.blocked || 0);
      return baseItem({
        id: `source-recovery-${source.id}`,
        item_type: "source_recovery",
        label: `${source.name} mirror recovery`,
        reason: `${source.counts.blocked || 0} registered artifact${source.counts.blocked === 1 ? "" : "s"} blocked or browser-needed.`,
        recommended_action: source.automation_status === "browser_shell_detected" ? "Run browser-assisted source capture and store raw mirrors." : "Capture official source files through browser/manual import fallback.",
        score,
        source,
        registry,
      });
    });
}

function sourceStartItems() {
  return sourceDiscoveryMap.rows
    .filter((source) => source.counts.artifacts === 0)
    .map((source) => {
      const registry = sourceRegistryById.get(source.id) || {};
      const score = 78 + priorityBoost(source.priority) + (source.automation_status === "direct_fetch_ready" ? 6 : 0) + (source.api_key_required ? 3 : 0);
      return baseItem({
        id: `source-start-${source.id}`,
        item_type: "source_start",
        label: `${source.name} initial ingest`,
        reason: "Official source is tracked but has no catalogued artifacts in the repo.",
        recommended_action: source.api_key_required ? "Configure API access or fallback search capture, then seed first source-known artifacts." : "Probe source discovery surface and seed the first official artifacts.",
        score,
        source,
        registry,
      });
    });
}

function governanceGapItems() {
  return coverageMap.rows
    .filter((row) => row.status === "not_started")
    .map((row) => {
      const candidates = sourceCandidates(row).slice(0, 3);
      const source = candidates[0] || {};
      const registry = sourceRegistryById.get(source.id) || {};
      const score = 80 + authorityBoost(row.hierarchy_rank) + Math.max(...candidates.map((candidate) => priorityBoost(candidate.priority)), 0);
      return baseItem({
        id: `governance-gap-${row.id}`,
        item_type: "governance_gap",
        label: `${row.label} coverage gap`,
        reason: `${row.label} has no artifact in the corpus universe.`,
        recommended_action: candidates.length ? `Use ${source.name} to discover and register the first ${row.label} artifact.` : "Identify the authoritative source, then add source discovery metadata and a seed artifact.",
        score,
        source,
        registry,
        governance: row,
        source_candidates: candidates.map(sourceCandidate),
      });
    });
}

function coverageCompletionItems() {
  return coverageMap.rows
    .filter((row) => row.counts.in_repo > 0 && row.status !== "analysis_ready")
    .map((row) => {
      const candidates = sourceCandidates(row).slice(0, 3);
      const source = candidates[0] || {};
      const registry = sourceRegistryById.get(source.id) || {};
      const missing = [
        row.counts.raw < row.counts.in_repo ? "raw mirror" : "",
        row.counts.text < row.counts.in_repo ? "text extraction" : "",
        row.counts.structured < row.counts.in_repo ? "structured summary" : "",
      ].filter(Boolean);
      const score = 74 + authorityBoost(row.hierarchy_rank) + (row.status === "source_known_blocked" ? 8 : 0);
      return baseItem({
        id: `coverage-complete-${row.id}`,
        item_type: "coverage_completion",
        label: `${row.label} completion`,
        reason: `${row.counts.in_repo} artifact${row.counts.in_repo === 1 ? "" : "s"} in repo, missing ${missing.join(", ") || "analysis-ready coverage"}.`,
        recommended_action: row.status === "source_known_blocked" ? "Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary." : "Regenerate missing sidecars until the item is analysis-ready.",
        score,
        source,
        registry,
        governance: row,
        source_candidates: candidates.map(sourceCandidate),
      });
    });
}

function baseItem({ id, item_type, label, reason, recommended_action, score, source = {}, registry = {}, governance = null, source_candidates = [] }) {
  const queue_priority = score >= 96 ? "P0" : score >= 88 ? "P1" : "P2";
  return {
    id,
    item_type,
    label,
    queue_priority,
    score,
    reason,
    recommended_action,
    source_id: source.id || null,
    source_name: source.name || null,
    source_owner: source.source_owner || null,
    source_priority: source.priority || null,
    automation_status: source.automation_status || null,
    coverage_status: source.coverage_status || governance?.status || null,
    capture_strategies: source.capture_strategies || [],
    source_location_types: governance?.source_location_types || source.source_location_types || [],
    source_url: registry.landing_pages?.[0] || null,
    search_url: registry.search_endpoints?.[0] || null,
    api_url: registry.api_endpoints?.[0] || null,
    governance_item_id: governance?.id || null,
    governance_item_label: governance?.label || null,
    hierarchy_rank: governance?.hierarchy_rank || null,
    counts: governance?.counts || source.counts || {},
    artifact_ids: (governance?.artifacts || source.artifacts || []).map((artifact) => artifact.id),
    source_candidates,
  };
}

function sourceCandidates(row) {
  const byId = new Map();
  for (const locationType of row.source_location_types || []) {
    for (const source of sourceRowsByLocation.get(locationType) || []) {
      byId.set(source.id, source);
    }
  }
  return [...byId.values()].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || automationRank(a.automation_status) - automationRank(b.automation_status));
}

function sourceCandidate(source) {
  const registry = sourceRegistryById.get(source.id) || {};
  return {
    id: source.id,
    name: source.name,
    priority: source.priority,
    automation_status: source.automation_status,
    url: registry.landing_pages?.[0] || null,
  };
}

function renderMarkdown(model) {
  const lines = [
    "# Source Acquisition Queue",
    "",
    "Generated from `data/coverage-map.json`, `data/source-discovery-map.json`, and `sources/source-discovery-registry.json`.",
    "",
    "## Summary",
    "",
    `- Queue items: ${model.summary.queue_item_count}`,
    `- P0: ${model.summary.p0_count}`,
    `- P1: ${model.summary.p1_count}`,
    `- P2: ${model.summary.p2_count}`,
    `- Governance gaps: ${model.summary.governance_gap_count}`,
    `- Source starts: ${model.summary.source_start_count}`,
    `- Source recovery: ${model.summary.source_recovery_count}`,
    `- Coverage completion: ${model.summary.coverage_completion_count}`,
    "",
    "## Top Queue",
    "",
    "| Rank | Priority | Type | Item | Source | Automation | Score | Recommended Action |",
    "| ---: | --- | --- | --- | --- | --- | ---: | --- |",
    ...model.queue_items.slice(0, 80).map((item) =>
      `| ${item.queue_rank} | ${item.queue_priority} | ${item.item_type} | ${item.label} | ${item.source_name || "TBD"} | ${item.automation_status || "unknown"} | ${item.score} | ${item.recommended_action} |`
    ),
    "",
  ];
  return `${lines.join("\n")}`;
}

function priorityBoost(priority) {
  if (priority === "critical") return 12;
  if (priority === "high") return 8;
  if (priority === "medium") return 4;
  return 0;
}

function authorityBoost(rank = 999) {
  if (rank <= 20) return 10;
  if (rank <= 50) return 8;
  if (rank <= 75) return 6;
  if (rank <= 85) return 4;
  return 2;
}

function priorityRank(priority) {
  if (priority === "P0" || priority === "critical") return 0;
  if (priority === "P1" || priority === "high") return 1;
  if (priority === "P2" || priority === "medium") return 2;
  return 3;
}

function automationRank(status) {
  if (status === "direct_fetch_ready") return 0;
  if (status === "api_key_required") return 1;
  if (status === "needs_probe") return 2;
  if (status === "browser_shell_detected") return 3;
  if (status === "blocked_by_host") return 4;
  return 5;
}

function count(items, predicate) {
  return items.filter(predicate).length;
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run acquisition`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
