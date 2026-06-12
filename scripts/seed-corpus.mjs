import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const CAPTURED_AT = new Date().toISOString();

const PIPELINE = {
  sourceKnown: "source_known",
  structured: "structured",
};

const TERM_LANES = [
  "shall",
  "must",
  "may",
  "cyber",
  "zero trust",
  "artificial intelligence",
  "software",
  "acquisition",
  "risk",
  "records",
  "training",
  "deadline",
  "report",
  "implementation",
];

const DEFAULT_ANALYTIC_LANES = [
  "authority_lineage",
  "obligation_extraction",
  "deadline_detection",
  "defined_terms",
  "issuing_org_graph",
  "implementation_tasks",
  "supersession_tracking",
  "compliance_evidence",
];

const SEEDS = [
  {
    id: "pl-118-31-fy2024-ndaa",
    title: "Public Law 118-31: National Defense Authorization Act for Fiscal Year 2024",
    short_title: "FY2024 NDAA",
    artifact_type: "Public Law",
    authority_level: "law",
    hierarchy_rank: 10,
    issuing_authority: "Congress",
    issuing_organization: "U.S. Government Publishing Office",
    source_system: "GovInfo",
    source_location_type: "govinfo_public_law_pdf",
    source_url: "https://www.govinfo.gov/content/pkg/PLAW-118publ31/pdf/PLAW-118publ31.pdf",
    source_date: "2023-12-22",
    publication_date: "2024-03-01",
    effective_date: "2023-12-22",
    raw_ext: "pdf",
    family: "defense_authorization",
    jurisdiction: "United States",
    tags: ["public-law", "ndaa", "defense", "authorization", "congress"],
  },
  {
    id: "pl-118-159-fy2025-ndaa",
    title: "Public Law 118-159: Servicemember Quality of Life Improvement and National Defense Authorization Act for Fiscal Year 2025",
    short_title: "FY2025 NDAA",
    artifact_type: "Public Law",
    authority_level: "law",
    hierarchy_rank: 10,
    issuing_authority: "Congress",
    issuing_organization: "U.S. Government Publishing Office",
    source_system: "GovInfo",
    source_location_type: "govinfo_public_law_pdf",
    source_url: "https://www.govinfo.gov/content/pkg/PLAW-118publ159/pdf/PLAW-118publ159.pdf",
    source_date: "2024-12-23",
    publication_date: "2025-01-02",
    effective_date: "2024-12-23",
    raw_ext: "pdf",
    family: "defense_authorization",
    jurisdiction: "United States",
    tags: ["public-law", "ndaa", "defense", "authorization", "congress"],
  },
  {
    id: "eo-14110-ai",
    title: "Executive Order 14110: Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence",
    short_title: "EO 14110",
    artifact_type: "Executive Order",
    authority_level: "presidential_directive",
    hierarchy_rank: 30,
    issuing_authority: "President",
    issuing_organization: "Executive Office of the President",
    source_system: "Federal Register",
    source_location_type: "federal_register_html",
    source_url: "https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence",
    source_date: "2023-10-30",
    publication_date: "2023-11-01",
    effective_date: "2023-10-30",
    raw_ext: "html",
    family: "ai_governance",
    jurisdiction: "United States",
    tags: ["executive-order", "ai", "federal-register"],
  },
  {
    id: "eo-14028-cybersecurity",
    title: "Executive Order 14028: Improving the Nation's Cybersecurity",
    short_title: "EO 14028",
    artifact_type: "Executive Order",
    authority_level: "presidential_directive",
    hierarchy_rank: 30,
    issuing_authority: "President",
    issuing_organization: "Executive Office of the President",
    source_system: "Federal Register",
    source_location_type: "federal_register_html",
    source_url: "https://www.federalregister.gov/documents/2021/05/17/2021-10460/improving-the-nations-cybersecurity",
    source_date: "2021-05-12",
    publication_date: "2021-05-17",
    effective_date: "2021-05-12",
    raw_ext: "html",
    family: "cybersecurity",
    jurisdiction: "United States",
    tags: ["executive-order", "cybersecurity", "federal-register"],
  },
  {
    id: "omb-m-24-10-ai-governance",
    title: "OMB Memorandum M-24-10: Advancing Governance, Innovation, and Risk Management for Agency Use of Artificial Intelligence",
    short_title: "OMB M-24-10",
    artifact_type: "OMB Memorandum",
    authority_level: "executive_branch_guidance",
    hierarchy_rank: 40,
    issuing_authority: "OMB",
    issuing_organization: "Office of Management and Budget",
    source_system: "White House",
    source_location_type: "white_house_pdf",
    source_url: "https://www.whitehouse.gov/wp-content/uploads/2024/03/M-24-10-Advancing-Governance-Innovation-and-Risk-Management-for-Agency-Use-of-Artificial-Intelligence.pdf",
    source_date: "2024-03-28",
    publication_date: "2024-03-28",
    effective_date: "2024-03-28",
    raw_ext: "pdf",
    family: "ai_governance",
    jurisdiction: "United States",
    tags: ["omb", "ai", "governance", "risk-management"],
  },
  {
    id: "omb-m-21-31-cyber-logging",
    title: "OMB Memorandum M-21-31: Improving the Federal Government's Investigative and Remediation Capabilities Related to Cybersecurity Incidents",
    short_title: "OMB M-21-31",
    artifact_type: "OMB Memorandum",
    authority_level: "executive_branch_guidance",
    hierarchy_rank: 40,
    issuing_authority: "OMB",
    issuing_organization: "Office of Management and Budget",
    source_system: "White House",
    source_location_type: "white_house_pdf",
    source_url: "https://www.whitehouse.gov/wp-content/uploads/2021/08/M-21-31-Improving-the-Federal-Governments-Investigative-and-Remediation-Capabilities-Related-to-Cybersecurity-Incidents.pdf",
    source_date: "2021-08-27",
    publication_date: "2021-08-27",
    effective_date: "2021-08-27",
    raw_ext: "pdf",
    family: "cybersecurity",
    jurisdiction: "United States",
    tags: ["omb", "cybersecurity", "logging", "incident-response"],
  },
  {
    id: "usc-title-10-section-2222",
    title: "10 U.S.C. 2222: Defense business systems",
    short_title: "10 U.S.C. 2222",
    artifact_type: "U.S. Code",
    authority_level: "us_code",
    hierarchy_rank: 20,
    issuing_authority: "Congress",
    issuing_organization: "Office of the Law Revision Counsel",
    source_system: "U.S. Code",
    source_location_type: "us_code_html",
    source_url: "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title10-section2222&num=0&edition=prelim",
    source_date: null,
    publication_date: null,
    effective_date: null,
    raw_ext: "html",
    family: "defense_business_systems",
    jurisdiction: "United States",
    tags: ["statute", "us-code", "defense-business-systems"],
  },
  {
    id: "far-part-39-acquisition-of-it",
    title: "Federal Acquisition Regulation Part 39: Acquisition of Information Technology",
    short_title: "FAR Part 39",
    artifact_type: "Regulation",
    authority_level: "federal_regulation",
    hierarchy_rank: 50,
    issuing_authority: "FAR Council",
    issuing_organization: "Acquisition.gov",
    source_system: "Acquisition.gov",
    source_location_type: "acquisition_gov_html",
    source_url: "https://www.acquisition.gov/far/part-39",
    source_date: null,
    publication_date: null,
    effective_date: null,
    raw_ext: "html",
    family: "acquisition",
    jurisdiction: "United States",
    tags: ["far", "acquisition", "information-technology"],
  },
  {
    id: "nist-sp-800-53-r5-security-privacy-controls",
    title: "NIST SP 800-53 Rev. 5: Security and Privacy Controls for Information Systems and Organizations",
    short_title: "NIST SP 800-53 Rev. 5",
    artifact_type: "Standard",
    authority_level: "federal_standard",
    hierarchy_rank: 60,
    issuing_authority: "NIST",
    issuing_organization: "National Institute of Standards and Technology",
    source_system: "NIST CSRC",
    source_location_type: "nist_csrc_html",
    source_url: "https://csrc.nist.gov/pubs/sp/800/53/r5/final",
    source_date: "2020-09-23",
    publication_date: "2020-09-23",
    effective_date: null,
    raw_ext: "html",
    family: "security_controls",
    jurisdiction: "United States",
    tags: ["nist", "security-controls", "privacy-controls", "fisma"],
  },
  {
    id: "nist-sp-800-207-zero-trust-architecture",
    title: "NIST SP 800-207: Zero Trust Architecture",
    short_title: "NIST SP 800-207",
    artifact_type: "Standard",
    authority_level: "federal_standard",
    hierarchy_rank: 60,
    issuing_authority: "NIST",
    issuing_organization: "National Institute of Standards and Technology",
    source_system: "NIST NVL Publications",
    source_location_type: "nist_nvlpubs_pdf",
    source_url: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf?download=1",
    source_date: "2020-08-10",
    publication_date: "2020-08-10",
    effective_date: null,
    raw_ext: "pdf",
    family: "zero_trust",
    jurisdiction: "United States",
    tags: ["nist", "zero-trust", "architecture", "cybersecurity"],
  },
  {
    id: "cyber-mil-cyber-awareness-challenge",
    title: "DoD Cyber Awareness Challenge",
    short_title: "Cyber Awareness Challenge",
    artifact_type: "Implementation Guidance",
    authority_level: "implementation_guidance",
    hierarchy_rank: 85,
    issuing_authority: "DoW/DoD",
    issuing_organization: "DoD Cyber Exchange",
    source_system: "DoD Cyber Exchange",
    source_location_type: "cyber_mil_html",
    source_url: "https://www.cyber.mil/cyber-awareness-challenge",
    source_date: null,
    publication_date: null,
    effective_date: null,
    raw_ext: "html",
    blocked: true,
    family: "cyber_training",
    jurisdiction: "DoW/DoD",
    tags: ["dod", "dow", "cybersecurity", "training", "implementation-guidance"],
  },
  {
    id: "dodd-5000-01-defense-acquisition-system",
    title: "DoD Directive 5000.01: The Defense Acquisition System",
    short_title: "DoDD 5000.01",
    artifact_type: "DoD Directive",
    authority_level: "defense_department_directive",
    hierarchy_rank: 70,
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_location_type: "dod_issuances_pdf",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/500001p.pdf",
    source_date: "2020-09-09",
    publication_date: "2020-09-09",
    effective_date: "2020-09-09",
    raw_ext: "pdf",
    blocked: true,
    family: "acquisition",
    jurisdiction: "DoW/DoD",
    tags: ["dod", "dow", "directive", "acquisition"],
  },
  {
    id: "dodi-5000-87-software-acquisition-pathway",
    title: "DoD Instruction 5000.87: Operation of the Software Acquisition Pathway",
    short_title: "DoDI 5000.87",
    artifact_type: "DoD Instruction",
    authority_level: "defense_department_instruction",
    hierarchy_rank: 72,
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_location_type: "dod_issuances_pdf",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500087p.PDF",
    source_date: "2020-10-02",
    publication_date: "2020-10-02",
    effective_date: "2020-10-02",
    raw_ext: "pdf",
    blocked: true,
    family: "software_acquisition",
    jurisdiction: "DoW/DoD",
    tags: ["dod", "dow", "instruction", "software-acquisition"],
  },
  {
    id: "dodi-8510-01-risk-management-framework",
    title: "DoD Instruction 8510.01: Risk Management Framework for DoD Systems",
    short_title: "DoDI 8510.01",
    artifact_type: "DoD Instruction",
    authority_level: "defense_department_instruction",
    hierarchy_rank: 72,
    issuing_authority: "DoW/DoD",
    issuing_organization: "Executive Services Directorate",
    source_system: "DoW/DoD Issuances",
    source_location_type: "dod_issuances_pdf",
    source_url: "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/851001p.pdf",
    source_date: "2022-07-19",
    publication_date: "2022-07-19",
    effective_date: "2022-07-19",
    raw_ext: "pdf",
    blocked: true,
    family: "risk_management",
    jurisdiction: "DoW/DoD",
    tags: ["dod", "dow", "instruction", "rmf", "cybersecurity"],
  },
  {
    id: "dod-zero-trust-strategy",
    title: "Department of Defense Zero Trust Strategy",
    short_title: "DoD Zero Trust Strategy",
    artifact_type: "Strategy",
    authority_level: "defense_department_strategy",
    hierarchy_rank: 74,
    issuing_authority: "DoW/DoD",
    issuing_organization: "DoD Chief Information Officer",
    source_system: "DoD CIO",
    source_location_type: "dod_cio_pdf",
    source_url: "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD-ZTStrategy.pdf",
    source_date: "2022-10-21",
    publication_date: "2022-10-21",
    effective_date: "2022-10-21",
    raw_ext: "pdf",
    blocked: true,
    family: "zero_trust",
    jurisdiction: "DoW/DoD",
    tags: ["dod", "dow", "zero-trust", "strategy", "cybersecurity"],
  },
  {
    id: "secnav-m-5210-1-records-management",
    title: "SECNAV M-5210.1: Department of the Navy Records Management Program",
    short_title: "SECNAV M-5210.1",
    artifact_type: "SECNAV Manual",
    authority_level: "service_secretariat_manual",
    hierarchy_rank: 80,
    issuing_authority: "SECNAV",
    issuing_organization: "Department of the Navy",
    source_system: "Department of the Navy Issuances",
    source_location_type: "don_issuances_pdf",
    source_url: "https://www.secnav.navy.mil/doni/SECNAV%20Manuals1/5210.1.pdf",
    source_date: "2019-09-23",
    publication_date: "2019-09-23",
    effective_date: "2019-09-23",
    raw_ext: "pdf",
    blocked: true,
    family: "records_management",
    jurisdiction: "Department of the Navy",
    tags: ["navy", "secnav", "records-management"],
  },
  {
    id: "secnav-m-5239-3-don-cybersecurity",
    title: "SECNAV M-5239.3: Department of the Navy Cybersecurity Program",
    short_title: "SECNAV M-5239.3",
    artifact_type: "SECNAV Manual",
    authority_level: "service_secretariat_manual",
    hierarchy_rank: 80,
    issuing_authority: "SECNAV",
    issuing_organization: "Department of the Navy",
    source_system: "Department of the Navy Issuances",
    source_location_type: "don_issuances_pdf",
    source_url: "https://www.secnav.navy.mil/doni/SECNAV%20Manuals1/5239.3.pdf",
    source_date: "2016-05-02",
    publication_date: "2016-05-02",
    effective_date: "2016-05-02",
    raw_ext: "pdf",
    blocked: true,
    family: "cybersecurity",
    jurisdiction: "Department of the Navy",
    tags: ["navy", "secnav", "cybersecurity", "manual"],
  },
  {
    id: "opnavinst-5239-1e-navy-cybersecurity",
    title: "OPNAVINST 5239.1E: U.S. Navy Cybersecurity Program",
    short_title: "OPNAVINST 5239.1E",
    artifact_type: "OPNAV Instruction",
    authority_level: "service_headquarters_instruction",
    hierarchy_rank: 82,
    issuing_authority: "OPNAV",
    issuing_organization: "Department of the Navy",
    source_system: "Department of the Navy Issuances",
    source_location_type: "don_issuances_pdf",
    source_url: "https://www.secnav.navy.mil/doni/Directives/05000%20General%20Management%20Security%20and%20Safety%20Services/05-200%20Management%20Program%20and%20Techniques%20Services/5239.1E.pdf",
    source_date: "2023-11-17",
    publication_date: "2023-11-17",
    effective_date: "2023-11-17",
    raw_ext: "pdf",
    blocked: true,
    family: "cybersecurity",
    jurisdiction: "Department of the Navy",
    tags: ["navy", "opnav", "cybersecurity"],
  },
  {
    id: "navadmin-214-24-fy2025-cybersecurity-awareness",
    title: "NAVADMIN 214/24: Fiscal Year 2025 Cybersecurity Awareness Challenge",
    short_title: "NAVADMIN 214/24",
    artifact_type: "NAVADMIN",
    authority_level: "service_operational_guidance",
    hierarchy_rank: 90,
    issuing_authority: "CNO",
    issuing_organization: "Office of the Chief of Naval Operations",
    source_system: "MyNavyHR",
    source_location_type: "mynavyhr_navadmin_txt",
    source_url: "https://www.mynavyhr.navy.mil/Portals/55/Messages/NAVADMIN/NAV2024/NAV24214.txt?ver=F4ni0x-dCthSC9lxo4NpvA%3D%3D",
    source_date: "2024-10-15",
    publication_date: "2024-10-15",
    effective_date: "2024-10-15",
    raw_ext: "txt",
    blocked: true,
    family: "cyber_training",
    jurisdiction: "Department of the Navy",
    tags: ["navy", "navadmin", "cybersecurity", "training", "echelon-4-ready"],
  },
];

