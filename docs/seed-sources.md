# Seed Sources

The initial seed set intentionally mixes fully mirrored official artifacts with source-known records from official hosts that blocked automated capture.

## Mirrored

- `pl-118-31-fy2024-ndaa`: GovInfo Public Law PDF
- `pl-118-159-fy2025-ndaa`: GovInfo Public Law PDF
- `eo-14110-ai`: Federal Register API raw text
- `eo-14028-cybersecurity`: Federal Register API raw text
- `omb-m-24-10-ai-governance`: White House PDF
- `omb-m-21-31-cyber-logging`: White House PDF
- `usc-title-10-section-2222`: U.S. Code HTML
- `far-part-39-acquisition-of-it`: Acquisition.gov HTML
- `nist-sp-800-53-r5-security-privacy-controls`: NIST CSRC HTML
- `nist-sp-800-207-zero-trust-architecture`: NIST NVL Publications PDF

## Source-Known / Blocked

These official sources were identified and registered, but the raw hosts rejected automated capture during seeding. They remain `source_known` with `mirror_status: blocked`.

- `dodd-5000-01-defense-acquisition-system`: DoW/DoD Issuances
- `dodi-5000-87-software-acquisition-pathway`: DoW/DoD Issuances
- `dodi-8510-01-risk-management-framework`: DoW/DoD Issuances
- `cyber-mil-cyber-awareness-challenge`: DoD Cyber Exchange
- `dod-zero-trust-strategy`: DoD CIO
- `secnav-m-5210-1-records-management`: Department of the Navy Issuances
- `secnav-m-5239-3-don-cybersecurity`: Department of the Navy Issuances
- `opnavinst-5239-1e-navy-cybersecurity`: Department of the Navy Issuances
- `navadmin-214-24-fy2025-cybersecurity-awareness`: MyNavyHR NAVADMIN text

## Rule

Do not replace blocked records with unofficial mirrors unless the artifact explicitly records the alternate source and keeps the official source URL as canonical provenance.
