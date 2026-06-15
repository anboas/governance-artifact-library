import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes("--check");

const manifest = readJson("manifest.json");
const exploration = readJson("data/organization-entity-source-exploration.json");

const rows = [];
const seenArtifacts = new Set();

const rootId = "department-of-war";
addRow({
  id: rootId,
  parent_id: "",
  level: 0,
  title: "Department of War",
  meta: `${(manifest.artifact_count || 0).toLocaleString()} corpus artifacts mapped into policy-owner hierarchy`,
  badge: String(manifest.artifact_count || 0),
  type: "policy-root",
  filter_type: "",
  filter_value: "",
});

const departmentalId = addBranch(rootId, 1, "policy-echelon1", "Departmental Policy Owners", "Echelon 1 · Department-level issuance owners", "departmental-policy-owners");
const servicesId = addBranch(rootId, 1, "policy-echelon1", "Services and Components", "Echelon 1 · Military departments and component policy surfaces", "services-components");
const commandsId = addBranch(rootId, 1, "policy-echelon1", "Commands, Agencies, and Field Activities", "Echelon 1 · Commands, agencies, field activities, and defense support owners", "commands-agencies-field-activities");
const externalId = addBranch(rootId, 1, "policy-echelon1", "External and Government-wide Authorities", "Echelon 1 · Statutory, executive, regulatory, and standards sources", "external-government-wide-authorities");
const oswId = addBranch(departmentalId, 2, "policy-echelon2", "Office of the Secretary of War", "Echelon 2 · Principal staff assistants and OSD policy owners", "office-secretary-war");

for (const entity of exploration.dod_opr_entities || []) {
  const entityId = addBranch(
    oswId,
    3,
    "policy-echelon3",
    entity.entity_name,
    `Echelon 3 · ${entity.entity_code || "OPR"} · ${Number(entity.artifact_count || 0).toLocaleString()} artifacts`,
    `opr-${entity.entity_id}`,
    { filter_type: "hierarchy", source_systems: entity.source_systems || [], families: entity.families || [] }
  );
  const artifactsByFamily = groupBy(entity.artifacts || [], artifact => artifact.family || "governance");
  for (const [family, artifacts] of [...artifactsByFamily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const familyLabel = familyLabelFor(family);
    const familyId = addBranch(
      entityId,
      4,
      "policy-echelon4",
      familyLabel,
      `Echelon 4 · ${artifacts.length.toLocaleString()} ${familyLabel} artifacts`,
      `opr-${entity.entity_id}-${family}`,
      { filter_type: "hierarchy", families: [family] }
    );
    for (const artifact of artifacts.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }))) {
      addArtifact(familyId, 5, artifact);
      seenArtifacts.add(artifact.id);
    }
  }
}

for (const entity of exploration.source_owner_entities || []) {
  if (entity.source_name === "DoW/DoD Issuances") continue;
  const group = sourceOwnerGroup(entity);
  const groupId = group === "services" ? servicesId : group === "commands" ? commandsId : externalId;
  const ownerId = addBranch(
    groupId,
    2,
    "policy-echelon2",
    entity.entity_name,
    `Echelon 2 · ${Number(entity.artifact_count || 0).toLocaleString()} artifacts · ${entity.source_name}`,
    `source-owner-${entity.source_id || slugFor(entity.source_name)}`,
    { source_systems: [entity.source_name], families: entity.families || [] }
  );
  const sourceId = addBranch(
    ownerId,
    3,
    "policy-source-system",
    entity.source_name,
    `Source system · ${entity.priority || "tracked"} · ${entity.automation_status || "unknown automation"}`,
    `source-system-${entity.source_id || slugFor(entity.source_name)}`,
    { filter_type: "source", filter_value: entity.source_name, source_systems: [entity.source_name], families: entity.families || [] }
  );
  for (const artifact of (entity.artifacts || []).sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id), undefined, { numeric: true }))) {
    addArtifact(sourceId, 4, artifact);
    seenArtifacts.add(artifact.id);
  }
}

hydrateChildCountsAndArtifactIds();

const model = {
  generated_at: manifest.generated_at,
  hierarchy_version: "policy-organization-hierarchy-summary-v1",
  scope: "Compact, precomputed policy-owner hierarchy for browser rendering. Full raw enumeration remains in data/organization-entity-source-exploration.json.",
  summary: {
    artifact_count: seenArtifacts.size,
    row_count: rows.length,
    echelon_node_count: rows.filter(row => /^policy-echelon/.test(row.type)).length,
    source_system_node_count: rows.filter(row => row.type === "policy-source-system").length,
    artifact_node_count: rows.filter(row => row.type === "policy-artifact").length,
    dod_opr_entity_count: exploration.summary?.dod_opr_entity_count || 0,
    dod_opr_artifact_link_count: exploration.summary?.dod_opr_artifact_link_count || 0,
  },
  path: ["Department of War", "Echelon 1", "Echelon 2", "Echelon 3", "Echelon 4", "Artifacts"],
  rows,
};

