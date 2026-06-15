# Organization / Entity Source Exploration

Generated from the current artifact analytics map, DoW/DoD issuance catalog OPR fields, source discovery registry, and reference source-discovery queue.

Scope: superficial enumeration only. This map does not mirror new raw files, extract text, generate claims, or infer relationships.

## Summary

- Current density organizations: 15
- DoW/DoD OPR entities found: 17
- DoW/DoD OPR-to-artifact links enumerated: 1147
- OPR entities missing from current density labels: 17
- Source-owner entities tracked: 60
- Source-owner entities missing or empty in current density: 43
- Reference-discovery source candidates: 7685

## DoW/DoD OPR Entities

| Entity | Code | In Current Density | Artifacts | Public | Restricted |
| --- | --- | --- | ---: | ---: | ---: |
| Under Secretary of War for Personnel and Readiness | USW(P&R) | no | 373 | 372 | 1 |
| Under Secretary of War for Acquisition and Sustainment | USW(A&S) | no | 187 | 182 | 5 |
| Under Secretary of War for Intelligence and Security | USW(I&S) | no | 121 | 113 | 8 |
| Director of Administration and Management | DA&M | no | 119 | 113 | 6 |
| Under Secretary of War for Policy | USW(P) | no | 104 | 97 | 7 |
| Department of War Chief Information Officer | DoW CIO | no | 71 | 65 | 6 |
| Under Secretary of War for Research and Engineering | USW(R&E) | no | 48 | 46 | 2 |
| General Counsel of the Department of War | GC DoW | no | 41 | 41 | 0 |
| Inspector General of the Department of War | IG DoW | no | 28 | 28 | 0 |
| Assistant to the Secretary of War for Public Affairs | ATSW(PA) | no | 22 | 22 | 0 |
| Assistant Secretary of War for Special Operations and Low-Intensity Conflict | ASW(SO/LIC) | no | 8 | 8 | 0 |
| Under Secretary of War Comptroller / Chief Financial Officer | USW(C)/CFO | no | 8 | 8 | 0 |
| Director, Cost Assessment and Program Evaluation | DCAPE | no | 5 | 5 | 0 |
| Assistant Secretary of War for Legislative Affairs | ASW(LA) | no | 4 | 4 | 0 |
| Director, Operational Test and Evaluation | DOT&E | no | 4 | 4 | 0 |
| Executive Secretary of the Office of the Secretary of War | ES OSD | no | 2 | 2 | 0 |
| Washington Headquarters Services | WHS | no | 2 | 2 | 0 |

## Source-Owner Gaps

