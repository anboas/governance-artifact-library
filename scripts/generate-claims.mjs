import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const GENERATED_AT = "2026-06-12T23:10:00.000Z";
const EXTRACTOR_VERSION = "governance-claims-rules-v1";

const CLAIM_RE = /\b(shall|must|required|requires|requirement|may|may not|shall not|must not|prohibited|authorized|authorize|authority|waiver|approve|approval|delegate|directs?|establish(?:es)?|ensure(?:s)?|submit|report|certify|implement|finds?|necessary to|in order to|defined|definition|means|term|not later than|within \d+ (?:days|months|years?))\b/i;
const MODALITY_RE = /\b(shall not|must not|may not|shall|must|required|requires|may|should|will|authorized|prohibited)\b/i;
const DEADLINE_RE = /\b(not later than [^.;]+|within \d+ (?:calendar )?(?:days|months|years?)(?: after [^.;]+)?|by [A-Z][a-z]+ \d{1,2}, \d{4})\b/i;
const CONDITION_RE = /\b(if|when|where|unless|subject to|in accordance with|pursuant to|for purposes of)\b[^.;]*/i;
const EXCEPTION_RE = /\b(except|unless|notwithstanding|waiver|waive)\b[^.;]*/i;
const EVIDENCE_RE = /\b(report|certification|certify|assessment|plan|strategy|documentation|records?|audit|briefing|notification)\b/i;

const ACTOR_RULES = [
  ["secretary-of-defense", "Secretary of Defense", /\bSecretary of Defense\b/i],
  ["secretary-of-the-navy", "Secretary of the Navy", /\bSecretary of the Navy|SECNAV\b/i],
  ["director-of-omb", "Director of OMB", /\bDirector of (?:the )?(?:Office of Management and Budget|OMB)\b/i],
  ["agency-head", "Agency Head", /\bhead of (?:an|the) agency\b/i],
  ["chief-information-officer", "Chief Information Officer", /\bChief Information Officer|CIO\b/i],
  ["department-of-defense", "Department of Defense", /\bDepartment of Defense|DoD\b/i],
  ["department-of-the-navy", "Department of the Navy", /\bDepartment of the Navy|DON\b/i],
  ["program-manager", "Program Manager", /\bprogram managers?\b/i],
  ["contracting-officer", "Contracting Officer", /\bcontracting officers?\b/i],
  ["commander", "Commander", /\bcommanders?\b/i],
  ["congress", "Congress", /\bCongress|congressional defense committees\b/i],
];

const manifest = readJson("manifest.json");
let changed = 0;
const artifactSummaries = [];
const aggregateByType = {};

