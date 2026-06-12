import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CHECK = process.argv.includes("--check");
const GENERATED_AT = "2026-06-12T22:50:00.000Z";
const EXTRACTOR_VERSION = "governance-extractor-rules-v1";

const ENTITY_RULES = [
  entity("congress", "Congress", "legislative_body", ["Congress", "House of Representatives", "Senate"]),
  entity("secretary-of-defense", "Secretary of Defense", "role", ["Secretary of Defense", "SecDef"]),
  entity("department-of-defense", "Department of Defense", "department", ["Department of Defense", "DoD", "Department of War", "DoW"]),
  entity("department-of-the-navy", "Department of the Navy", "department", ["Department of the Navy", "DON"]),
  entity("secretary-of-the-navy", "Secretary of the Navy", "role", ["Secretary of the Navy", "SECNAV"]),
  entity("chief-information-officer", "Chief Information Officer", "role", ["Chief Information Officer", "CIO"]),
  entity("director-of-omb", "Director of OMB", "role", ["Director of OMB", "Director of the Office of Management and Budget"]),
  entity("office-of-management-and-budget", "Office of Management and Budget", "agency", ["Office of Management and Budget", "OMB"]),
  entity("nist", "National Institute of Standards and Technology", "agency", ["National Institute of Standards and Technology", "NIST"]),
  entity("cisa", "Cybersecurity and Infrastructure Security Agency", "agency", ["Cybersecurity and Infrastructure Security Agency", "CISA"]),
  entity("gsa", "General Services Administration", "agency", ["General Services Administration", "GSA"]),
  entity("disa", "Defense Information Systems Agency", "agency", ["Defense Information Systems Agency", "DISA"]),
  entity("army", "Department of the Army", "service", ["Army", "Department of the Army"]),
  entity("navy", "United States Navy", "service", ["Navy", "United States Navy"]),
  entity("air-force", "Department of the Air Force", "service", ["Air Force", "Department of the Air Force"]),
  entity("space-force", "United States Space Force", "service", ["Space Force", "United States Space Force"]),
  entity("marine-corps", "United States Marine Corps", "service", ["Marine Corps", "United States Marine Corps"]),
  entity("joint-staff", "Joint Staff", "joint", ["Joint Staff", "Chairman of the Joint Chiefs of Staff"]),
  entity("program-manager", "Program Manager", "role", ["Program Manager", "program manager", "program managers"]),
  entity("contracting-officer", "Contracting Officer", "role", ["Contracting Officer", "contracting officer"]),
];

const CONCEPT_RULES = [
  concept("zero-trust", "Zero Trust", "cybersecurity", ["zero trust", "zero-trust"]),
  concept("cybersecurity", "Cybersecurity", "cybersecurity", ["cybersecurity", "cyber security"]),
  concept("artificial-intelligence", "Artificial Intelligence", "technology", ["artificial intelligence", "AI"]),
  concept("software-acquisition", "Software Acquisition", "acquisition", ["software acquisition", "software pathway"]),
  concept("risk-management-framework", "Risk Management Framework", "cybersecurity", ["risk management framework", "RMF"]),
  concept("cloud-computing", "Cloud Computing", "technology", ["cloud computing", "cloud service", "cloud services"]),
  concept("data-governance", "Data Governance", "governance", ["data governance", "data management", "data sharing"]),
  concept("identity-access", "Identity And Access", "cybersecurity", ["identity", "access management", "authentication", "credential"]),
  concept("continuous-monitoring", "Continuous Monitoring", "cybersecurity", ["continuous monitoring", "monitoring"]),
  concept("incident-response", "Incident Response", "cybersecurity", ["incident response", "incident reporting", "cyber incident"]),
  concept("supply-chain-risk", "Supply Chain Risk", "risk", ["supply chain", "supply-chain", "supplier risk"]),
  concept("records-management", "Records Management", "information_management", ["records management", "records disposition"]),
  concept("authorization-to-operate", "Authorization To Operate", "compliance", ["authorization to operate", "ATO"]),
  concept("logging", "Logging", "cybersecurity", ["logging", "event logs", "log management"]),
  concept("privacy", "Privacy", "compliance", ["privacy", "personally identifiable information", "PII"]),
  concept("encryption", "Encryption", "cybersecurity", ["encryption", "cryptographic", "cryptography"]),
  concept("audit", "Audit", "oversight", ["audit", "auditing", "auditability"]),
  concept("governance", "Governance", "governance", ["governance", "oversight", "policy"]),
  concept("implementation", "Implementation", "execution", ["implementation", "implementing", "execute", "execution"]),
  concept("reporting", "Reporting", "oversight", ["report", "reporting", "submit to Congress"]),
  concept("deadline", "Deadline", "schedule", ["deadline", "not later than", "within 180 days", "within 1 year"]),
  concept("compliance", "Compliance", "compliance", ["compliance", "comply", "shall comply"]),
  concept("acquisition", "Acquisition", "acquisition", ["acquisition", "procurement", "contracting"]),
  concept("mission", "Mission", "operations", ["mission", "operational", "warfighting"]),
  concept("operational-technology", "Operational Technology", "technology", ["operational technology", "OT"]),
];

