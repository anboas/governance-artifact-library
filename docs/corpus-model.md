# Corpus Model

## Governance Artifact

A Governance Artifact is an official policy or policy-adjacent artifact that can be mirrored, parsed, reviewed, and indexed by Policy Intelligence.

Examples:

- Public law
- NDAA
- U.S. Code section
- Executive Order
- Presidential Memorandum
- OMB memorandum
- DoW/DoD Directive
- DoW/DoD Instruction
- SECNAV manual
- OPNAV instruction
- NAVADMIN
- Implementation guidance
- Implementation evidence

## Taxonomy Fields

Every artifact carries normalized hierarchy fields:

- `authority_level`: machine-readable position in the policy stack.
- `hierarchy_rank`: numeric rank for sorting from law down to local guidance.
- `family`: thematic family such as `cybersecurity`, `ai_governance`, `acquisition`, or `cyber_training`.
- `jurisdiction`: policy jurisdiction such as `United States`, `DoW/DoD`, or `Department of the Navy`.
- `source_system`: official source platform.
- `source_location_type`: capture pattern for that official source.

The canonical taxonomy files live in `taxonomies/`.

## Artifact Mirror Envelope

Mirrored artifacts carry:

- `raw/source.<ext>`: source document bytes.
- `text/extracted.txt`: full text extraction.
- `metadata/metadata.json`: normalized source and document metadata.
- `analytics/document-metrics.json`: machine-generated document metrics and term signals.
- `analysis/machine-analysis.json`: bootstrap analysis and review flags.
- `structured/summary.json`: compact downstream summary.
- `versions/index.json`: current source version ledger.

## Boundary

The Policy corpus has its own artifact graph. It can relate artifacts to authorities, issuing organizations, obligations, deadlines, evidence, and review tasks.

It does not create default links to Opportunity Intelligence records. If a future product needs cross-domain citations, those should be explicit bridge records, not implicit graph edges.

## Required Pipeline States

- `source_known`: official URL and metadata are known.
- `mirrored`: raw source exists and checksum is recorded.
- `text_extracted`: text file exists.
- `normalized`: canonical metadata fields are normalized.
- `structured`: structured JSON exists.
- `reviewed`: human review completed.

## Review Status

- `unreviewed`
- `machine_reviewed`
- `analyst_review_needed`
- `analyst_reviewed`

## Parser Status

- `not_started`
- `blocked`
- `parsed`
- `partial`
- `failed`

## Source Status

- `mirrored`
- `blocked`
- `queued`
- `retired`
