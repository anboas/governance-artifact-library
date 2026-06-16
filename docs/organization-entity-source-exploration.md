# Organization / Entity Source Exploration

Generated from the current artifact analytics map, DoW/DoD issuance catalog OPR fields, source discovery registry, and reference source-discovery queue.

Scope: superficial enumeration only. This map does not mirror new raw files, extract text, generate claims, or infer relationships.

## Summary

- Current density organizations: 59
- DoW/DoD OPR entities found: 17
- DoW/DoD OPR-to-artifact links enumerated: 1147
- OPR entities missing from current density labels: 0
- Source-owner entities tracked: 65
- Source-owner entities missing or empty in current density: 25
- Reference-discovery source candidates: 7732

## DoW/DoD OPR Entities

| Entity | Code | In Current Density | Artifacts | Public | Restricted |
| --- | --- | --- | ---: | ---: | ---: |
| Under Secretary of War for Personnel and Readiness | USW(P&R) | yes | 373 | 372 | 1 |
| Under Secretary of War for Acquisition and Sustainment | USW(A&S) | yes | 187 | 182 | 5 |
| Under Secretary of War for Intelligence and Security | USW(I&S) | yes | 121 | 113 | 8 |
| Director of Administration and Management | DA&M | yes | 119 | 113 | 6 |
| Under Secretary of War for Policy | USW(P) | yes | 104 | 97 | 7 |
| Department of War Chief Information Officer | DoW CIO | yes | 71 | 65 | 6 |
| Under Secretary of War for Research and Engineering | USW(R&E) | yes | 48 | 46 | 2 |
| General Counsel of the Department of War | GC DoW | yes | 41 | 41 | 0 |
| Inspector General of the Department of War | IG DoW | yes | 28 | 28 | 0 |
| Assistant to the Secretary of War for Public Affairs | ATSW(PA) | yes | 22 | 22 | 0 |
| Assistant Secretary of War for Special Operations and Low-Intensity Conflict | ASW(SO/LIC) | yes | 8 | 8 | 0 |
| Under Secretary of War Comptroller / Chief Financial Officer | USW(C)/CFO | yes | 8 | 8 | 0 |
| Director, Cost Assessment and Program Evaluation | DCAPE | yes | 5 | 5 | 0 |
| Assistant Secretary of War for Legislative Affairs | ASW(LA) | yes | 4 | 4 | 0 |
| Director, Operational Test and Evaluation | DOT&E | yes | 4 | 4 | 0 |
| Executive Secretary of the Office of the Secretary of War | ES OSD | yes | 2 | 2 | 0 |
| Washington Headquarters Services | WHS | yes | 2 | 2 | 0 |

## Source-Owner Gaps

| Source | Owner | Priority | Automation | Status | Artifacts | Reference Candidates |
| --- | --- | --- | --- | --- | ---: | ---: |
| Federal Register | Office of the Federal Register / National Archives and Records Administration | critical | direct_fetch_ready | mirrored | 17 | 296 |
| Congress.gov | Library of Congress | critical | api_key_required | not_started | 0 | 162 |
| Acquisition.gov DFARS | Defense Acquisition Regulations System | critical | direct_fetch_ready | mirrored | 1 | 22 |
| Defense Pricing, Contracting, and Acquisition Policy | Defense Pricing and Contracting | critical | needs_probe | not_started | 0 | 22 |
| eCFR | Office of the Federal Register / National Archives and Records Administration | high | direct_fetch_ready | not_started | 0 | 81 |
| GovInfo CFR Packages | U.S. Government Publishing Office | high | direct_fetch_ready | not_started | 0 | 81 |
| CISA | Cybersecurity and Infrastructure Security Agency | high | direct_fetch_ready | not_started | 0 | 0 |
| Committee on National Security Systems | Committee on National Security Systems | high | needs_probe | not_started | 0 | 0 |
| DAU Adaptive Acquisition Framework | Defense Acquisition University | high | direct_fetch_ready | not_started | 0 | 0 |
| FedRAMP | General Services Administration | high | direct_fetch_ready | not_started | 0 | 0 |
| Joint Electronic Library | Joint Chiefs of Staff | high | needs_probe | not_started | 0 | 0 |
| NIST AI Risk Management Framework | National Institute of Standards and Technology | high | direct_fetch_ready | not_started | 0 | 0 |
| NIST NCCoE | National Cybersecurity Center of Excellence | high | direct_fetch_ready | not_started | 0 | 0 |
| Office of Science and Technology Policy | Office of Science and Technology Policy | high | direct_fetch_ready | mirrored | 2 | 0 |
| USD(A&S) | Office of the Under Secretary of Defense for Acquisition and Sustainment | high | needs_probe | not_started | 0 | 0 |
| DAU ACQuipedia | Defense Acquisition University | medium | needs_probe | not_started | 0 | 0 |
| DISA | Defense Information Systems Agency | medium | needs_probe | not_started | 0 | 0 |
| GSA Policy and Regulations | General Services Administration | medium | direct_fetch_ready | not_started | 0 | 0 |
| Law Library of Congress | Library of Congress | medium | direct_fetch_ready | not_started | 0 | 0 |
| MARADMIN Messages | United States Marine Corps | medium | needs_probe | not_started | 0 | 0 |
| Navy Warfare Library | Department of the Navy | medium | needs_probe | not_started | 0 | 0 |
| OPM Policy | Office of Personnel Management | medium | direct_fetch_ready | not_started | 0 | 0 |
| Space Force Doctrine | United States Space Force | medium | needs_probe | not_started | 0 | 0 |
| USD(R&E) | Office of the Under Secretary of Defense for Research and Engineering | medium | needs_probe | not_started | 0 | 0 |
| PEO Digital | Program Executive Office Digital and Enterprise Services | low | needs_probe | not_started | 0 | 0 |

## Full Enumeration

- Full OPR artifact lists are in `data/organization-entity-source-exploration.json` under `dod_opr_entities[].artifacts`.
- Full tracked source surfaces are in `source_owner_entities[]`.
- Full reference-derived source/artifact candidates remain in `data/governance-artifact-source-discovery.json` and are summarized here under `reference_discovery_source_systems`.
