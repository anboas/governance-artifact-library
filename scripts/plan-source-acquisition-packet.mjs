import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const args = parseArgs(process.argv.slice(2));

if (!args.packet) {
  console.error("Usage: node scripts/plan-source-acquisition-packet.mjs --packet <packet.json> [--out <plan.json>] [--check]");
  process.exit(1);
}

const packet = readJson(args.packet, { absolute: true });
const queue = readJson("data/source-acquisition-queue.json");
const plan = buildCapturePlan(packet, queue);
const content = `${JSON.stringify(plan, null, 2)}\n`;

if (args.out) {
  const outPath = resolvePath(args.out);
  if (args.check) {
    assert.equal(existsSync(outPath), true, `${args.out} does not exist`);
    assert.equal(readFileSync(outPath, "utf8"), content, `${args.out} is stale; rerun packet planning`);
  } else {
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, content);
  }
} else {
  process.stdout.write(content);
}

console.error(`Source acquisition packet ${args.check ? "checked" : "planned"}: ${plan.summary.itemCount} items, ${plan.summary.existingArtifactTargets} existing artifact targets, ${plan.summary.candidateArtifactTargets} candidate targets.`);

export function buildCapturePlan(packet, queue) {
  validatePacket(packet, queue);
  const queueById = new Map((queue.queue_items || []).map(item => [item.id, item]));
  const workItems = packet.items.map(item => {
    const queueItem = queueById.get(item.id);
    const corpusTargets = item.corpusTargets.map(target => ({
      artifactId: target.artifactId,
      artifactPath: target.artifactPath,
      rawMirrorDirectory: target.rawMirrorDirectory,
      extractedTextPath: target.extractedTextPath,
      provenancePath: target.provenancePath,
      targetState: target.artifactId.startsWith("candidate-") ? "candidate_artifact" : "existing_artifact",
    }));
    return {
      id: item.id,
      queueRank: item.queueRank,
      queuePriority: item.queuePriority,
      itemType: item.itemType,
      label: item.label,
      queueReason: item.reason,
      recommendedAction: item.recommendedAction,
      localExecution: item.localExecution,
      source: item.source,
      governanceTarget: item.governanceTarget,
      captureMode: captureModeFor(item),
      captureStrategies: item.captureStrategies,
      sourceLocationTypes: item.sourceLocationTypes,
      sourceUrls: [item.source.url, item.source.searchUrl, item.source.apiUrl].filter(Boolean),
      artifactIds: item.artifactIds,
      corpusTargets,
      nextActions: nextActionsFor(item),
      acceptanceCriteria: acceptanceCriteriaFor(item, queueItem),
    };
  });
  return {
    planVersion: "source-acquisition-capture-plan-v1",
    packetVersion: packet.packetVersion,
    packetGeneratedAt: packet.generatedAt,
    packetGeneratedBy: packet.generatedBy,
    plannedFrom: packet.source,
    summary: {
      itemCount: workItems.length,
      p0: count(workItems, item => item.queuePriority === "P0"),
      p1: count(workItems, item => item.queuePriority === "P1"),
      p2: count(workItems, item => item.queuePriority === "P2"),
      sourceRecovery: count(workItems, item => item.itemType === "source_recovery"),
      governanceGaps: count(workItems, item => item.itemType === "governance_gap"),
      existingArtifactTargets: workItems.reduce((total, item) => total + count(item.corpusTargets, target => target.targetState === "existing_artifact"), 0),
      candidateArtifactTargets: workItems.reduce((total, item) => total + count(item.corpusTargets, target => target.targetState === "candidate_artifact"), 0),
    },
    workItems,
  };
}