| Source | Owner | Priority | Automation | Status | Artifacts | Reference Candidates |
| --- | --- | --- | --- | --- | ---: | ---: |
| Federal Register | Office of the Federal Register / National Archives and Records Administration | critical | direct_fetch_ready | mirrored | 17 | 296 |
| National Archives Executive Orders | National Archives and Records Administration | critical | direct_fetch_ready | mirrored | 8 | 296 |
| Congress.gov | Library of Congress | critical | api_key_required | not_started | 0 | 161 |
| Acquisition.gov FAR | General Services Administration | critical | direct_fetch_ready | mirrored | 1 | 10 |
| Acquisition.gov DFARS | Defense Acquisition Regulations System | critical | direct_fetch_ready | mirrored | 1 | 8 |
| Defense Pricing, Contracting, and Acquisition Policy | Defense Pricing and Contracting | critical | needs_probe | not_started | 0 | 8 |
| eCFR | Office of the Federal Register / National Archives and Records Administration | high | direct_fetch_ready | not_started | 0 | 80 |
| GovInfo CFR Packages | U.S. Government Publishing Office | high | direct_fetch_ready | not_started | 0 | 80 |
| Chief Digital and Artificial Intelligence Office | Chief Digital and Artificial Intelligence Office | high | needs_probe | not_started | 0 | 0 |
| CISA | Cybersecurity and Infrastructure Security Agency | high | direct_fetch_ready | not_started | 0 | 0 |
| CJCS Directives Library | Joint Staff | high | needs_probe | not_started | 0 | 0 |
| Committee on National Security Systems | Committee on National Security Systems | high | needs_probe | not_started | 0 | 0 |
| DAU Adaptive Acquisition Framework | Defense Acquisition University | high | direct_fetch_ready | not_started | 0 | 0 |
| FedRAMP | General Services Administration | high | direct_fetch_ready | not_started | 0 | 0 |
| Joint Electronic Library | Joint Chiefs of Staff | high | needs_probe | not_started | 0 | 0 |
| MyNavyHR | Navy Personnel Command | high | blocked_by_host | source_known_blocked | 1 | 0 |
| NIST AI Risk Management Framework | National Institute of Standards and Technology | high | direct_fetch_ready | not_started | 0 | 0 |
| NIST NCCoE | National Cybersecurity Center of Excellence | high | direct_fetch_ready | not_started | 0 | 0 |
| Office of Science and Technology Policy | Office of Science and Technology Policy | high | direct_fetch_ready | mirrored | 2 | 0 |
| USD(A&S) | Office of the Under Secretary of Defense for Acquisition and Sustainment | high | needs_probe | not_started | 0 | 0 |
| Army Doctrine Publications | Department of the Army | medium | needs_probe | not_started | 0 | 0 |
| Army Publishing Directorate | Department of the Army | medium | needs_probe | not_started | 0 | 0 |
| DAU ACQuipedia | Defense Acquisition University | medium | needs_probe | not_started | 0 | 0 |
| DISA | Defense Information Systems Agency | medium | needs_probe | not_started | 0 | 0 |
| GSA Policy and Regulations | General Services Administration | medium | direct_fetch_ready | not_started | 0 | 0 |
| Joint Staff Directives | Joint Staff | medium | needs_probe | not_started | 0 | 0 |
| Law Library of Congress | Library of Congress | medium | direct_fetch_ready | not_started | 0 | 0 |
| MARADMIN Messages | United States Marine Corps | medium | needs_probe | not_started | 0 | 0 |
| Marine Corps Publications Electronic Library | United States Marine Corps | medium | needs_probe | not_started | 0 | 0 |
| NAVAIR | Naval Air Systems Command | medium | needs_probe | not_started | 0 | 0 |
| NAVSEA | Naval Sea Systems Command | medium | needs_probe | not_started | 0 | 0 |
| NAVWAR | Naval Information Warfare Systems Command | medium | needs_probe | not_started | 0 | 0 |
| Navy Warfare Library | Department of the Navy | medium | needs_probe | not_started | 0 | 0 |
| NSA Cybersecurity Guidance | National Security Agency | medium | needs_probe | not_started | 0 | 0 |
| OPM Policy | Office of Personnel Management | medium | direct_fetch_ready | not_started | 0 | 0 |
| Space Force Doctrine | United States Space Force | medium | needs_probe | not_started | 0 | 0 |
| TRADOC Publications | U.S. Army Training and Doctrine Command | medium | needs_probe | not_started | 0 | 0 |
| USD(R&E) | Office of the Under Secretary of Defense for Research and Engineering | medium | needs_probe | not_started | 0 | 0 |
| Air Force Materiel Command | Air Force Materiel Command | low | needs_probe | not_started | 0 | 0 |
| Coast Guard Directives System | United States Coast Guard | low | needs_probe | not_started | 0 | 0 |

## Full Enumeration

- Full OPR artifact lists are in `data/organization-entity-source-exploration.json` under `dod_opr_entities[].artifacts`.
- Full tracked source surfaces are in `source_owner_entities[]`.
- Full reference-derived source/artifact candidates remain in `data/governance-artifact-source-discovery.json` and are summarized here under `reference_discovery_source_systems`.
