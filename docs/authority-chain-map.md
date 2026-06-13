# Authority Chain Map

Generated: 2026-06-13T13:55:00.000Z

- Artifacts: 24
- Nodes: 24
- Edges: 64
- Evidence-backed reference edges: 22
- Inferred flowdown edges: 42

## Lanes

| Lane | Meaning |
| --- | --- |
| Law | Public law / NDAA |
| Statute | U.S. Code / statutory note |
| Executive | Executive order / presidential directive |
| Gov-wide | OMB / NIST / CFR / FAR |
| DoD | DoDD / DoDI / DoDM / strategy |
| Service | SECNAV / OPNAV / service pubs |
| Echelon 2 | component / program implementation |
| Echelon 3-4 | operational guidance / SOP / evidence |

## Artifact Summary

| Artifact | Upstream | Downstream | Gaps | Status |
| --- | ---: | ---: | ---: | --- |
| pl-118-159-fy2025-ndaa | 5 | 4 | 18 | root_authority |
| pl-118-31-fy2024-ndaa | 5 | 4 | 18 | root_authority |
| usc-title-10-section-113 | 2 | 4 | 18 | root_authority |
| usc-title-10-section-2222 | 2 | 2 | 1 | root_authority |
| usc-title-10-section-2224 | 3 | 3 | 18 | root_authority |
| usc-title-10-section-4001 | 5 | 2 | 18 | root_authority |
| usc-title-44-section-3502 | 0 | 4 | 3 | root_authority |
| usc-title-50-section-3003 | 0 | 5 | 1 | root_authority |
| eo-14028-cybersecurity | 2 | 4 | 3 | evidence_backed |
| eo-14110-ai | 1 | 2 | 18 | evidence_backed |
| omb-m-21-31-cyber-logging | 3 | 3 | 1 | evidence_backed |
| omb-m-24-10-ai-governance | 4 | 0 | 7 | evidence_backed |
| far-part-39-acquisition-of-it | 0 | 1 | 6 | authority_gap |
| nist-sp-800-207-zero-trust-architecture | 1 | 4 | 1 | inferred_review_needed |
| nist-sp-800-53-r5-security-privacy-controls | 0 | 0 | 0 | authority_gap |
| dodd-5000-01-defense-acquisition-system | 1 | 4 | 0 | inferred_review_needed |
| dodi-5000-87-software-acquisition-pathway | 1 | 2 | 0 | inferred_review_needed |
| dodi-8510-01-risk-management-framework | 2 | 4 | 0 | inferred_review_needed |
| dod-zero-trust-strategy | 4 | 4 | 0 | inferred_review_needed |
| secnav-m-5210-1-records-management | 0 | 2 | 0 | authority_gap |
| secnav-m-5239-3-don-cybersecurity | 5 | 3 | 0 | inferred_review_needed |
| opnavinst-5239-1e-navy-cybersecurity | 7 | 2 | 0 | inferred_review_needed |
| cyber-mil-cyber-awareness-challenge | 6 | 1 | 0 | inferred_review_needed |
| navadmin-214-24-fy2025-cybersecurity-awareness | 5 | 0 | 0 | inferred_review_needed |

## Edge Sample

