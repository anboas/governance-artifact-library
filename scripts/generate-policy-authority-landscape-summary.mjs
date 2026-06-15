import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");
const OUTPUT_PATH = "data/policy-authority-landscape-summary.json";
const VISIBLE_LIMITS = new Map([
  ["law", 2],
  ["statute", 2],
  ["executive", 2],
  ["govwide", 4],
  ["dod", 5],
  ["service", 5],
  ["echelon2", 4],
  ["echelon4", 4],
]);

const manifest = readJson("manifest.json");
const authority = readJson("data/authority-chain-map.json");
const hierarchy = readOptionalJson("data/policy-organization-hierarchy-summary.json");
const lanes = authority.lanes || [];
const laneOrder = new Map(lanes.map((lane, index) => [lane.id, index]));
const nodes = authority.nodes || [];
const edges = authority.edges || [];
const nodeById = new Map(nodes.map(node => [node.id, node]));
const statsByNode = new Map(nodes.map(node => [node.id, {
  incoming: 0,
  outgoing: 0,
  resolved: 0,
  inferred: 0,
  cross_lane: 0,
}]));

for (const edge of edges) {
  const sourceStats = statsByNode.get(edge.source_artifact_id);
  const targetStats = statsByNode.get(edge.target_artifact_id);
  if (sourceStats) sourceStats.outgoing += 1;
  if (targetStats) targetStats.incoming += 1;
  const sourceNode = nodeById.get(edge.source_artifact_id);
  const targetNode = nodeById.get(edge.target_artifact_id);
  const isCrossLane = sourceNode && targetNode && sourceNode.lane !== targetNode.lane;
  if (isCrossLane) {
    if (sourceStats) sourceStats.cross_lane += 1;
    if (targetStats) targetStats.cross_lane += 1;
  }
  if (edge.evidence_type === "resolved_reference") {
    if (sourceStats) sourceStats.resolved += 1;
    if (targetStats) targetStats.resolved += 1;
  } else if (edge.evidence_type === "inferred_flowdown") {
    if (sourceStats) sourceStats.inferred += 1;
    if (targetStats) targetStats.inferred += 1;
  }
}

