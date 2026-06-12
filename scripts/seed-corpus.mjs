import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();

const PIPELINE = {
  sourceKnown: "source_known",
  structured: "structured",
};

const SEEDS = [
  {
    id: "eo-14110-ai",
    title: "Executive Order 14110: Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence",
    short_title: "EO 14110",
    artifact_type: "Executive Order",
    issuing_authority: "President",
    issuing_organization: "Executive Office of the President",
    source_system: "Federal Register",
    source_url: "https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence",
    source_date: "2023-10-30",
    publication_date: "2023-11-01",
    effective_date: "2023-10-30",
    raw_ext: "html",
    tags: ["executive-order", "ai", "federal-register"],
  },
  {
    id: "eo-14028-cybersecurity",
    title: "Executive Order 14028: Improving the Nation's Cybersecurity",
    short_title: "EO 14028",
    artifact_type: "Executive Order",
    issuing_authority: "President",
    issuing_organization: "Executive Office of the President",
    source_system: "Federal Register",
    source_url: "https://www.federalregister.gov/documents/2021/05/17/2021-10460/improving-the-nations-cybersecurity",
    source_date: "2021-05-12",
    publication_date: "2021-05-17",
    effective_date: "2021-05-12",
    raw_ext: "html",
    tags: ["executive-order", "cybersecurity", "federal-register"],
  },
  {
    id: "omb-m-24-10-ai-governance",
    title: "OMB Memorandum M-24-10: Advancing Governance, Innovation, and Risk Management for Agency Use of Artificial Intelligence",
    short_title: "OMB M-24-10",
    artifact_type: "OMB Memorandum",
    issuing_authority: "OMB",
    issuing_organization: "Office of Management and Budget",
    source_system: "White House",
    source_url: "https://www.whitehouse.gov/wp-content/uploads/2024/03/M-24-10-Advancing-Governance-Innovation-and-Risk-Management-for-Agency-Use-of-Artificial-Intelligence.pdf",
    source_date: "2024-03-28",
    publication_date: "2024-03-28",
    effective_date: "2024-03-28",
    raw_ext: "pdf",
    tags: ["omb", "ai", "governance", "risk-management"],
  },
  {
    id: "omb-m-21-31-cyber-logging",
    title: "OMB Memorandum M-21-31: Improving the Federal Government's Investigative and Remediation Capabilities Related to Cybersecurity Incidents",
    short_title: "OMB M-21-31",
    artifact_type: "OMB Memorandum",
    issuing_authority: "OMB",
    issuing_organization: "Office of Management and Budget",
    source_system: "White House",
    source_url: "https://www.whitehouse.gov/wp-content/uploads/2021/08/M-21-31-Improving-the-Federal-Governments-Investigative-and-Remediation-Capabilities-Related-to-Cybersecurity-Incidents.pdf",
    source_date: "2021-08-27",
    publication_date: "2021-08-27",
    effective_date: "2021-08-27",
    raw_ext: "pdf",
    tags: ["omb", "cybersecurity", "logging", "incident-response"],
  },
  {
    id: "usc-title-10-section-2222",
    title: "10 U.S.C. 2222: Defense business systems",
    short_title: "10 U.S.C. 2222",
    artifact_type: "U.S. Code",
    issuing_authority: "Congress",
    issuing_organization: "Office of the Law Revision Counsel",
    source_system: "U.S. Code",
    source_url: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title10-section2222&num=0&edition=prelim",
    source_date: null,
    publication_date: null,
    effective_date: null,
    raw_ext: "html",
    tags: ["statute", "us-code", "defense-business-systems"],
  },
  {
    id: "far-part-39-acquisition-of-it",
    title: "Federal Acquisition Regulation Part 39: Acquisition of Information Technology",
    short_title: "FAR Part 39",
    artifact_type: "Regulation",
    issuing_authority: "FAR Council",
    issuing_organization: "Acquisition.gov",
    source_system: "Acquisition.gov",
    source_url: "https://www.acquisition.gov/far/part-39",
    source_date: null,
    publication_date: null,
    effective_date: null,
    raw_ext: "html",
    tags: ["far", "acquisition", "information-technology"],
  },
  {
    id: "nist-sp-800-53-r5-security-privacy-controls",
    title: "NIST SP 800-53 Rev. 5: Security and Privacy Controls for Information Systems and Organizations",
    short_title: "NIST SP 800-53 Rev. 5",
    artifact_type: "Standard",
    issuing_authority: "NIST",
    issuing_organization: "National Institute of Standards and Technology",
    source_system: "NIST CSRC",
    source_url: "https://csrc.nist.gov/pubs/sp/800/53/r5/final",
    source_date: "2020-09-23",
    publication_date: "2020-09-23",
    effective_date: null,
    raw_ext: "html",
    tags: ["nist", "security-controls", "privacy-controls", "fisma"],
  },
  {
    id: "dodd-5000-01-defense-acquisition-system",
    title: "DoD Directive 5000.01: The Defense Acquisition System",
    short_title: "DoDD 5000.01",
    artifact_type: "DoD Directive",
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/500001p.pdf",
    source_date: "2020-09-09",
    publication_date: "2020-09-09",
    effective_date: "2020-09-09",
    raw_ext: "pdf",
    blocked: true,
    tags: ["dod", "dow", "directive", "acquisition"],
  },
  {
    id: "dodi-5000-87-software-acquisition-pathway",
    title: "DoD Instruction 5000.87: Operation of the Software Acquisition Pathway",
    short_title: "DoDI 5000.87",
    artifact_type: "DoD Instruction",
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500087p.PDF",
    source_date: "2020-10-02",
    publication_date: "2020-10-02",
    effective_date: "2020-10-02",
    raw_ext: "pdf",
    blocked: true,
    tags: ["dod", "dow", "instruction", "software-acquisition"],
  },
  {
    id: "dodi-8510-01-risk-management-framework",
    title: "DoD Instruction 8510.01: Risk Management Framework for DoD Systems",
    short_title: "DoDI 8510.01",
    artifact_type: "DoD Instruction",
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/851001p.pdf",
    source_date: "2022-07-19",
    publication_date: "2022-07-19",
    effective_date: "2022-07-19",
    raw_ext: "pdf",
    blocked: true,
    tags: ["dod", "dow", "instruction", "rmf", "cybersecurity"],
  },
  {
    id: "secnav-m-5210-1-records-management",
    title: "SECNAV M-5210.1: Department of the Navy Records Management Program",
    short_title: "SECNAV M-5210.1",
    artifact_type: "SECNAV Manual",
    issuing_authority: "SECNAV",
    issuing_organization: "Department of the Navy",
    source_system: "Department of the Navy Issuances",
    source_url: "https://www.secnav.navy.mil/doni/SECNAV%20Manuals1/5210.1.pdf",
    source_date: "2019-09-23",
    publication_date: "2019-09-23",
    effective_date: "2019-09-23",
    raw_ext: "pdf",
    blocked: true,
    tags: ["navy", "secnav", "records-management"],
  },
  {
    id: "opnavinst-5239-1e-navy-cybersecurity",
    title: "OPNAVINST 5239.1E: U.S. Navy Cybersecurity Program",
    short_title: "OPNAVINST 5239.1E",
    artifact_type: "OPNAV Instruction",
    issuing_authority: "OPNAV",
    issuing_organization: "Department of the Navy",
    source_system: "Department of the Navy Issuances",
    source_url: "https://www.secnav.navy.mil/doni/Directives/05000%20General%20Management%20Security%20and%20Safety%20Services/05-200%20Management%20Program%20and%20Techniques%20Services/5239.1E.pdf",
    source_date: "2023-11-17",
    publication_date: "2023-11-17",
    effective_date: "2023-11-17",
    raw_ext: "pdf",
    blocked: true,
    tags: ["navy", "opnav", "cybersecurity"],
  },
];