const REFERENCE_RULES = [
  reference("public-law", "Public Law", /\bPublic Law\s+\d{2,3}-\d+\b/gi),
  reference("usc", "U.S. Code", /\b\d+\s+U\.?S\.?C\.?\s+(?:§\s*)?\d+[a-zA-Z0-9.-]*\b/gi),
  reference("cfr", "Code of Federal Regulations", /\b\d+\s+C\.?F\.?R\.?\s+(?:part\s+)?\d+[a-zA-Z0-9.-]*\b/gi),
  reference("far", "Federal Acquisition Regulation", /\bFAR\s+(?:part\s+)?\d+(?:\.\d+)?\b/gi),
  reference("dfars", "Defense Federal Acquisition Regulation Supplement", /\bDFARS\s+(?:part\s+)?\d+(?:\.\d+)?\b/gi),
  reference("executive-order", "Executive Order", /\bExecutive Order\s+\d{4,6}\b/gi),
  reference("omb-memo", "OMB Memorandum", /\bOMB\s+M-\d{2}-\d{1,3}\b/gi),
  reference("nist-sp", "NIST Special Publication", /\bNIST\s+SP\s+\d{3}-\d+[A-Za-z0-9.-]*\b/gi),
  reference("dodi", "DoD Instruction", /\bDoDI\s+\d{4}\.\d{2}\b/gi),
  reference("dodd", "DoD Directive", /\bDoDD\s+\d{4}\.\d{2}\b/gi),
  reference("secnav", "SECNAV Issuance", /\bSECNAV(?:INST| M| Manual)?\s+\d{4,5}(?:\.\d+)?[A-Z]?\b/gi),
  reference("opnavinst", "OPNAV Instruction", /\bOPNAVINST\s+\d{4,5}(?:\.\d+)?[A-Z]?\b/gi),
  reference("navadmin", "NAVADMIN", /\bNAVADMIN\s+\d{1,3}\/\d{2}\b/gi),
  reference("section", "Section", /\b(?:sec\.|section)\s+\d{2,5}[a-zA-Z0-9.-]*\b/gi),
];

const OBLIGATION_RE = /\b(shall|must|required|requires|will|directs?|establish(?:es)?|ensure(?:s)?|submit|report|certify|implement)\b/i;
const SECTION_RE = /^\s*((sec\.?|section|title|subtitle|division|part|chapter)\b|\([a-z0-9]+\))/i;

const manifest = readJson("manifest.json");
let changed = 0;

