# Repository Hierarchy

This repository is the canonical mirror for Governance Artifacts. It is optimized for version control, repeatable extraction, and downstream analytics.

## Artifact Envelope

Each artifact owns the same folder contract:

```text
artifacts/<artifact-id>/
  artifact.json                    # canonical normalized record
  provenance.json                  # capture source and method
  raw/source.<ext>                 # current mirrored source document
  text/extracted.txt               # full text extraction from current source
  metadata/metadata.json           # normalized metadata and source shape
  analytics/document-metrics.json  # machine-computable document metrics
  analysis/machine-analysis.json   # bootstrap analysis and review notes
  structured/summary.json          # app/indexer-facing structured summary
  versions/index.json              # explicit source-version ledger
```

Blocked official hosts still receive `artifact.json`, `provenance.json`, `metadata/`, `analytics/`, `analysis/`, and `versions/`. They do not receive raw, text, or structured summaries until the source is actually mirrored.

## Authority Stack

The corpus should cover the full policy stack:

1. Law and public law, including NDAAs.
2. U.S. Code.
3. Executive Orders and presidential direction.
4. OMB and federal executive branch guidance.
5. Federal regulations and standards.
6. DoW/DoD directives, instructions, strategies, and manuals.
7. Component and service secretariat guidance.
8. Service headquarters instructions.
9. Operational messages and lower-echelon implementation guidance.

The app can layer local storage, user review state, and custom analytics on top. This repo keeps the source mirror and machine-readable corpus state.

## Taxonomy Files

Machine-readable taxonomy lives in `taxonomies/`:

- `authority-echelons.json`: ordering and meaning of authority levels.
- `source-locations.json`: official source systems and expected capture behavior.

Artifacts use `authority_level`, `hierarchy_rank`, `family`, `jurisdiction`, `source_system`, and `source_location_type` so downstream jobs can group without guessing from titles.