function validatePacket(packet, queue) {
  assert.equal(packet.packetVersion, "policy-source-acquisition-packet-v1", "packetVersion must be policy-source-acquisition-packet-v1");
  assert.ok(packet.generatedAt, "packet needs generatedAt");
  assert.ok(packet.generatedBy, "packet needs generatedBy");
  assert.equal(Array.isArray(packet.items), true, "packet.items must be an array");
  assert.ok(packet.items.length > 0, "packet must contain at least one acquisition item");

  const queueById = new Map((queue.queue_items || []).map(item => [item.id, item]));
  for (const item of packet.items) {
    assert.ok(queueById.has(item.id), `${item.id} is not in data/source-acquisition-queue.json`);
    const queueItem = queueById.get(item.id);
    assert.equal(item.queueRank, queueItem.queue_rank, `${item.id} queueRank does not match corpus queue`);
    assert.equal(item.queuePriority, queueItem.queue_priority, `${item.id} queuePriority does not match corpus queue`);
    assert.equal(item.itemType, queueItem.item_type, `${item.id} itemType does not match corpus queue`);
    assert.ok(item.label, `${item.id} needs label`);
    assert.ok(item.recommendedAction, `${item.id} needs recommendedAction`);
    assert.equal(typeof item.source, "object", `${item.id} needs source object`);
    assert.equal(typeof item.localExecution, "object", `${item.id} needs localExecution object`);
    assert.ok(["Unclaimed", "Claimed", "Capturing", "Needs Browser", "Captured", "Blocked"].includes(item.localExecution.status), `${item.id} has invalid localExecution.status`);
    assert.equal(Array.isArray(item.captureStrategies), true, `${item.id} captureStrategies must be an array`);
    assert.equal(Array.isArray(item.sourceLocationTypes), true, `${item.id} sourceLocationTypes must be an array`);
    assert.equal(Array.isArray(item.artifactIds), true, `${item.id} artifactIds must be an array`);
    assert.equal(Array.isArray(item.corpusTargets), true, `${item.id} corpusTargets must be an array`);
    assert.ok(item.corpusTargets.length > 0, `${item.id} needs at least one corpus target`);
    validateUrl(item, "source.url");
    validateUrl(item, "source.searchUrl");
    validateUrl(item, "source.apiUrl");
    for (const target of item.corpusTargets) validateCorpusTarget(item, target);
  }
}

function validateUrl(item, path) {
  const value = path.split(".").reduce((current, part) => current?.[part], item);
  if (!value) return;
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "https:", `${item.id} ${path} must be https`);
}

function validateCorpusTarget(item, target) {
  assert.ok(target.artifactId, `${item.id} corpus target needs artifactId`);
  for (const field of ["artifactPath", "rawMirrorDirectory", "extractedTextPath", "provenancePath"]) {
    assert.ok(target[field], `${item.id} corpus target needs ${field}`);
    assert.equal(target[field].includes(".."), false, `${item.id} ${field} must not contain traversal`);
    assert.ok(target[field].startsWith(`artifacts/${target.artifactId}/`), `${item.id} ${field} must stay under artifacts/${target.artifactId}/`);
  }
  assert.equal(target.artifactPath, `artifacts/${target.artifactId}/artifact.json`, `${item.id} artifactPath must point to artifact.json`);
  assert.equal(target.rawMirrorDirectory.endsWith("/raw/"), true, `${item.id} rawMirrorDirectory must end in /raw/`);
  assert.equal(target.extractedTextPath.startsWith(`artifacts/${target.artifactId}/text/`), true, `${item.id} extractedTextPath must stay under text/`);
  assert.equal(target.extractedTextPath.endsWith(".txt"), true, `${item.id} extractedTextPath must be text`);
  assert.equal(target.provenancePath, `artifacts/${target.artifactId}/provenance.json`, `${item.id} provenancePath must point to provenance.json`);
}

function captureModeFor(item) {
  if (item.source.apiUrl || item.captureStrategies.includes("api")) return "api_or_direct_fetch";
  if (item.captureStrategies.includes("browser_fetch") || item.source.automationStatus === "browser_shell_detected") return "browser_assisted_capture";
  if (item.captureStrategies.includes("manual_import") || item.source.automationStatus === "blocked_by_host") return "manual_import";
  return "source_discovery";
}

function nextActionsFor(item) {
  const actions = [
    "Open the official source/search/API URL from the packet.",
    "Capture the authoritative raw source file or HTML snapshot.",
    "Write provenance with capture method, source URL, timestamp, and analyst/agent notes.",
  ];
  if (item.itemType === "governance_gap") actions.unshift("Confirm the first canonical artifact for the uncovered governance item.");
  if (item.artifactIds.length) actions.push("Update existing artifact records and raw mirror paths for each listed artifact ID.");
  else actions.push("Create a new candidate artifact record after confirming the official source.");
  actions.push("Regenerate extraction, claims, reference map, authority chain, coverage, source discovery, acquisition queue, and validate.");
  return actions;
}

function acceptanceCriteriaFor(item, queueItem) {
  return [
    "Raw source mirror or source-known registration exists at the packet corpus target.",
    "Artifact metadata/provenance references the official source URL from the packet.",
    "Generated sidecars match the artifact state: text extraction where mirrored, unavailable status where still blocked.",
    `The source acquisition queue item ${queueItem.id} is reduced or removed after regeneration.`,
  ];
}

function parseArgs(argv) {
  const parsed = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--packet") parsed.packet = argv[++index];
    else if (arg === "--out") parsed.out = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function resolvePath(path) {
  return path.startsWith("/") ? path : join(ROOT, path);
}

function readJson(path, { absolute = false } = {}) {
  return JSON.parse(readFileSync(absolute ? resolvePath(path) : join(ROOT, path), "utf8"));
}

function count(items, predicate) {
  return items.filter(predicate).length;
}