| Source | Relationship | Target | Evidence | Confidence |
| --- | --- | --- | --- | ---: |
| DoDD 5000.01 | flows_down | DoD Zero Trust Strategy | inferred_flowdown | 0.73 |
| DoDD 5000.01 | flows_down | DoDI 5000.87 | inferred_flowdown | 0.73 |
| DoDD 5000.01 | flows_down | DoDI 8510.01 | inferred_flowdown | 0.73 |
| DoDI 5000.87 | flows_down | DoD Zero Trust Strategy | inferred_flowdown | 0.73 |
| DoDI 8510.01 | flows_down | DoD Zero Trust Strategy | inferred_flowdown | 0.78 |
| DoD Zero Trust Strategy | flows_down | Cyber Awareness Challenge | inferred_flowdown | 0.78 |
| DoDD 5000.01 | flows_down | Cyber Awareness Challenge | inferred_flowdown | 0.73 |
| DoDI 5000.87 | flows_down | Cyber Awareness Challenge | inferred_flowdown | 0.73 |
| DoDI 8510.01 | flows_down | Cyber Awareness Challenge | inferred_flowdown | 0.78 |
| DoD Zero Trust Strategy | verifies_or_localizes | NAVADMIN 214/24 | inferred_flowdown | 0.59 |
| DoD Zero Trust Strategy | service_adopts | OPNAVINST 5239.1E | inferred_flowdown | 0.66 |
| DoD Zero Trust Strategy | service_adopts | SECNAV M-5239.3 | inferred_flowdown | 0.66 |
| DoDI 8510.01 | service_adopts | OPNAVINST 5239.1E | inferred_flowdown | 0.66 |
| DoDI 8510.01 | service_adopts | SECNAV M-5239.3 | inferred_flowdown | 0.66 |
| Cyber Awareness Challenge | localizes | NAVADMIN 214/24 | inferred_flowdown | 0.78 |
| EO 14028 | directs | OMB M-21-31 | resolved_reference | 0.94 |
| EO 14028 | directs | OMB M-21-31 | inferred_flowdown | 0.78 |
| EO 14110 | directs | OMB M-24-10 | resolved_reference | 0.94 |
| EO 14110 | directs | OMB M-24-10 | inferred_flowdown | 0.78 |
| EO 14028 | flows_down | OPNAVINST 5239.1E | inferred_flowdown | 0.78 |
| EO 14028 | flows_down | SECNAV M-5239.3 | inferred_flowdown | 0.78 |
| FAR Part 39 | implements | DoDD 5000.01 | inferred_flowdown | 0.78 |
| NIST SP 800-207 | implements | DoD Zero Trust Strategy | inferred_flowdown | 0.78 |
| NIST SP 800-207 | implements | DoDI 8510.01 | inferred_flowdown | 0.59 |
| OMB M-21-31 | flows_down | NIST SP 800-207 | inferred_flowdown | 0.59 |
| NIST SP 800-207 | flows_down | OPNAVINST 5239.1E | inferred_flowdown | 0.59 |
| NIST SP 800-207 | flows_down | SECNAV M-5239.3 | inferred_flowdown | 0.66 |
| OMB M-21-31 | flows_down | OPNAVINST 5239.1E | inferred_flowdown | 0.78 |
| OMB M-21-31 | flows_down | SECNAV M-5239.3 | inferred_flowdown | 0.78 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 113 | resolved_reference | 0.94 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 113 | inferred_flowdown | 0.66 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 2222 | resolved_reference | 0.94 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 2222 | inferred_flowdown | 0.66 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 2224 | resolved_reference | 0.94 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 2224 | inferred_flowdown | 0.66 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 4001 | resolved_reference | 0.94 |
| FY2024 NDAA | codifies_or_creates_note | 10 U.S.C. 4001 | inferred_flowdown | 0.66 |
| FY2024 NDAA | codifies_or_creates_note | 50 U.S.C. 3003 | resolved_reference | 0.94 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 113 | resolved_reference | 0.94 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 113 | inferred_flowdown | 0.66 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 2222 | resolved_reference | 0.94 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 2222 | inferred_flowdown | 0.66 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 2224 | resolved_reference | 0.94 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 2224 | inferred_flowdown | 0.66 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 4001 | resolved_reference | 0.94 |
| FY2025 NDAA | codifies_or_creates_note | 10 U.S.C. 4001 | inferred_flowdown | 0.66 |
| FY2025 NDAA | codifies_or_creates_note | 50 U.S.C. 3003 | resolved_reference | 0.94 |
| OPNAVINST 5239.1E | component_executes | Cyber Awareness Challenge | inferred_flowdown | 0.59 |
| SECNAV M-5239.3 | component_executes | Cyber Awareness Challenge | inferred_flowdown | 0.59 |
| OPNAVINST 5239.1E | verifies_or_localizes | NAVADMIN 214/24 | inferred_flowdown | 0.66 |
| SECNAV M-5210.1 | verifies_or_localizes | NAVADMIN 214/24 | inferred_flowdown | 0.59 |
| SECNAV M-5239.3 | verifies_or_localizes | NAVADMIN 214/24 | inferred_flowdown | 0.66 |
| SECNAV M-5210.1 | flows_down | OPNAVINST 5239.1E | inferred_flowdown | 0.59 |
| SECNAV M-5239.3 | flows_down | OPNAVINST 5239.1E | inferred_flowdown | 0.78 |
| 44 U.S.C. 3502 | authorizes | EO 14028 | resolved_reference | 0.94 |
| 44 U.S.C. 3502 | authorizes | EO 14110 | resolved_reference | 0.94 |
| 50 U.S.C. 3003 | authorizes | EO 14028 | resolved_reference | 0.94 |
| 44 U.S.C. 3502 | authorizes | OMB M-21-31 | resolved_reference | 0.94 |
| 44 U.S.C. 3502 | authorizes | OMB M-24-10 | resolved_reference | 0.94 |
| 50 U.S.C. 3003 | authorizes | OMB M-24-10 | resolved_reference | 0.94 |
| 10 U.S.C. 113 | references | 10 U.S.C. 2224 | resolved_reference | 0.94 |
| 10 U.S.C. 113 | references | 10 U.S.C. 4001 | resolved_reference | 0.94 |
| 10 U.S.C. 2224 | references | 10 U.S.C. 4001 | resolved_reference | 0.94 |
| 50 U.S.C. 3003 | references | 10 U.S.C. 4001 | resolved_reference | 0.94 |

