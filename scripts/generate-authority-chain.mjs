import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const GENERATED_AT = "2026-06-13T13:55:00.000Z";
const CHAIN_VERSION = "governance-authority-chain-v1";

const LANES = [
  { id: "law", label: "Law", meta: "Public law / NDAA", minRank: 0, maxRank: 19 },
  { id: "statute", label: "Statute", meta: "U.S. Code / statutory note", minRank: 20, maxRank: 29 },
  { id: "executive", label: "Executive", meta: "Executive order / presidential directive", minRank: 30, maxRank: 39 },
  { id: "govwide", label: "Gov-wide", meta: "OMB / NIST / CFR / FAR", minRank: 40, maxRank: 69 },
  { id: "dod", label: "DoD", meta: "DoDD / DoDI / DoDM / strategy", minRank: 70, maxRank: 79 },
  { id: "service", label: "Service", meta: "SECNAV / OPNAV / service pubs", minRank: 80, maxRank: 84 },
  { id: "echelon2", label: "Echelon 2", meta: "component / program implementation", minRank: 85, maxRank: 89 },
  { id: "echelon4", label: "Echelon 3-4", meta: "operational guidance / SOP / evidence", minRank: 90, maxRank: 100 },
];

const manifest = readJson("manifest.json");
const artifacts = manifest.artifacts.map(entry => readJson(entry.path));
const artifactsById = new Map(artifacts.map(artifact => [artifact.id, artifact]));
const referenceMaps = new Map(artifacts.map(artifact => {
  const path = artifact.reference_resolution_path || `artifacts/${artifact.id}/references/reference-map.json`;
  return [artifact.id, existsSync(join(ROOT, path)) ? readJson(path) : { resolved_references: [], uncatalogued_references: [] }];
}));

const reverseResolved = new Map();
for (const [sourceId, referenceMap] of referenceMaps) {
  for (const edge of referenceMap.resolved_references || []) {
    if (!edge.target_artifact_id || edge.target_artifact_id === sourceId) continue;
    const bucket = reverseResolved.get(edge.target_artifact_id) || [];
    bucket.push({ source_artifact_id: sourceId, ...edge });
    reverseResolved.set(edge.target_artifact_id, bucket);
  }
}

const inferredEdges = inferFlowdownEdges(artifacts);
const globalNodes = artifacts.map(artifact => authorityNode(artifact, "catalogued"));
const globalEdges = [
  ...resolvedGlobalEdges(referenceMaps),
  ...inferredEdges,
].sort(edgeSort);

const globalMap = {
  generated_at: GENERATED_AT,
  authority_chain_version: CHAIN_VERSION,
  artifact_count: artifacts.length,
  lanes: LANES.map(({ id, label, meta }) => ({ id, label, meta })),
  summary: {
    node_count: globalNodes.length,
    edge_count: globalEdges.length,
    resolved_reference_edge_count: globalEdges.filter(edge => edge.evidence_type === "resolved_reference").length,
    inferred_flowdown_edge_count: globalEdges.filter(edge => edge.evidence_type === "inferred_flowdown").length,
    artifacts_with_upstream_authority: artifacts.filter(artifact => upstreamEdgesFor(artifact).length > 0).length,
    artifacts_with_downstream_implementation: artifacts.filter(artifact => downstreamEdgesFor(artifact).length > 0).length,
  },
  nodes: globalNodes,
  edges: globalEdges,
};