await rm(join(ROOT, "artifacts"), { recursive: true, force: true });
await mkdir(join(ROOT, "artifacts"), { recursive: true });

const artifacts = [];
const sourceRegistry = new Map();

for (const seed of SEEDS) {
  const artifactDir = join(ROOT, "artifacts", seed.id);
  const rawDir = join(artifactDir, "raw");
  const textDir = join(artifactDir, "text");
  const structuredDir = join(artifactDir, "structured");
  await mkdir(rawDir, { recursive: true });
  await mkdir(textDir, { recursive: true });
  await mkdir(structuredDir, { recursive: true });

  const rawPath = `artifacts/${seed.id}/raw/source.${seed.raw_ext}`;
  const textPath = `artifacts/${seed.id}/text/extracted.txt`;
  const structuredPath = `artifacts/${seed.id}/structured/summary.json`;
  let sourceBytes = null;
  let sourceMimeType = null;
  let checksum = null;
  let extractedText = "";
  let mirrorStatus = "blocked";
  let parserStatus = "blocked";
  let pipelineState = PIPELINE.sourceKnown;
  let captureNotes = "Official source identified. Raw mirroring blocked by source host during automated capture.";

  if (!seed.blocked) {
    const response = await fetch(seed.source_url, {
      headers: { "user-agent": "governance-artifact-library-seeder/0.1" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`${seed.id} fetch failed: ${response.status}`);
    sourceMimeType = response.headers.get("content-type") || null;
    sourceBytes = Buffer.from(await response.arrayBuffer());
    checksum = createHash("sha256").update(sourceBytes).digest("hex");
    await writeFile(join(ROOT, rawPath), sourceBytes);
    extractedText = await extractText(seed, join(ROOT, rawPath), sourceBytes);
    await writeFile(join(ROOT, textPath), extractedText);
    mirrorStatus = "mirrored";
    parserStatus = extractedText.trim() ? "parsed" : "partial";
    pipelineState = PIPELINE.structured;
    captureNotes = "Raw artifact mirrored and text extracted by seed-corpus.mjs.";
  }

  const artifact = {
    id: seed.id,
    title: seed.title,
    short_title: seed.short_title,
    artifact_type: seed.artifact_type,
    domain: "policy",
    issuing_authority: seed.issuing_authority,
    issuing_organization: seed.issuing_organization,
    source_url: seed.source_url,
    source_mime_type: sourceMimeType,
    source_date: seed.source_date,
    publication_date: seed.publication_date,
    effective_date: seed.effective_date,
    captured_at: seed.blocked ? null : CAPTURED_AT,
    checksum_sha256: checksum,
    raw_path: seed.blocked ? null : rawPath,
    extracted_text_path: seed.blocked ? null : textPath,
    structured_json_path: seed.blocked ? null : structuredPath,
    pipeline_state: pipelineState,
    mirror_status: mirrorStatus,
    parser_status: parserStatus,
    review_status: seed.blocked ? "unreviewed" : "machine_reviewed",
    tags: seed.tags,
    relationships: [],
    provenance: {
      source_system: seed.source_system,
      capture_method: seed.blocked ? "manual_source_registration" : "automated_fetch",
      capture_notes: captureNotes,
    },
  };

  const summary = {
    id: seed.id,
    title: seed.title,
    short_title: seed.short_title,
    artifact_type: seed.artifact_type,
    issuing_authority: seed.issuing_authority,
    issuing_organization: seed.issuing_organization,
    source_url: seed.source_url,
    source_date: seed.source_date,
    pipeline_state: pipelineState,
    mirror_status: mirrorStatus,
    parser_status: parserStatus,
    review_status: artifact.review_status,
    extracted_text_chars: extractedText.length,
    normalized_fields: [
      "id",
      "title",
      "artifact_type",
      "issuing_authority",
      "issuing_organization",
      "source_url",
      "source_date",
      "publication_date",
      "effective_date",
      "pipeline_state",
      "mirror_status",
      "parser_status",
      "review_status",
    ],
  };

  await writeJson(join(artifactDir, "artifact.json"), artifact);
  await writeJson(join(artifactDir, "provenance.json"), artifact.provenance);
  if (!seed.blocked) await writeJson(join(ROOT, structuredPath), summary);

  artifacts.push({
    id: seed.id,
    path: `artifacts/${seed.id}/artifact.json`,
    pipeline_state: pipelineState,
    mirror_status: mirrorStatus,
  });
  sourceRegistry.set(seed.source_system, {
    name: seed.source_system,
    artifact_count: (sourceRegistry.get(seed.source_system)?.artifact_count || 0) + 1,
  });
}

await writeJson(join(ROOT, "manifest.json"), {
  generated_at: CAPTURED_AT,
  artifact_count: artifacts.length,
  artifacts,
});

await writeJson(join(ROOT, "sources", "source-registry.json"), {
  generated_at: CAPTURED_AT,
  sources: [...sourceRegistry.values()].sort((a, b) => a.name.localeCompare(b.name)),
});

async function extractText(seed, rawFile, bytes) {
  if (seed.raw_ext === "pdf") {
    const outFile = `${rawFile}.txt`;
    const result = spawnSync("pdftotext", ["-layout", rawFile, outFile], { encoding: "utf8" });
    if (result.status !== 0) return "";
    const text = await readFile(outFile, "utf8");
    await rm(outFile, { force: true });
    return text;
  }
  return htmlToText(bytes.toString("utf8"));
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
