# Governance Artifact Library

This repository is the canonical public corpus store for Policy Intelligence.

It is not the application runtime database. It is the versioned evidence layer for official policy artifacts: mirrored source files, extracted text, normalized metadata, structured JSON, provenance, checksums, parser status, and human review state.

## Product Boundary

Policy Intelligence and Opportunity Intelligence are separate top-level domains. This repository belongs to the Policy Intelligence domain. It does not create default relationships to opportunities.

## What Lives Here

- Statutes, public laws, and U.S. Code sections
- NDAAs and defense authorization acts
- Executive Orders and Presidential Memoranda
- OMB memoranda and implementation guidance
- DoW/DoD directives, instructions, manuals, and DTMs
- Service/component directives and memoranda
- Navy memoranda, NAVADMINs, OPNAV, SECNAV, and related official artifacts
- Implementation evidence tied to policy execution

## Artifact Lifecycle

Every artifact moves through explicit states:

1. `source_known`: official source identified but not mirrored yet.
2. `mirrored`: raw source captured in this repository.
3. `text_extracted`: readable text generated from the raw artifact.
4. `normalized`: canonical metadata and provenance fields shaped.
5. `structured`: structured JSON exists for downstream indexing.
6. `reviewed`: human-reviewed fields and findings.

Blocked official hosts stay in `source_known` with `mirror_status: blocked`, not silently fabricated.

## Layout

```text
artifacts/<artifact-id>/
  artifact.json
  provenance.json
  raw/source.<ext>
  text/extracted.txt
  metadata/metadata.json
  analytics/document-metrics.json
  analysis/machine-analysis.json
  structured/summary.json
  versions/index.json

schemas/
  governance-artifact.schema.json
  manifest.schema.json

sources/
  source-registry.json

taxonomies/
  authority-echelons.json
  source-locations.json

manifest.json
```

See `docs/repo-hierarchy.md` for the artifact envelope and authority stack.

## Commands

```bash
npm run seed
npm run validate
```

`npm run seed` fetches the current seed set from official sources where automation is allowed. `npm run validate` checks schema-critical fields, paths, checksums, and lifecycle consistency.

## Policy

Do not commit secrets, access-gated material, or non-public artifacts. Public official artifacts only until repository access controls and licensing rules say otherwise.