for (const entry of manifest.artifacts) {
  const artifactPath = entry.path;
  const artifact = readJson(artifactPath);
  const claimsPath = `artifacts/${artifact.id}/claims/claims.json`;
  const claims = buildClaims(artifact, claimsPath);
  changed += writeIfChanged(claimsPath, `${JSON.stringify(claims, null, 2)}\n`);
  artifactSummaries.push({
    artifact_id: artifact.id,
    title: artifact.title,
    claims_status: claims.claims_status,
    ...claims.summary,
  });
  Object.entries(claims.summary.by_type || {}).forEach(([type, count]) => {
    aggregateByType[type] = (aggregateByType[type] || 0) + count;
  });

  if (artifact.claims_path !== claimsPath || !artifact.analytic_lanes?.includes("claims_extraction")) {
    const next = {
      ...artifact,
      claims_path: claimsPath,
      analytic_lanes: unique([...(artifact.analytic_lanes || []), "claims_extraction", "decision_authority_extraction"]),
    };
    changed += writeIfChanged(artifactPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

const claimCoverageMap = {
  generated_at: GENERATED_AT,
  extractor_version: EXTRACTOR_VERSION,
  artifact_count: manifest.artifacts.length,
  summary: {
    claim_count: sumField(artifactSummaries, "claim_count"),
    artifacts_with_claims: artifactSummaries.filter(item => item.claim_count > 0).length,
    artifacts_without_source_text: artifactSummaries.filter(item => item.claims_status === "source_text_unavailable").length,
    requirement_count: sumField(artifactSummaries, "requirement_count"),
    reporting_requirement_count: sumField(artifactSummaries, "reporting_requirement_count"),
    decision_authority_count: sumField(artifactSummaries, "decision_authority_count"),
    prohibition_count: sumField(artifactSummaries, "prohibition_count"),
    permission_count: sumField(artifactSummaries, "permission_count"),
    policy_statement_count: sumField(artifactSummaries, "policy_statement_count"),
    by_type: Object.fromEntries(Object.entries(aggregateByType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  },
  artifact_summaries: artifactSummaries.sort((a, b) => b.claim_count - a.claim_count || a.artifact_id.localeCompare(b.artifact_id)),
};
changed += writeIfChanged("data/claim-coverage-map.json", `${JSON.stringify(claimCoverageMap, null, 2)}\n`);
changed += writeIfChanged("docs/claim-coverage-map.md", renderClaimCoverageMarkdown(claimCoverageMap));

if (CHECK && changed) {
  throw new Error(`Claim artifacts are stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} claim sidecars for ${manifest.artifacts.length} artifacts; ${claimCoverageMap.summary.claim_count} claims${CHECK ? "" : ` (${changed} file changes)`}.`);

function buildClaims(artifact, claimsPath) {
  const textPath = artifact.extracted_text_path;
  const hasText = textPath && existsSync(join(ROOT, textPath));
  const text = hasText ? readFileSync(join(ROOT, textPath), "utf8").replace(/\r\n/g, "\n") : "";
  const meaningfulText = hasMeaningfulSourceText(text);
  const lines = text ? text.split("\n") : [];
  const extraction = artifact.extraction_path && existsSync(join(ROOT, artifact.extraction_path))
    ? readJson(artifact.extraction_path)
    : { line_annotations: [] };
  const annotationMap = new Map((extraction.line_annotations || []).map(row => [row.line, row.tags || []]));
  const claims = [];

  if (meaningfulText) {
    lines.forEach((line, index) => {
      const normalized = normalizeWhitespace(line);
      const lineNumber = index + 1;
      if (!isClaimLine(normalized)) return;
      const actor = detectActor(normalized);
      const modality = detectModality(normalized);
      const type = claimType(normalized, modality);
      const action = detectAction(normalized, modality);
      const object = detectObject(normalized, action);
      const linked = linkedTags(annotationMap.get(lineNumber) || []);
      claims.push({
        id: `${artifact.id}-claim-${String(claims.length + 1).padStart(5, "0")}`,
        type,
        text: normalized,
        normalized_claim: normalizeClaim(normalized),
        actor: actor?.label || "",
        actor_id: actor?.id || "",
        action,
        object,
        modality,
        conditions: detectMatch(normalized, CONDITION_RE),
        exceptions: detectMatch(normalized, EXCEPTION_RE),
        deadline: detectMatch(normalized, DEADLINE_RE),
        decision_authority: decisionAuthority(normalized, actor),
        evidence_required: EVIDENCE_RE.test(normalized),
        source_lines: { start: lineNumber, end: lineNumber },
        source_section: sectionHint(lines, index),
        linked_entities: linked.entities,
        linked_references: linked.references,
        linked_concepts: linked.concepts,
        confidence: claimConfidence(normalized, actor, linked),
        review_status: "machine_reviewed",
      });
    });
  }

  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    extractor_version: EXTRACTOR_VERSION,
    claims_status: meaningfulText ? "parsed" : "source_text_unavailable",
    source_text_path: textPath || null,
    extraction_path: artifact.extraction_path || null,
    claims_path: claimsPath,
    summary: summarizeClaims(claims, lines.length),
    claims,
    blocked_reason: meaningfulText ? null : hasText ? "Extracted text exists but appears to be an access-block or placeholder page." : "No extracted_text_path is currently mirrored for this source-known artifact.",
  };
}

function isClaimLine(line) {
  if (!line || line.length < 18) return false;
  if (/^(page \d+|federal register :: request access)$/i.test(line)) return false;
  return CLAIM_RE.test(line);
}

function detectActor(line) {
  return ACTOR_RULES.map(([id, label, regex]) => ({ id, label, regex })).find(rule => rule.regex.test(line)) || null;
}

function detectModality(line) {
  return normalizeWhitespace(line.match(MODALITY_RE)?.[0] || "");
}

function claimType(line, modality) {
  if (/\b(shall not|must not|may not|prohibited)\b/i.test(line)) return "prohibition";
  if (/\b(waiver|waive|approve|approval|authorized|authority|delegate)\b/i.test(line)) return "decision_authority";
  if (/\b(report|submit|certify|notification|briefing)\b/i.test(line)) return "reporting_requirement";
  if (/\b(defined|definition|means|term)\b/i.test(line)) return "definition";
  if (/\bmay\b/i.test(modality)) return "permission";
  if (/\b(shall|must|required|requires)\b/i.test(line)) return "requirement";
  return "policy_statement";
}

function detectAction(line, modality) {
  const modal = modality ? line.toLowerCase().indexOf(modality.toLowerCase()) : -1;
  const tail = modal >= 0 ? line.slice(modal + modality.length).trim() : line;
  return normalizeWhitespace(tail.split(/\s+/).slice(0, 6).join(" "));
}

function detectObject(line, action) {
  if (!action) return "";
  const index = line.toLowerCase().indexOf(action.toLowerCase());
  return index >= 0 ? normalizeWhitespace(line.slice(index + action.length)).slice(0, 220) : "";
}

function detectMatch(line, regex) {
  return normalizeWhitespace(line.match(regex)?.[0] || "");
}

function decisionAuthority(line, actor) {
  if (!/\b(authority|authorized|approve|approval|waiver|waive|delegate|direct)\b/i.test(line)) return "";
  return actor?.label || "Decision authority candidate";
}

function normalizeClaim(line) {
  return line.replace(/\s+/g, " ").replace(/^[\s.;:-]+|[\s.;:-]+$/g, "");
}

function linkedTags(tags) {
  return {
    entities: tags.filter(tag => tag.kind === "entity").map(tag => tag.id),
    references: tags.filter(tag => tag.kind === "reference").map(tag => tag.id),
    concepts: tags.filter(tag => tag.kind === "concept").map(tag => tag.id),
  };
}

function sectionHint(lines, index) {
  for (let i = index; i >= Math.max(0, index - 80); i -= 1) {
    const line = normalizeWhitespace(lines[i]);
    if (/^(sec\.|section|title|subtitle|division|part|chapter)\b/i.test(line)) return line.slice(0, 180);
  }
  return "";
}

function claimConfidence(line, actor, linked) {
  let score = 0.55;
  if (actor) score += 0.1;
  if (/\b(shall|must|required|requires)\b/i.test(line)) score += 0.12;
  if (/\bnot later than|within \d+|report|submit|certify\b/i.test(line)) score += 0.08;
  if (linked.entities.length || linked.references.length || linked.concepts.length) score += 0.08;
  return Number(Math.min(score, 0.94).toFixed(2));
}

function summarizeClaims(claims, totalLineCount) {
  const byType = claims.reduce((acc, claim) => {
    acc[claim.type] = (acc[claim.type] || 0) + 1;
    return acc;
  }, {});
  return {
    claim_count: claims.length,
    total_line_count: totalLineCount,
    requirement_count: byType.requirement || 0,
    reporting_requirement_count: byType.reporting_requirement || 0,
    decision_authority_count: byType.decision_authority || 0,
    prohibition_count: byType.prohibition || 0,
    permission_count: byType.permission || 0,
    policy_statement_count: byType.policy_statement || 0,
    by_type: byType,
  };
}

function sumField(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function renderClaimCoverageMarkdown(map) {
  return [
    "# Claim Coverage Map",
    "",
    `Generated: ${map.generated_at}`,
    "",
    "## Summary",
    "",
    `- Artifacts: ${map.artifact_count}`,
    `- Claims: ${map.summary.claim_count}`,
    `- Artifacts with claims: ${map.summary.artifacts_with_claims}`,
    `- Source-text unavailable: ${map.summary.artifacts_without_source_text}`,
    `- Requirements: ${map.summary.requirement_count}`,
    `- Reporting requirements: ${map.summary.reporting_requirement_count}`,
    `- Decision authorities: ${map.summary.decision_authority_count}`,
    "",
    "## Claim Types",
    "",
    "| Type | Count |",
    "| --- | ---: |",
    ...Object.entries(map.summary.by_type).map(([type, count]) => `| ${type} | ${count} |`),
    "",
    "## Top Artifacts",
    "",
    "| Artifact | Claims | Requirements | Reporting | Decision Authority |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...map.artifact_summaries.slice(0, 80).map(item => `| ${item.artifact_id} | ${item.claim_count} | ${item.requirement_count} | ${item.reporting_requirement_count} | ${item.decision_authority_count} |`),
    "",
  ].join("\n");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasMeaningfulSourceText(text) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 100) return false;
  if (normalized.includes("\u0000")) return false;
  if (/Request Access Due to aggressive automated scraping/i.test(normalized)) return false;
  if (/Your request has been flagged as potentially automated/i.test(normalized)) return false;
  if (/complete the CAPTCHA/i.test(normalized)) return false;
  if (/^Document not Found\b/i.test(normalized)) return false;
  if (/\bDocument not found\b/i.test(normalized)) return false;
  if (/LWR\.define|salesforce-lightning-design-system|webruntime|Your browser isn't supported/i.test(normalized)) return false;
  if (normalized.length < 5000 && /Access Denied|Cloudflare Ray ID|temporarily blocked/i.test(normalized)) return false;
  return true;
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