await rm(join(ROOT, "artifacts"), { recursive: true, force: true });
await mkdir(join(ROOT, "artifacts"), { recursive: true });

const artifacts = [];
const sourceRegistry = new Map();
const hierarchyCounts = new Map();
const familyCounts = new Map();

for (const seed of SEEDS) {
  const artifactDir = join(ROOT, "artifacts", seed.id);
  const rawDir = join(artifactDir, "raw");
  const textDir = join(artifactDir, "text");
  const metadataDir = join(artifactDir, "metadata");
  const analyticsDir = join(artifactDir, "analytics");
  const analysisDir = join(artifactDir, "analysis");
  const structuredDir = join(artifactDir, "structured");
  const versionsDir = join(artifactDir, "versions");
  await mkdir(rawDir, { recursive: true });
  await mkdir(textDir, { recursive: true });
  await mkdir(metadataDir, { recursive: true });
  await mkdir(analyticsDir, { recursive: true });
  await mkdir(analysisDir, { recursive: true });
  await mkdir(structuredDir, { recursive: true });
  await mkdir(versionsDir, { recursive: true });

  const rawPath = `artifacts/${seed.id}/raw/source.${seed.raw_ext}`;
  const textPath = `artifacts/${seed.id}/text/extracted.txt`;
  const metadataPath = `artifacts/${seed.id}/metadata/metadata.json`;
  const analyticsPath = `artifacts/${seed.id}/analytics/document-metrics.json`;
  const analysisPath = `artifacts/${seed.id}/analysis/machine-analysis.json`;
  const structuredPath = `artifacts/${seed.id}/structured/summary.json`;
  const versionPath = `artifacts/${seed.id}/versions/index.json`;
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
      headers: { "user-agent": "governance-artifact-library-seeder/0.2" },
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
    authority_level: seed.authority_level,
    hierarchy_rank: seed.hierarchy_rank,
    family: seed.family,
    jurisdiction: seed.jurisdiction,
    issuing_authority: seed.issuing_authority,
    issuing_organization: seed.issuing_organization,
    source_system: seed.source_system,
    source_location_type: seed.source_location_type,
    source_url: seed.source_url,
    source_mime_type: sourceMimeType,
    source_date: seed.source_date,
    publication_date: seed.publication_date,
    effective_date: seed.effective_date,
    captured_at: seed.blocked ? null : CAPTURED_AT,
    checksum_sha256: checksum,
    raw_path: seed.blocked ? null : rawPath,
    extracted_text_path: seed.blocked ? null : textPath,
    metadata_path: metadataPath,
    analytics_path: analyticsPath,
    analysis_path: analysisPath,
    structured_json_path: seed.blocked ? null : structuredPath,
    version_index_path: versionPath,
    pipeline_state: pipelineState,
    mirror_status: mirrorStatus,
    parser_status: parserStatus,
    review_status: seed.blocked ? "unreviewed" : "machine_reviewed",
    tags: seed.tags,
    analytic_lanes: DEFAULT_ANALYTIC_LANES,
    relationships: [],
    provenance: {
      source_system: seed.source_system,
      capture_method: seed.blocked ? "manual_source_registration" : "automated_fetch",
      capture_notes: captureNotes,
    },
  };

  const metrics = buildMetrics(extractedText, sourceBytes, seed);
  const metadata = buildMetadata(seed, artifact, metrics);
  const analysis = buildAnalysis(seed, artifact, metrics);
  const versionIndex = buildVersionIndex(seed, artifact, metrics);
  const summary = buildSummary(seed, artifact, metrics);

  await writeJson(join(artifactDir, "artifact.json"), artifact);
  await writeJson(join(artifactDir, "provenance.json"), artifact.provenance);
  await writeJson(join(ROOT, metadataPath), metadata);
  await writeJson(join(ROOT, analyticsPath), metrics);
  await writeJson(join(ROOT, analysisPath), analysis);
  await writeJson(join(ROOT, versionPath), versionIndex);
  if (!seed.blocked) await writeJson(join(ROOT, structuredPath), summary);

  artifacts.push({
    id: seed.id,
    path: `artifacts/${seed.id}/artifact.json`,
    pipeline_state: pipelineState,
    mirror_status: mirrorStatus,
    authority_level: seed.authority_level,
    hierarchy_rank: seed.hierarchy_rank,
    family: seed.family,
    source_system: seed.source_system,
  });

  increment(sourceRegistry, seed.source_system, {
    name: seed.source_system,
    source_location_types: new Set(),
    artifact_count: 0,
  }).source_location_types.add(seed.source_location_type);
  increment(hierarchyCounts, seed.authority_level);
  increment(familyCounts, seed.family);
}