let changed = 0;
const artifactSummaries = [];
for (const artifact of artifacts) {
  const artifactPath = `artifacts/${artifact.id}/artifact.json`;
  const chainPath = `artifacts/${artifact.id}/authority/authority-chain.json`;
  const chain = buildArtifactChain(artifact, chainPath);
  artifactSummaries.push({ artifact_id: artifact.id, title: artifact.title, ...chain.summary });
  changed += writeIfChanged(chainPath, `${JSON.stringify(chain, null, 2)}\n`);

  if (artifact.authority_chain_path !== chainPath || !artifact.analytic_lanes?.includes("authority_chain")) {
    const next = {
      ...artifact,
      authority_chain_path: chainPath,
      analytic_lanes: unique([...(artifact.analytic_lanes || []), "authority_chain", "upstream_downstream_trace"]),
    };
    changed += writeIfChanged(artifactPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

globalMap.artifact_summaries = artifactSummaries;
changed += writeIfChanged("data/authority-chain-map.json", `${JSON.stringify(globalMap, null, 2)}\n`);
changed += writeIfChanged("docs/authority-chain-map.md", renderAuthorityChainMarkdown(globalMap));

if (CHECK && changed) {
  throw new Error(`Authority chain maps are stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} authority chains for ${artifacts.length} artifacts; ${globalMap.summary.edge_count} global edges.`);

function buildArtifactChain(artifact, chainPath) {
  const upstreamEdges = upstreamEdgesFor(artifact);
  const downstreamEdges = downstreamEdgesFor(artifact);
  const gapNodes = uncataloguedAuthorityGaps(artifact);
  const nodeIds = new Set([artifact.id]);
  upstreamEdges.forEach(edge => {
    nodeIds.add(edge.source_artifact_id);
    nodeIds.add(edge.target_artifact_id);
  });
  downstreamEdges.forEach(edge => {
    nodeIds.add(edge.source_artifact_id);
    nodeIds.add(edge.target_artifact_id);
  });

  const catalogNodes = [...nodeIds]
    .map(id => artifactsById.get(id))
    .filter(Boolean)
    .map(item => authorityNode(item, item.id === artifact.id ? "current" : "catalogued"));
  const nodes = [...catalogNodes, ...gapNodes];
  const edges = [...upstreamEdges, ...downstreamEdges].sort(edgeSort);

  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    authority_chain_version: CHAIN_VERSION,
    authority_chain_path: chainPath,
    source_artifact: authorityNode(artifact, "current"),
    lanes: LANES.map(({ id, label, meta }) => ({ id, label, meta })),
    summary: {
      upstream_edge_count: upstreamEdges.length,
      downstream_edge_count: downstreamEdges.length,
      catalogued_node_count: catalogNodes.length,
      uncatalogued_gap_count: gapNodes.length,
      evidence_backed_edge_count: edges.filter(edge => edge.evidence_type === "resolved_reference").length,
      inferred_edge_count: edges.filter(edge => edge.evidence_type === "inferred_flowdown").length,
      authority_path_status: authorityPathStatus(artifact, upstreamEdges),
      implementation_path_status: downstreamEdges.length ? "has_downstream_trace" : "no_downstream_trace_yet",
    },
    nodes: nodes.sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.label.localeCompare(b.label)),
    upstream_edges: upstreamEdges,
    downstream_edges: downstreamEdges,
    uncatalogued_authority_gaps: gapNodes,
    trace_playbooks: [
      {
        id: "trace-upstream",
        label: "Trace upstream to controlling authority",
        start_artifact_id: artifact.id,
        direction: "upstream",
        edge_count: upstreamEdges.length,
      },
      {
        id: "trace-downstream",
        label: "Trace downstream to implementation and evidence",
        start_artifact_id: artifact.id,
        direction: "downstream",
        edge_count: downstreamEdges.length,
      },
    ],
  };
}

function upstreamEdgesFor(artifact) {
  const referenceMap = referenceMaps.get(artifact.id) || {};
  const resolved = (referenceMap.resolved_references || [])
    .filter(edge => edge.target_artifact_id && edge.target_artifact_id !== artifact.id)
    .map(edge => {
      const target = artifactsById.get(edge.target_artifact_id);
      return authorityEdge({
        source: target,
        target: artifact,
        relationship: relationshipForResolvedReference(target, artifact, edge),
        evidenceType: "resolved_reference",
        confidence: edge.confidence || 0.9,
        evidence: {
          source_reference_id: edge.source_reference_id,
          label: edge.label,
          first_line: edge.first_line || null,
          lines_sample: edge.lines_sample || [],
          count: edge.count || 0,
        },
      });
    });
  const inferred = inferredEdges
    .filter(edge => edge.target_artifact_id === artifact.id)
    .map(edge => ({ ...edge, direction: "upstream" }));
  return uniqueEdges([...resolved, ...inferred]);
}

function downstreamEdgesFor(artifact) {
  const resolved = (reverseResolved.get(artifact.id) || [])
    .filter(edge => edge.source_artifact_id !== artifact.id)
    .map(edge => {
      const source = artifactsById.get(edge.source_artifact_id);
      return authorityEdge({
        source: artifact,
        target: source,
        relationship: relationshipForResolvedReference(artifact, source, edge),
        evidenceType: "resolved_reference",
        confidence: edge.confidence || 0.9,
        evidence: {
          source_reference_id: edge.source_reference_id,
          label: edge.label,
          first_line: edge.first_line || null,
          lines_sample: edge.lines_sample || [],
          count: edge.count || 0,
        },
      });
    });
  const inferred = inferredEdges
    .filter(edge => edge.source_artifact_id === artifact.id)
    .map(edge => ({ ...edge, direction: "downstream" }));
  return uniqueEdges([...resolved, ...inferred]);
}

function resolvedGlobalEdges(referenceMaps) {
  const edges = [];
  for (const [sourceId, referenceMap] of referenceMaps) {
    const source = artifactsById.get(sourceId);
    for (const edge of referenceMap.resolved_references || []) {
      const target = artifactsById.get(edge.target_artifact_id);
      if (!source || !target || source.id === target.id) continue;
      const upstream = target.hierarchy_rank <= source.hierarchy_rank ? target : source;
      const downstream = target.hierarchy_rank <= source.hierarchy_rank ? source : target;
      edges.push(authorityEdge({
        source: upstream,
        target: downstream,
        relationship: relationshipForResolvedReference(upstream, downstream, edge),
        evidenceType: "resolved_reference",
        confidence: edge.confidence || 0.9,
        evidence: {
          source_artifact_id: sourceId,
          source_reference_id: edge.source_reference_id,
          label: edge.label,
          first_line: edge.first_line || null,
          lines_sample: edge.lines_sample || [],
          count: edge.count || 0,
        },
      }));
    }
  }
  return uniqueEdges(edges);
}

function inferFlowdownEdges(items) {
  const edges = [];
  for (const source of items) {
    const candidates = items
      .filter(target => target.id !== source.id && target.hierarchy_rank > source.hierarchy_rank)
      .map(target => ({ target, score: flowdownScore(source, target) }))
      .filter(item => item.score >= 2)
      .sort((a, b) => b.score - a.score || a.target.hierarchy_rank - b.target.hierarchy_rank || a.target.id.localeCompare(b.target.id))
      .slice(0, 4);
    for (const { target, score } of candidates) {
      edges.push(authorityEdge({
        source,
        target,
        relationship: relationshipForRanks(source, target),
        evidenceType: "inferred_flowdown",
        confidence: Math.min(0.78, 0.45 + score * 0.07),
        evidence: {
          basis: "shared_family_tags_and_authority_rank",
          shared_tags: sharedTags(source, target),
          shared_family: source.family === target.family ? source.family : "",
        },
      }));
    }
  }
  return uniqueEdges(edges);
}

function flowdownScore(source, target) {
  let score = 0;
  if (source.family && source.family === target.family) score += 3;
  const shared = sharedTags(source, target);
  score += Math.min(3, shared.length);
  const rankDelta = target.hierarchy_rank - source.hierarchy_rank;
  if (rankDelta > 0 && rankDelta <= 20) score += 1;
  if (target.issuing_authority === source.issuing_authority) score += 1;
  if (source.authority_level === "law" && target.authority_level === "us_code") score += 1;
  return score;
}

function authorityNode(artifact, status) {
  return {
    id: artifact.id,
    label: artifact.short_title || artifact.title,
    title: artifact.title,
    artifact_type: artifact.artifact_type,
    lane: laneForArtifact(artifact).id,
    lane_label: laneForArtifact(artifact).label,
    hierarchy_rank: artifact.hierarchy_rank,
    family: artifact.family,
    issuing_authority: artifact.issuing_authority,
    source_system: artifact.source_system,
    mirror_status: artifact.mirror_status,
    parser_status: artifact.parser_status,
    status,
  };
}

function authorityGapNode(ref) {
  const rank = inferredRankForReference(ref);
  const lane = laneForRank(rank);
  return {
    id: `gap:${ref.suggested_catalog_key || ref.source_reference_id}`,
    label: ref.label,
    title: ref.label,
    artifact_type: ref.type,
    lane: lane.id,
    lane_label: lane.label,
    hierarchy_rank: rank,
    reference_family: ref.reference_family,
    source_reference_id: ref.source_reference_id,
    count: ref.count || 0,
    lines_sample: ref.lines_sample || [],
    status: "uncatalogued",
    priority: ref.priority || "open",
  };
}

function uncataloguedAuthorityGaps(artifact) {
  const referenceMap = referenceMaps.get(artifact.id) || {};
  return (referenceMap.uncatalogued_references || [])
    .filter(ref => ["high", "medium"].includes(ref.priority) || (ref.count || 0) > 1)
    .slice(0, 18)
    .map(authorityGapNode);
}

function authorityEdge({ source, target, relationship, evidenceType, confidence, evidence }) {
  return {
    id: `${source.id}->${target.id}:${relationship}:${evidenceType}`,
    source_artifact_id: source.id,
    source_label: source.short_title || source.title,
    source_lane: laneForArtifact(source).id,
    target_artifact_id: target.id,
    target_label: target.short_title || target.title,
    target_lane: laneForArtifact(target).id,
    relationship,
    evidence_type: evidenceType,
    confidence: Number(confidence.toFixed(2)),
    direction: "downstream",
    evidence,
  };
}

function relationshipForResolvedReference(source, target, edge) {
  if (source.id === target.id) return "references_self";
  if (source.hierarchy_rank < target.hierarchy_rank) return relationshipForRanks(source, target);
  if (source.hierarchy_rank > target.hierarchy_rank) return "references_upstream";
  return edge.relationship || "references";
}

function relationshipForRanks(source, target) {
  const sourceLane = laneForArtifact(source).id;
  const targetLane = laneForArtifact(target).id;
  if (sourceLane === "law" && targetLane === "statute") return "codifies_or_creates_note";
  if (sourceLane === "law") return "authorizes";
  if (sourceLane === "statute" && ["executive", "govwide"].includes(targetLane)) return "authorizes";
  if (sourceLane === "executive" && ["govwide", "dod"].includes(targetLane)) return "directs";
  if (sourceLane === "govwide" && targetLane === "dod") return "implements";
  if (sourceLane === "dod" && targetLane === "service") return "service_adopts";
  if (sourceLane === "service" && targetLane === "echelon2") return "component_executes";
  if (sourceLane === "echelon2" && targetLane === "echelon4") return "localizes";
  if (targetLane === "echelon4") return "verifies_or_localizes";
  return "flows_down";
}

function authorityPathStatus(artifact, upstreamEdges) {
  if (artifact.hierarchy_rank <= 20) return "root_authority";
  if (upstreamEdges.some(edge => edge.evidence_type === "resolved_reference")) return "evidence_backed";
  if (upstreamEdges.length) return "inferred_review_needed";
  return "authority_gap";
}

function laneForArtifact(artifact) {
  if (artifact.artifact_type === "Executive Order" || artifact.authority_level === "presidential_directive") {
    return LANES.find(lane => lane.id === "executive");
  }
  return laneForRank(artifact.hierarchy_rank);
}

function laneForRank(rank) {
  return LANES.find(lane => rank >= lane.minRank && rank <= lane.maxRank) || LANES[LANES.length - 1];
}

function inferredRankForReference(ref) {
  const family = ref.reference_family;
  if (family === "public-law") return 10;
  if (family === "usc") return 20;
  if (family === "executive-order") return 30;
  if (["omb-memo", "cfr", "far", "dfars", "nist-sp"].includes(family)) return 50;
  if (["dodd", "dodi"].includes(family)) return 72;
  if (["secnav", "opnavinst"].includes(family)) return 82;
  if (family === "navadmin") return 90;
  return 70;
}

function sharedTags(a, b) {
  const left = new Set([a.family, ...(a.tags || [])].filter(Boolean));
  return [b.family, ...(b.tags || [])].filter(tag => left.has(tag));
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter(edge => {
    const key = `${edge.source_artifact_id}->${edge.target_artifact_id}:${edge.relationship}:${edge.evidence_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort(edgeSort);
}

function edgeSort(a, b) {
  return a.source_lane.localeCompare(b.source_lane) || a.target_lane.localeCompare(b.target_lane) || a.source_label.localeCompare(b.source_label) || a.target_label.localeCompare(b.target_label);
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

function renderAuthorityChainMarkdown(map) {
  const lines = [
    "# Authority Chain Map",
    "",
    `Generated: ${map.generated_at}`,
    "",
    `- Artifacts: ${map.artifact_count}`,
    `- Nodes: ${map.summary.node_count}`,
    `- Edges: ${map.summary.edge_count}`,
    `- Evidence-backed reference edges: ${map.summary.resolved_reference_edge_count}`,
    `- Inferred flowdown edges: ${map.summary.inferred_flowdown_edge_count}`,
    "",
    "## Lanes",
    "",
    "| Lane | Meaning |",
    "| --- | --- |",
    ...map.lanes.map(lane => `| ${lane.label} | ${lane.meta} |`),
    "",
    "## Artifact Summary",
    "",
    "| Artifact | Upstream | Downstream | Gaps | Status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...map.artifact_summaries.map(item => `| ${item.artifact_id} | ${item.upstream_edge_count} | ${item.downstream_edge_count} | ${item.uncatalogued_gap_count} | ${item.authority_path_status} |`),
    "",
    "## Edge Sample",
    "",
    "| Source | Relationship | Target | Evidence | Confidence |",
    "| --- | --- | --- | --- | ---: |",
    ...map.edges.slice(0, 120).map(edge => `| ${edge.source_label} | ${edge.relationship} | ${edge.target_label} | ${edge.evidence_type} | ${edge.confidence} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}
