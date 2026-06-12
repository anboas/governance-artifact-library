import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const GENERATED_AT = "2026-06-12T23:25:00.000Z";
const RESOLVER_VERSION = "governance-reference-resolver-v1";
const CATALOGABLE_FAMILIES = new Set(["public-law", "usc", "cfr", "far", "dfars", "executive-order", "omb-memo", "nist-sp", "dodi", "dodd", "secnav", "opnavinst", "navadmin"]);

const manifest = readJson("manifest.json");
const artifacts = manifest.artifacts.map(entry => readJson(entry.path));
const catalog = buildCatalog(artifacts);
const globalEdges = [];
const globalGaps = new Map();
const artifactSummaries = [];
let changed = 0;

for (const artifact of artifacts) {
  const artifactPath = `artifacts/${artifact.id}/artifact.json`;
  const referenceMapPath = `artifacts/${artifact.id}/references/reference-map.json`;
  const referenceMap = buildReferenceMap(artifact, referenceMapPath, catalog);
  changed += writeIfChanged(referenceMapPath, `${JSON.stringify(referenceMap, null, 2)}\n`);

  referenceMap.resolved_references.forEach(edge => globalEdges.push({ source_artifact_id: artifact.id, ...edge }));
  referenceMap.uncatalogued_references.forEach(gap => {
    const key = canonicalReferenceKey(gap);
    const existing = globalGaps.get(key) || { ...gap, source_artifact_ids: [], total_count: 0 };
    existing.total_count += gap.count || 0;
    if (!existing.source_artifact_ids.includes(artifact.id)) existing.source_artifact_ids.push(artifact.id);
    globalGaps.set(key, existing);
  });
  artifactSummaries.push({ artifact_id: artifact.id, title: artifact.title, ...referenceMap.summary });

  if (artifact.reference_resolution_path !== referenceMapPath || !artifact.analytic_lanes?.includes("reference_resolution")) {
    const next = {
      ...artifact,
      reference_resolution_path: referenceMapPath,
      analytic_lanes: unique([...(artifact.analytic_lanes || []), "reference_resolution", "catalog_gap_detection"]),
    };
    changed += writeIfChanged(artifactPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

const coverageMap = {
  generated_at: GENERATED_AT,
  resolver_version: RESOLVER_VERSION,
  artifact_count: artifacts.length,
  summary: {
    resolved_reference_edges: globalEdges.length,
    uncatalogued_reference_count: globalGaps.size,
    artifacts_with_uncatalogued_references: artifactSummaries.filter(item => item.uncatalogued_reference_count > 0).length,
  },
  artifact_summaries: artifactSummaries,
  cataloged_reference_edges: globalEdges.sort((a, b) => a.source_artifact_id.localeCompare(b.source_artifact_id) || a.target_artifact_id.localeCompare(b.target_artifact_id)),
  uncatalogued_references: [...globalGaps.values()].sort((a, b) => b.total_count - a.total_count || a.label.localeCompare(b.label)),
};
changed += writeIfChanged("data/reference-coverage-map.json", `${JSON.stringify(coverageMap, null, 2)}\n`);
changed += writeIfChanged("docs/reference-coverage-map.md", renderReferenceCoverageMarkdown(coverageMap));

if (CHECK && changed) {
  throw new Error(`Reference maps are stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} reference maps for ${artifacts.length} artifacts; ${coverageMap.summary.uncatalogued_reference_count} uncatalogued references.`);

function buildReferenceMap(artifact, referenceMapPath, catalog) {
  const extraction = artifact.extraction_path && existsSync(join(ROOT, artifact.extraction_path))
    ? readJson(artifact.extraction_path)
    : { references: [], extraction_status: "source_text_unavailable" };
  const references = mergeReferences((extraction.references || []).filter(ref => CATALOGABLE_FAMILIES.has(ref.reference_family)));
  const resolved = [];
  const unresolved = [];

  for (const ref of references) {
    const target = resolveReference(ref, catalog);
    const base = {
      source_reference_id: ref.id,
      label: ref.label,
      type: ref.type,
      reference_family: ref.reference_family,
      count: ref.count || 0,
      first_line: ref.first_line || null,
      lines_sample: ref.lines_sample || [],
    };
    if (target) {
      resolved.push({
        ...base,
        target_artifact_id: target.id,
        target_title: target.title,
        target_path: `artifacts/${target.id}/artifact.json`,
        relationship: target.id === artifact.id ? "references_self" : "references",
        confidence: target.confidence,
      });
    } else {
      unresolved.push({
        ...base,
        coverage_gap: true,
        suggested_catalog_key: suggestedCatalogKey(ref),
        priority: priorityForReference(ref),
      });
    }
  }

  const targetIds = unique(resolved.map(item => item.target_artifact_id));
  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    resolver_version: RESOLVER_VERSION,
    extraction_path: artifact.extraction_path || null,
    reference_resolution_path: referenceMapPath,
    summary: {
      total_catalogable_reference_count: references.length,
      resolved_reference_count: resolved.length,
      uncatalogued_reference_count: unresolved.length,
      resolved_occurrence_count: resolved.reduce((sum, item) => sum + item.count, 0),
      uncatalogued_occurrence_count: unresolved.reduce((sum, item) => sum + item.count, 0),
      cataloged_target_count: targetIds.length,
    },
    resolved_references: resolved.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    uncatalogued_references: unresolved.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
}

function buildCatalog(artifacts) {
  const aliases = new Map();
  for (const artifact of artifacts) {
    const candidates = aliasCandidates(artifact);
    for (const candidate of candidates) {
      aliases.set(normalizeKey(candidate), { id: artifact.id, title: artifact.title, confidence: 0.94 });
    }
  }
  return aliases;
}

function aliasCandidates(artifact) {
  const values = [artifact.id, artifact.title, artifact.short_title].filter(Boolean);
  const id = artifact.id || "";
  const title = `${artifact.title || ""} ${artifact.short_title || ""}`;
  const push = value => { if (value) values.push(value); };

  const publicLaw = id.match(/pl-(\d+)-(\d+)/);
  if (publicLaw) {
    push(`Public Law ${publicLaw[1]}-${publicLaw[2]}`);
    push(`PL ${publicLaw[1]}-${publicLaw[2]}`);
  }
  const usc = id.match(/usc-title-(\d+)-section-(\d+)/);
  if (usc) {
    push(`${usc[1]} U.S.C. ${usc[2]}`);
    push(`${usc[1]} USC ${usc[2]}`);
  }
  const eo = id.match(/eo-(\d+)/);
  if (eo) push(`Executive Order ${eo[1]}`);
  const omb = id.match(/omb-m-(\d+)-(\d+)/);
  if (omb) push(`OMB M-${omb[1]}-${omb[2]}`);
  const nist = id.match(/nist-sp-(\d+)-(\d+)/);
  if (nist) push(`NIST SP ${nist[1]}-${nist[2]}`);
  const far = id.match(/far-part-(\d+)/);
  if (far) push(`FAR part ${far[1]}`);
  const dodi = id.match(/dodi-(\d+)-(\d+)/);
  if (dodi) push(`DoDI ${dodi[1]}.${dodi[2]}`);
  const dodd = id.match(/dodd-(\d+)-(\d+)/);
  if (dodd) push(`DoDD ${dodd[1]}.${dodd[2]}`);
  const navadmin = id.match(/navadmin-(\d+)-(\d+)/);
  if (navadmin) push(`NAVADMIN ${Number(navadmin[1])}/${navadmin[2]}`);
  const opnav = id.match(/opnavinst-(\d+)-(\d+)([a-z])?/);
  if (opnav) push(`OPNAVINST ${opnav[1]}.${opnav[2]}${(opnav[3] || "").toUpperCase()}`);
  const secnavManual = id.match(/secnav-m-(\d+)-(\d+)/);
  if (secnavManual) {
    push(`SECNAV M ${secnavManual[1]}.${secnavManual[2]}`);
    push(`SECNAV Manual ${secnavManual[1]}.${secnavManual[2]}`);
  }
  for (const match of title.matchAll(/\b(?:DoDI|DoDD)\s+\d{4}\.\d{2}\b/gi)) push(match[0]);
  for (const match of title.matchAll(/\bNIST\s+SP\s+\d{3}-\d+\b/gi)) push(match[0]);
  return unique(values);
}

function resolveReference(ref, catalog) {
  const candidates = [ref.label];
  if (ref.reference_family === "usc") candidates.push(ref.label.replace(/\bU\.?S\.?C\.?\b/i, "USC"));
  if (ref.reference_family === "public-law") candidates.push(ref.label.replace(/^Public Law/i, "PL"));
  for (const candidate of candidates) {
    const target = catalog.get(normalizeKey(candidate));
    if (target) return target;
  }
  return null;
}

function suggestedCatalogKey(ref) {
  return canonicalReferenceKey(ref);
}

function priorityForReference(ref) {
  if (["public-law", "usc", "executive-order", "omb-memo", "dodi", "dodd"].includes(ref.reference_family)) return "high";
  if ((ref.count || 0) >= 5) return "medium";
  return "low";
}

function renderReferenceCoverageMarkdown(map) {
  const lines = [
    "# Reference Coverage Map",
    "",
    `Generated: ${map.generated_at}`,
    "",
    `- Artifacts: ${map.artifact_count}`,
    `- Resolved reference edges: ${map.summary.resolved_reference_edges}`,
    `- Uncatalogued references: ${map.summary.uncatalogued_reference_count}`,
    `- Artifacts with uncatalogued references: ${map.summary.artifacts_with_uncatalogued_references}`,
    "",
    "## Artifact Summary",
    "",
    "| Artifact | Resolved | Uncatalogued | Targets |",
    "| --- | ---: | ---: | ---: |",
    ...map.artifact_summaries.map(item => `| ${item.artifact_id} | ${item.resolved_reference_count} | ${item.uncatalogued_reference_count} | ${item.cataloged_target_count} |`),
    "",
    "## Top Uncatalogued References",
    "",
    "| Reference | Family | Occurrences | Sources | Priority |",
    "| --- | --- | ---: | ---: | --- |",
    ...map.uncatalogued_references.slice(0, 80).map(item => `| ${item.label} | ${item.reference_family} | ${item.total_count} | ${item.source_artifact_ids.length} | ${item.priority} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/§/g, " section ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function mergeReferences(references) {
  const merged = new Map();
  for (const ref of references) {
    const key = canonicalReferenceKey(ref);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...ref,
        id: key,
        source_reference_ids: [ref.id],
        alias_labels: [ref.label],
        lines_sample: [...(ref.lines_sample || [])],
      });
      continue;
    }
    existing.count = (existing.count || 0) + (ref.count || 0);
    existing.first_line = Math.min(existing.first_line || Number.MAX_SAFE_INTEGER, ref.first_line || Number.MAX_SAFE_INTEGER);
    existing.source_reference_ids = unique([...existing.source_reference_ids, ref.id]);
    existing.alias_labels = unique([...existing.alias_labels, ref.label]);
    existing.lines_sample = unique([...(existing.lines_sample || []), ...(ref.lines_sample || [])]).sort((a, b) => a - b).slice(0, 12);
    existing.label = preferredLabel(existing.alias_labels);
  }
  return [...merged.values()].map(ref => ({
    ...ref,
    first_line: ref.first_line === Number.MAX_SAFE_INTEGER ? null : ref.first_line,
  }));
}

function canonicalReferenceKey(ref) {
  const label = String(ref.label || "");
  const normalized = normalizeKey(label);

  const usc = normalized.match(/^(\d+)\s+u\s*s\s*c\s+(?:section\s+)?([a-z0-9.-]+)$/i) || normalized.match(/^(\d+)\s+usc\s+(?:section\s+)?([a-z0-9.-]+)$/i);
  if (ref.reference_family === "usc" && usc) return `usc:${usc[1]}:${usc[2]}`;

  const cfr = normalized.match(/^(\d+)\s+cfr\s+([a-z0-9.-]+)$/i);
  if (ref.reference_family === "cfr" && cfr) return `cfr:${cfr[1]}:${cfr[2]}`;

  const publicLaw = normalized.match(/^(?:public law|pl)\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "public-law" && publicLaw) return `public-law:${publicLaw[1]}-${publicLaw[2]}`;

  const eo = normalized.match(/^(?:executive order|eo)\s+(\d+)$/i);
  if (ref.reference_family === "executive-order" && eo) return `executive-order:${eo[1]}`;

  const omb = normalized.match(/^omb\s+m\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "omb-memo" && omb) return `omb-memo:m-${omb[1]}-${omb[2]}`;

  const nist = normalized.match(/^nist\s+sp\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/i);
  if (ref.reference_family === "nist-sp" && nist) return `nist-sp:${nist[1]}-${nist[2]}${nist[3] ? `-${nist[3]}` : ""}`;

  const far = normalized.match(/^far\s+(?:part\s+)?(\d+[a-z0-9.-]*)$/i);
  if (ref.reference_family === "far" && far) return `far:part-${far[1]}`;

  const dfars = normalized.match(/^dfars\s+(?:part\s+)?(\d+[a-z0-9.-]*)$/i);
  if (ref.reference_family === "dfars" && dfars) return `dfars:part-${dfars[1]}`;

  const dodi = normalized.match(/^dodi\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "dodi" && dodi) return `dodi:${dodi[1]}.${dodi[2]}`;

  const dodd = normalized.match(/^dodd\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "dodd" && dodd) return `dodd:${dodd[1]}.${dodd[2]}`;

  const secnav = normalized.match(/^secnav\s+(?:m|manual)\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "secnav" && secnav) return `secnav:m-${secnav[1]}.${secnav[2]}`;

  const opnav = normalized.match(/^opnavinst\s+(\d+)\s+(\d+)([a-z])?$/i);
  if (ref.reference_family === "opnavinst" && opnav) return `opnavinst:${opnav[1]}.${opnav[2]}${opnav[3] || ""}`;

  const navadmin = normalized.match(/^navadmin\s+(\d+)\s+(\d+)$/i);
  if (ref.reference_family === "navadmin" && navadmin) return `navadmin:${Number(navadmin[1])}/${navadmin[2]}`;

  return `${ref.reference_family}:${normalized}`;
}

function preferredLabel(labels) {
  return [...labels].sort((a, b) => labelScore(b) - labelScore(a) || a.localeCompare(b))[0];
}

function labelScore(label) {
  let score = 0;
  if (/[A-Z]/.test(label)) score += 1;
  if (label.includes(".")) score += 1;
  if (label.includes("§")) score += 1;
  if (/\bPublic Law\b/.test(label)) score += 1;
  if (/\bExecutive Order\b/.test(label)) score += 1;
  return score;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

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