await writeJson(join(ROOT, "manifest.json"), {
  generated_at: CAPTURED_AT,
  artifact_count: artifacts.length,
  artifacts: artifacts.sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.id.localeCompare(b.id)),
  taxonomy_summary: {
    authority_levels: [...hierarchyCounts.entries()]
      .map(([name, artifact_count]) => ({
        name,
        hierarchy_rank: SEEDS.find((seed) => seed.authority_level === name)?.hierarchy_rank || 999,
        artifact_count,
      }))
      .sort((a, b) => a.hierarchy_rank - b.hierarchy_rank || a.name.localeCompare(b.name)),
    families: [...familyCounts.entries()].map(([name, artifact_count]) => ({ name, artifact_count })),
  },
});

await writeJson(join(ROOT, "sources", "source-registry.json"), {
  generated_at: CAPTURED_AT,
  sources: [...sourceRegistry.values()]
    .map((source) => ({
      name: source.name,
      artifact_count: source.artifact_count,
      source_location_types: [...source.source_location_types].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
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
  if (seed.raw_ext === "txt") return bytes.toString("utf8").trim() + "\n";
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

function buildMetadata(seed, artifact, metrics) {
  return {
    id: seed.id,
    title: seed.title,
    short_title: seed.short_title,
    artifact_type: seed.artifact_type,
    authority_level: seed.authority_level,
    hierarchy_rank: seed.hierarchy_rank,
    family: seed.family,
    jurisdiction: seed.jurisdiction,
    issuing_authority: seed.issuing_authority,
    issuing_organization: seed.issuing_organization,
    source: {
      system: seed.source_system,
      location_type: seed.source_location_type,
      url: seed.source_url,
      mime_type: artifact.source_mime_type,
      checksum_sha256: artifact.checksum_sha256,
      captured_at: artifact.captured_at,
      mirror_status: artifact.mirror_status,
    },
    lifecycle: {
      pipeline_state: artifact.pipeline_state,
      parser_status: artifact.parser_status,
      review_status: artifact.review_status,
    },
    document_shape: {
      byte_length: metrics.byte_length,
      extracted_text_chars: metrics.extracted_text_chars,
      extracted_word_count: metrics.extracted_word_count,
      approximate_pages: metrics.approximate_pages,
    },
    tags: seed.tags,
  };
}

function buildMetrics(text, bytes, seed) {
  const normalizedText = text.toLowerCase();
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const term_counts = Object.fromEntries(
    TERM_LANES.map((term) => [term, countTerm(normalizedText, term)])
  );
  return {
    id: seed.id,
    generated_at: CAPTURED_AT,
    byte_length: bytes?.byteLength || 0,
    extracted_text_chars: text.length,
    extracted_word_count: words.length,
    line_count: text ? text.split(/\n/).length : 0,
    approximate_pages: Math.max(0, Math.round(words.length / 500)),
    term_counts,
    obligation_signal_count: term_counts.shall + term_counts.must,
    implementation_signal_count: term_counts.implementation + term_counts.training + term_counts.deadline,
    analysis_ready: text.trim().length > 100,
  };
}

function buildAnalysis(seed, artifact, metrics) {
  const primarySignals = Object.entries(metrics.term_counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([term, count]) => ({ term, count }));

  return {
    id: seed.id,
    generated_at: CAPTURED_AT,
    analysis_type: "machine_bootstrap",
    authority_interpretation: {
      authority_level: seed.authority_level,
      hierarchy_rank: seed.hierarchy_rank,
      upstream_authority_expected: seed.hierarchy_rank > 20,
      downstream_guidance_expected: seed.hierarchy_rank < 90,
    },
    extraction_readiness: {
      obligation_extraction: metrics.obligation_signal_count > 0 ? "candidate" : "needs_review",
      deadline_extraction: metrics.term_counts.deadline > 0 ? "candidate" : "needs_review",
      implementation_extraction: metrics.implementation_signal_count > 0 ? "candidate" : "needs_review",
      blocked_reason: artifact.mirror_status === "blocked" ? artifact.provenance.capture_notes : null,
    },
    likely_analytics: DEFAULT_ANALYTIC_LANES,
    primary_term_signals: primarySignals,
    review_notes:
      artifact.mirror_status === "blocked"
        ? "Official source is registered but raw mirroring is blocked. Re-run with a browser-authenticated fetcher or manual import before relying on text analytics."
        : "Machine bootstrap analysis only. Human review is still required before treating obligations or deadlines as authoritative.",
  };
}

function buildSummary(seed, artifact, metrics) {
  return {
    id: seed.id,
    title: seed.title,
    short_title: seed.short_title,
    artifact_type: seed.artifact_type,
    authority_level: seed.authority_level,
    hierarchy_rank: seed.hierarchy_rank,
    family: seed.family,
    jurisdiction: seed.jurisdiction,
    issuing_authority: seed.issuing_authority,
    issuing_organization: seed.issuing_organization,
    source_url: seed.source_url,
    source_date: seed.source_date,
    pipeline_state: artifact.pipeline_state,
    mirror_status: artifact.mirror_status,
    parser_status: artifact.parser_status,
    review_status: artifact.review_status,
    extracted_text_chars: metrics.extracted_text_chars,
    extracted_word_count: metrics.extracted_word_count,
    obligation_signal_count: metrics.obligation_signal_count,
    implementation_signal_count: metrics.implementation_signal_count,
    normalized_fields: [
      "id",
      "title",
      "artifact_type",
      "authority_level",
      "hierarchy_rank",
      "family",
      "jurisdiction",
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
}

function buildVersionIndex(seed, artifact, metrics) {
  return {
    id: seed.id,
    current_version: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
    versions: [
      {
        version_id: artifact.checksum_sha256 ? `sha256:${artifact.checksum_sha256}` : "source-known",
        source_url: seed.source_url,
        source_date: seed.source_date,
        captured_at: artifact.captured_at,
        checksum_sha256: artifact.checksum_sha256,
        raw_path: artifact.raw_path,
        extracted_text_path: artifact.extracted_text_path,
        byte_length: metrics.byte_length,
        mirror_status: artifact.mirror_status,
      },
    ],
  };
}

function countTerm(text, term) {
  if (!text) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`\\b${escaped}\\b`, "gi"))?.length || 0;
}

function increment(map, key, initial = 0) {
  if (!map.has(key)) map.set(key, initial);
  const current = map.get(key);
  if (typeof current === "number") map.set(key, current + 1);
  else current.artifact_count += 1;
  return map.get(key);
}

async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