await writeOrCheck("data/policy-organization-hierarchy-summary.json", `${JSON.stringify(model, null, 2)}\n`);

console.log(
  `Policy organization hierarchy summary ${CHECK_ONLY ? "checked" : "generated"}: ${model.summary.row_count.toLocaleString()} rows, ${model.summary.artifact_node_count.toLocaleString()} artifact leaves.`
);

function addBranch(parentId, level, type, title, meta, slug, extra = {}) {
  const id = policyHierarchyId(parentId, slug || title);
  addRow({
    id,
    parent_id: parentId,
    level,
    title,
    meta,
    badge: "0",
    type,
    filter_type: extra.filter_type || "",
    filter_value: extra.filter_value || id,
    source_systems: extra.source_systems || [],
    families: extra.families || [],
  });
  return id;
}

function addArtifact(parentId, level, artifact) {
  const id = policyHierarchyId(parentId, artifact.id || artifact.title);
  addRow({
    id,
    parent_id: parentId,
    level,
    title: artifact.label || artifact.title || artifact.id,
    meta: [artifact.artifact_type, artifact.pipeline_state, artifact.mirror_status].filter(Boolean).join(" · ") || "Artifact",
    badge: "1",
    type: "policy-artifact",
    filter_type: "artifact",
    filter_value: artifact.id,
    artifact_ids: artifact.id ? [artifact.id] : [],
    source_systems: artifact.source_system ? [artifact.source_system] : [],
    families: artifact.family ? [artifact.family] : [],
  });
}

function addRow(row) {
  rows.push({
    id: row.id,
    parent_id: row.parent_id,
    level: row.level,
    title: row.title,
    meta: row.meta,
    badge: row.badge,
    type: row.type,
    child_count: 0,
    filter_type: row.filter_type || "",
    filter_value: row.filter_value || "",
    artifact_ids: row.artifact_ids || [],
    source_systems: row.source_systems || [],
    families: row.families || [],
  });
}

function hydrateChildCountsAndArtifactIds() {
  const byParent = groupBy(rows, row => row.parent_id || "");
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const row of rows) row.child_count = (byParent.get(row.id) || []).length;
  const visit = (row) => {
    const children = byParent.get(row.id) || [];
    const artifactIds = new Set(row.artifact_ids || []);
    const sourceSystems = new Set(row.source_systems || []);
    const families = new Set(row.families || []);
    for (const child of children) {
      const childRollup = visit(child);
      childRollup.artifact_ids.forEach(value => artifactIds.add(value));
      childRollup.source_systems.forEach(value => sourceSystems.add(value));
      childRollup.families.forEach(value => families.add(value));
    }
    const rolledArtifactIds = [...artifactIds].filter(Boolean).sort();
    row.artifact_ids = row.type === "policy-artifact" || (row.filter_type === "hierarchy" && row.level >= 3)
      ? rolledArtifactIds
      : [];
    row.source_systems = [...sourceSystems].filter(Boolean).sort();
    row.families = [...families].filter(Boolean).sort();
    if (row.type !== "policy-artifact") row.badge = rolledArtifactIds.length.toLocaleString();
    return { ...row, artifact_ids: rolledArtifactIds };
  };
  visit(byId.get(rootId));
}

function sourceOwnerGroup(entity) {
  const text = `${entity.entity_name || ""} ${entity.source_name || ""} ${(entity.artifact_types || []).join(" ")} ${(entity.families || []).join(" ")}`.toLowerCase();
  if (/department of the (navy|army|air force)|mynavy|marine corps|space force|air force e-publishing/.test(text)) return "services";
  if (/cyber command|combatant command|disa|defense information systems|dod cyber|dod cio|dfars|defense acquisition|field activity|defense agency/.test(text)) return "commands";
  return "external";
}

function familyLabelFor(family) {
  const value = String(family || "governance").toLowerCase();
  if (value === "dodd") return "DoW/DoD Directives";
  if (value === "dodi") return "DoW/DoD Instructions";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function policyHierarchyId(...parts) {
  const raw = parts.filter(Boolean).join("-");
  const base = slugFor(raw) || "policy-node";
  const hash = Array.from(raw).reduce((value, char) => ((value * 31) + char.charCodeAt(0)) >>> 0, 2166136261).toString(36);
  return `${base.slice(0, 72).replace(/-+$/g, "")}-${hash}`;
}

function slugFor(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function groupBy(rows, keyer) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyer(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

async function writeOrCheck(path, content) {
  const fullPath = join(ROOT, path);
  if (CHECK_ONLY) {
    assert.equal(existsSync(fullPath), true, `${path} does not exist`);
    assert.equal(readFileSync(fullPath, "utf8"), content, `${path} is stale; run npm run hierarchy:summary`);
    return;
  }
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
