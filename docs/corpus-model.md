# Corpus Model

## Governance Artifact

A Governance Artifact is an official policy or policy-adjacent artifact that can be mirrored, parsed, reviewed, and indexed by Policy Intelligence.

Examples:

- Public law
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
