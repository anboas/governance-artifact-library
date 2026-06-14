import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");
const READING_WPM = 225;

const manifest = readJson("manifest.json");
const generatedAt = manifest.generated_at;

const rows = manifest.artifacts.map((entry) => {
  const artifact = readJson(entry.path);
  const metrics = artifact.analytics_path && existsSync(join(ROOT, artifact.analytics_path))
    ? readJson(artifact.analytics_path)
    : {};
  const words = Number(metrics.extracted_word_count || 0) || 0;
  const pages = Number(metrics.approximate_pages || 0) || 0;
  const obligationSignals = Number(metrics.obligation_signal_count || 0) || 0;
  const implementationSignals = Number(metrics.implementation_signal_count || 0) || 0;
  const termCounts = metrics.term_counts || {};
  const termSignalCount = Object.values(termCounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const readingMinutes = words ? Math.ceil(words / READING_WPM) : 0;
  const complexityScore = complexityFor({ words, pages, obligationSignals, implementationSignals, termSignalCount });
  return {
    id: artifact.id,
    title: artifact.title,
    short_title: artifact.short_title || artifact.title,
    artifact_type: artifact.artifact_type,
    family: artifact.family,
    authority_level: artifact.authority_level,
    issuing_authority: artifact.issuing_authority,
    issuing_organization: artifact.issuing_organization,
    source_system: artifact.source_system || artifact.issuing_organization || "Unknown",
    source_location_type: artifact.source_location_type || "unknown",
    mirror_status: artifact.mirror_status || "unknown",
    pipeline_state: artifact.pipeline_state || "unknown",
    review_status: artifact.review_status || "unknown",
    has_text: Boolean(artifact.extracted_text_path),
    has_metrics: Boolean(artifact.analytics_path && Object.keys(metrics).length),
    extracted_word_count: words,
    approximate_pages: pages,
    line_count: Number(metrics.line_count || 0) || 0,
    reading_time_minutes: readingMinutes,
    reading_time_bucket: readingTimeBucket(readingMinutes),
    complexity_score: complexityScore,
    complexity_bucket: complexityBucket(complexityScore),
    obligation_signal_count: obligationSignals,
    implementation_signal_count: implementationSignals,
    term_signal_count: termSignalCount,
    term_counts: termCounts,
  };
});

const model = {
  generated_at: generatedAt,
  analytics_version: "governance-document-analytics-v1",
  reading_words_per_minute: READING_WPM,
  summary: {
    artifact_count: rows.length,
    metrics_artifacts: count(rows, (row) => row.has_metrics),
    text_artifacts: count(rows, (row) => row.has_text),
    total_word_count: sum(rows, "extracted_word_count"),
    total_pages: sum(rows, "approximate_pages"),
    total_reading_minutes: sum(rows, "reading_time_minutes"),
    average_reading_minutes: average(rows, "reading_time_minutes"),
    median_reading_minutes: median(rows.map((row) => row.reading_time_minutes)),
    average_complexity_score: average(rows, "complexity_score"),
    median_complexity_score: median(rows.map((row) => row.complexity_score)),
    obligation_signal_count: sum(rows, "obligation_signal_count"),
    implementation_signal_count: sum(rows, "implementation_signal_count"),
  },
  by_source_system: groupRows(rows, "source_system"),
  by_artifact_type: groupRows(rows, "artifact_type"),
  by_authority_level: groupRows(rows, "authority_level"),
  by_family: groupRows(rows, "family"),
  reading_time_buckets: bucketRows(rows, "reading_time_bucket", [
    "No Text",
    "Under 5 min",
    "5-15 min",
    "15-45 min",
    "45-120 min",
    "2+ hours",
  ]),
  complexity_buckets: bucketRows(rows, "complexity_bucket", [
    "No Text",
    "Quick Scan",
    "Moderate",
    "Dense",
    "Complex",
    "Extreme",
  ]),
  term_heatmap: termHeatmap(rows),
  longest_artifacts: [...rows]
    .filter((row) => row.reading_time_minutes > 0)
    .sort((a, b) => b.reading_time_minutes - a.reading_time_minutes || a.short_title.localeCompare(b.short_title))
    .slice(0, 40)
    .map(compactRow),
  rows: rows.map(compactRow),
};

const markdown = renderMarkdown(model);
await writeOrCheck("data/document-analytics-map.json", `${JSON.stringify(model, null, 2)}\n`);
await writeOrCheck("docs/document-analytics-map.md", markdown);

console.log(
  `Document analytics map ${CHECK_ONLY ? "checked" : "generated"}: ${model.summary.metrics_artifacts}/${model.summary.artifact_count} metrics sidecars, ${model.summary.total_word_count.toLocaleString()} words.`
);

function complexityFor({ words, pages, obligationSignals, implementationSignals, termSignalCount }) {
  if (!words) return 0;
  const lengthScore = Math.min(42, Math.log10(words + 1) * 13);
  const pageDensity = pages ? words / Math.max(1, pages) : words / 450;
  const densityScore = Math.min(20, pageDensity / 45);
  const obligationDensity = (obligationSignals + implementationSignals) / Math.max(1, words / 1000);
  const obligationScore = Math.min(24, obligationDensity * 3.5);
  const termDensity = termSignalCount / Math.max(1, words / 1000);
  const termScore = Math.min(14, termDensity * 0.9);
  return Math.max(1, Math.round(lengthScore + densityScore + obligationScore + termScore));
}

function complexityBucket(score) {
  if (!score) return "No Text";
  if (score < 35) return "Quick Scan";
  if (score < 50) return "Moderate";
  if (score < 65) return "Dense";
  if (score < 80) return "Complex";
  return "Extreme";
}

function readingTimeBucket(minutes) {
  if (!minutes) return "No Text";
  if (minutes < 5) return "Under 5 min";
  if (minutes <= 15) return "5-15 min";
  if (minutes <= 45) return "15-45 min";
  if (minutes <= 120) return "45-120 min";
  return "2+ hours";
}

function compactRow(row) {
  return {
    id: row.id,
    title: row.title,
    short_title: row.short_title,
    artifact_type: row.artifact_type,
    family: row.family,
    authority_level: row.authority_level,
    source_system: row.source_system,
    mirror_status: row.mirror_status,
    pipeline_state: row.pipeline_state,
    extracted_word_count: row.extracted_word_count,
    approximate_pages: row.approximate_pages,
    reading_time_minutes: row.reading_time_minutes,
    reading_time_bucket: row.reading_time_bucket,
    complexity_score: row.complexity_score,
    complexity_bucket: row.complexity_bucket,
    obligation_signal_count: row.obligation_signal_count,
    implementation_signal_count: row.implementation_signal_count,
  };
}

function groupRows(sourceRows, field) {
  const groups = new Map();
  sourceRows.forEach((row) => {
    const label = row[field] || "Unknown";
    const group = groups.get(label) || {
      key: label,
      label,
      count: 0,
      word_count: 0,
      pages: 0,
      reading_minutes: 0,
      average_complexity_score: 0,
      obligation_signal_count: 0,
      implementation_signal_count: 0,
    };
    group.count += 1;
    group.word_count += row.extracted_word_count;
    group.pages += row.approximate_pages;
    group.reading_minutes += row.reading_time_minutes;
    group.obligation_signal_count += row.obligation_signal_count;
    group.implementation_signal_count += row.implementation_signal_count;
    groups.set(label, group);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      average_complexity_score: average(sourceRows.filter((row) => (row[field] || "Unknown") === group.label), "complexity_score"),
    }))
    .sort((a, b) => b.count - a.count || b.reading_minutes - a.reading_minutes || a.label.localeCompare(b.label));
}