for (const entry of manifest.artifacts) {
  const artifactPath = entry.path;
  const artifact = readJson(artifactPath);
  const extractionPath = `artifacts/${artifact.id}/extractions/extractions.json`;
  const extraction = buildExtraction(artifact, extractionPath);
  changed += writeIfChanged(extractionPath, `${JSON.stringify(extraction, null, 2)}\n`);

  if (artifact.extraction_path !== extractionPath || !artifact.analytic_lanes?.includes("entity_reference_concept_extraction")) {
    const next = {
      ...artifact,
      extraction_path: extractionPath,
      analytic_lanes: unique([...(artifact.analytic_lanes || []), "entity_reference_concept_extraction", "line_annotation"]),
    };
    changed += writeIfChanged(artifactPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

if (CHECK && changed) {
  throw new Error(`Extraction artifacts are stale; ${changed} file(s) need regeneration.`);
}

console.log(`${CHECK ? "Checked" : "Generated"} extraction sidecars for ${manifest.artifacts.length} artifacts${CHECK ? "" : ` (${changed} file changes)`}.`);

function buildExtraction(artifact, extractionPath) {
  const textPath = artifact.extracted_text_path;
  const hasText = textPath && existsSync(join(ROOT, textPath));
  const text = hasText ? readFileSync(join(ROOT, textPath), "utf8").replace(/\r\n/g, "\n") : "";
  const lines = text ? text.split("\n") : [];
  const meaningfulText = hasMeaningfulSourceText(text);
  const entityHits = new Map();
  const conceptHits = new Map();
  const referenceHits = new Map();
  const lineAnnotations = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const tags = [];

    for (const rule of ENTITY_RULES) {
      if (rule.aliases.some(alias => containsTerm(line, alias))) {
        addHit(entityHits, rule.id, { ...rule, first_line: lineNumber, line: lineNumber });
        tags.push(tag("entity", rule.type, rule.label, rule.id));
      }
    }

    for (const rule of CONCEPT_RULES) {
      if (rule.aliases.some(alias => containsTerm(line, alias))) {
        addHit(conceptHits, rule.id, { ...rule, first_line: lineNumber, line: lineNumber });
        tags.push(tag("concept", rule.category, rule.label, rule.id));
      }
    }

    for (const rule of REFERENCE_RULES) {
      const matches = [...line.matchAll(rule.regex)];
      for (const match of matches) {
        const label = normalizeWhitespace(match[0]);
        const id = `${rule.id}:${slug(label)}`;
        addHit(referenceHits, id, { id, type: rule.type, label, reference_family: rule.family, first_line: lineNumber, line: lineNumber });
        tags.push(tag("reference", rule.type, label, id));
      }
    }

    if (OBLIGATION_RE.test(line)) tags.push(tag("obligation", "modal", "Obligation Candidate", "obligation-candidate"));
    if (SECTION_RE.test(line)) tags.push(tag("structure", "section", "Section", "section"));

    const compactTags = uniqueTags(tags).slice(0, 8);
    if (compactTags.length) {
      lineAnnotations.push({
        line: lineNumber,
        tags: compactTags,
      });
    }
  });

  return {
    id: artifact.id,
    generated_at: GENERATED_AT,
    extractor_version: EXTRACTOR_VERSION,
    extraction_status: hasText && meaningfulText ? "parsed" : "source_text_unavailable",
    source_text_path: textPath || null,
    extraction_path: extractionPath,
    summary: {
      entity_count: entityHits.size,
      reference_count: referenceHits.size,
      concept_count: conceptHits.size,
      annotated_line_count: lineAnnotations.length,
      total_line_count: lines.length,
    },
    entities: sortHits(entityHits),
    references: sortHits(referenceHits),
    concepts: sortHits(conceptHits),
    line_annotations: lineAnnotations,
    blocked_reason: hasText && meaningfulText ? null : hasText ? "Extracted text exists but appears to be an access-block or placeholder page." : "No extracted_text_path is currently mirrored for this source-known artifact.",
  };
}

function entity(id, label, type, aliases) {
  return { id, label, type, aliases };
}

function concept(id, label, category, aliases) {
  return { id, label, category, aliases };
}

function reference(family, type, regex) {
  return { family, type, regex };
}

function tag(kind, type, label, id) {
  return { kind, type, label, id };
}

function containsTerm(line, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(line);
}

function addHit(map, id, hit) {
  const existing = map.get(id) || {
    id,
    type: hit.type || hit.category || hit.reference_family,
    label: hit.label,
    aliases: hit.aliases || undefined,
    category: hit.category || undefined,
    reference_family: hit.reference_family || undefined,
    count: 0,
    first_line: hit.first_line,
    lines_sample: [],
  };
  existing.count += 1;
  existing.first_line = Math.min(existing.first_line, hit.line);
  if (existing.lines_sample.length < 12 && !existing.lines_sample.includes(hit.line)) existing.lines_sample.push(hit.line);
  map.set(id, existing);
}

function sortHits(map) {
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map(item => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueTags(tags) {
  const seen = new Set();
  return tags.filter(item => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72) || "reference";
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasMeaningfulSourceText(text) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 100) return false;
  if (/Request Access Due to aggressive automated scraping/i.test(normalized)) return false;
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