const visibleIds = new Set();
for (const lane of lanes) {
  const laneNodes = nodes
    .filter(node => node.lane === lane.id)
    .sort((a, b) => nodeScore(b) - nodeScore(a) || String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  laneNodes.slice(0, VISIBLE_LIMITS.get(lane.id) || 3).forEach(node => visibleIds.add(node.id));
}

// Pull in directly connected bridge nodes so the visual reads as lineage, not only isolated top-degree cards.
for (let pass = 0; pass < 2; pass += 1) {
  for (const edge of edges) {
    const sourceVisible = visibleIds.has(edge.source_artifact_id);
    const targetVisible = visibleIds.has(edge.target_artifact_id);
    if (sourceVisible === targetVisible) continue;
    const candidateId = sourceVisible ? edge.target_artifact_id : edge.source_artifact_id;
    const candidate = nodeById.get(candidateId);
    if (!candidate) continue;
    const currentLaneCount = [...visibleIds].filter(id => nodeById.get(id)?.lane === candidate.lane).length;
    const limit = (VISIBLE_LIMITS.get(candidate.lane) || 3) + 2;
    if (currentLaneCount < limit) visibleIds.add(candidateId);
  }
}

const visibleNodes = [...visibleIds]
  .map(id => nodeById.get(id))
  .filter(Boolean)
  .sort((a, b) => (laneOrder.get(a.lane) ?? 99) - (laneOrder.get(b.lane) ?? 99) || nodeScore(b) - nodeScore(a));

const slotByNode = new Map();
const laneVisibleCounts = new Map();
for (const node of visibleNodes) {
  const slot = laneVisibleCounts.get(node.lane) || 0;
  laneVisibleCounts.set(node.lane, slot + 1);
  slotByNode.set(node.id, slot);
}

const visibleEdges = edges
  .filter(edge => visibleIds.has(edge.source_artifact_id) && visibleIds.has(edge.target_artifact_id))
  .sort((a, b) => edgeScore(b) - edgeScore(a))
  .slice(0, 90)
  .map(edge => ({
    id: edge.id,
    source_id: edge.source_artifact_id,
    source_label: edge.source_label,
    source_lane: edge.source_lane,
    target_id: edge.target_artifact_id,
    target_label: edge.target_label,
    target_lane: edge.target_lane,
    relationship: edge.relationship,
    evidence_type: edge.evidence_type,
    confidence: edge.confidence,
  }));

const laneCards = lanes.map(lane => {
  const laneNodes = nodes.filter(node => node.lane === lane.id);
  const laneEdges = edges.filter(edge => edge.source_lane === lane.id || edge.target_lane === lane.id);
  return {
    ...lane,
    artifact_count: laneNodes.length,
    visible_node_count: visibleNodes.filter(node => node.lane === lane.id).length,
    edge_count: laneEdges.length,
  };
});

const model = {
  generated_at: manifest.generated_at,
  landscape_version: "policy-authority-landscape-summary-v1",
  scope: "Compact authority-chain landscape for browser rendering. Full edge corpus remains in data/authority-chain-map.json.",
  summary: {
    artifact_count: authority.artifact_count || manifest.artifact_count || 0,
    lane_count: lanes.length,
    node_count: authority.summary?.node_count || nodes.length,
    edge_count: authority.summary?.edge_count || edges.length,
    resolved_reference_edge_count: authority.summary?.resolved_reference_edge_count || 0,
    inferred_flowdown_edge_count: authority.summary?.inferred_flowdown_edge_count || 0,
    artifacts_with_upstream_authority: authority.summary?.artifacts_with_upstream_authority || 0,
    artifacts_with_downstream_implementation: authority.summary?.artifacts_with_downstream_implementation || 0,
    hierarchy_row_count: hierarchy?.summary?.row_count || 0,
    visible_node_count: visibleNodes.length,
    visible_edge_count: visibleEdges.length,
  },
  lanes: laneCards,
  nodes: visibleNodes.map(node => {
    const nodeStats = statsByNode.get(node.id) || {};
    return {
      id: node.id,
      label: node.label,
      title: node.title,
      lane: node.lane,
      lane_label: node.lane_label,
      slot: slotByNode.get(node.id) || 0,
      artifact_type: node.artifact_type,
      family: node.family,
      issuing_authority: node.issuing_authority,
      source_system: node.source_system,
      hierarchy_rank: node.hierarchy_rank,
      status: node.status,
      upstream_count: nodeStats.incoming || 0,
      downstream_count: nodeStats.outgoing || 0,
      resolved_edge_count: nodeStats.resolved || 0,
      inferred_edge_count: nodeStats.inferred || 0,
      cross_lane_edge_count: nodeStats.cross_lane || 0,
    };
  }),
  edges: visibleEdges,
};

await writeOrCheck(OUTPUT_PATH, `${JSON.stringify(model, null, 2)}\n`);

console.log(
  `Policy authority landscape summary ${CHECK_ONLY ? "checked" : "generated"}: ${model.summary.visible_node_count.toLocaleString()} visible nodes, ${model.summary.visible_edge_count.toLocaleString()} visible edges.`
);

function nodeScore(node) {
  const stats = statsByNode.get(node.id) || {};
  const laneBonus = node.lane === "dod" ? 4 : ["law", "statute", "govwide"].includes(node.lane) ? 3 : 1;
  return (stats.incoming * 2.2) + (stats.outgoing * 1.8) + (stats.cross_lane * 3) + (stats.resolved * 0.8) + laneBonus;
}

function edgeScore(edge) {
  const source = nodeById.get(edge.source_artifact_id);
  const target = nodeById.get(edge.target_artifact_id);
  const crossLane = source && target && source.lane !== target.lane ? 10 : 0;
  const resolved = edge.evidence_type === "resolved_reference" ? 4 : 0;
  return crossLane + resolved + Number(edge.confidence || 0);
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run authority:landscape`);
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