function bucketRows(sourceRows, field, order) {
  const groups = new Map(order.map((label) => [label, {
    key: label,
    label,
    count: 0,
    word_count: 0,
    reading_minutes: 0,
    average_complexity_score: 0,
  }]));
  sourceRows.forEach((row) => {
    const label = row[field] || "Unknown";
    const group = groups.get(label) || { key: label, label, count: 0, word_count: 0, reading_minutes: 0, average_complexity_score: 0 };
    group.count += 1;
    group.word_count += row.extracted_word_count;
    group.reading_minutes += row.reading_time_minutes;
    groups.set(label, group);
  });
  return [...groups.values()]
    .map((group) => ({
      ...group,
      average_complexity_score: group.count
        ? average(sourceRows.filter((row) => (row[field] || "Unknown") === group.label), "complexity_score")
        : 0,
    }))
    .filter((group) => group.count > 0);
}

function termHeatmap(sourceRows) {
  const totals = new Map();
  sourceRows.forEach((row) => {
    Object.entries(row.term_counts || {}).forEach(([term, value]) => {
      totals.set(term, (totals.get(term) || 0) + (Number(value) || 0));
    });
  });
  return [...totals.entries()]
    .map(([term, count]) => ({ term, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 24);
}

function renderMarkdown(map) {
  return [
    "# Governance Document Analytics Map",
    "",
    "Generated from artifact records and per-artifact `analytics/document-metrics.json` sidecars.",
    "",
    "## Summary",
    "",
    `- Artifacts: ${map.summary.artifact_count}`,
    `- Metrics sidecars: ${map.summary.metrics_artifacts}`,
    `- Extracted words: ${map.summary.total_word_count.toLocaleString()}`,
    `- Approximate pages: ${map.summary.total_pages.toLocaleString()}`,
    `- Reading workload: ${map.summary.total_reading_minutes.toLocaleString()} minutes at ${map.reading_words_per_minute} wpm`,
    `- Median read time: ${map.summary.median_reading_minutes} minutes`,
    `- Median complexity: ${map.summary.median_complexity_score}`,
    "",
    "## Reading Time Buckets",
    "",
    "| Bucket | Artifacts | Words | Reading Minutes | Avg Complexity |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...map.reading_time_buckets.map((row) => `| ${row.label} | ${row.count} | ${row.word_count.toLocaleString()} | ${row.reading_minutes.toLocaleString()} | ${row.average_complexity_score} |`),
    "",
    "## Complexity Buckets",
    "",
    "| Bucket | Artifacts | Words | Reading Minutes | Avg Complexity |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...map.complexity_buckets.map((row) => `| ${row.label} | ${row.count} | ${row.word_count.toLocaleString()} | ${row.reading_minutes.toLocaleString()} | ${row.average_complexity_score} |`),
    "",
    "## Top Source Systems",
    "",
    "| Source | Artifacts | Words | Reading Minutes | Avg Complexity |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...map.by_source_system.slice(0, 20).map((row) => `| ${row.label} | ${row.count} | ${row.word_count.toLocaleString()} | ${row.reading_minutes.toLocaleString()} | ${row.average_complexity_score} |`),
    "",
  ].join("\n");
}

function sum(sourceRows, field) {
  return sourceRows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
}

function count(sourceRows, predicate) {
  return sourceRows.filter(predicate).length;
}

function average(sourceRows, field) {
  const values = sourceRows.map((row) => Number(row[field]) || 0).filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function median(values) {
  const sorted = values.map((value) => Number(value) || 0).filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run analytics`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}
