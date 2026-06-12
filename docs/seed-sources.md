# Seed Sources

The initial seed set intentionally mixes fully mirrored official artifacts with source-known records from official hosts that blocked automated capture.

## Mirrored

- `eo-14110-ai`: Federal Register HTML
- `eo-14028-cybersecurity`: Federal Register HTML
- `omb-m-24-10-ai-governance`: White House PDF
- `omb-m-21-31-cyber-logging`: White House PDF
- `usc-title-10-section-2222`: U.S. Code HTML
- `far-part-39-acquisition-of-it`: Acquisition.gov HTML
- `nist-sp-800-53-r5-security-privacy-controls`: NIST CSRC HTML

## Source-Known / Blocked

These official sources were identified and registered, but the raw hosts rejected automated capture during seeding. They remain `source_known` with `mirror_status: blocked`.

- `dodd-5000-01-defense-acquisition-system`: DoW/DoD Issuances
- `dodi-5000-87-software-acquisition-pathway`: DoW/DoD Issuances
- `dodi-8510-01-risk-management-framework`: DoW/DoD Issuances
- `secnav-m-5210-1-records-management`: Department of the Navy Issuances
- `opnavinst-5239-1e-navy-cybersecurity`: Department of the Navy Issuances

## Rule

Do not replace blocked records with unofficial mirrors unless the artifact explicitly records the alternate source and keeps the official source URL as canonical provenance.
