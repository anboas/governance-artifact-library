# Source Acquisition Queue

Generated from `data/coverage-map.json`, `data/source-discovery-map.json`, and `sources/source-discovery-registry.json`.

## Summary

- Queue items: 65
- P0: 17
- P1: 17
- P2: 31
- Governance gaps: 13
- Source starts: 38
- Source recovery: 8
- Coverage completion: 6

## Top Queue

| Rank | Priority | Type | Item | Source | Automation | Score | Recommended Action |
| ---: | --- | --- | --- | --- | --- | ---: | --- |
| 1 | P0 | source_recovery | Department of the Navy Issuances mirror recovery | Department of the Navy Issuances | blocked_by_host | 107 | Capture official source files through browser/manual import fallback. |
| 2 | P0 | source_recovery | DISA STIG Library mirror recovery | DISA STIG Library | browser_shell_detected | 106 | Run browser-assisted source capture and store raw mirrors. |
| 3 | P0 | source_recovery | DoD CIO mirror recovery | DoD CIO | blocked_by_host | 105 | Capture official source files through browser/manual import fallback. |
| 4 | P0 | source_recovery | DoW/DoD Issuances mirror recovery | DoW/DoD Issuances | blocked_by_host | 104 | Capture official source files through browser/manual import fallback. |
| 5 | P0 | governance_gap | Appropriations Law coverage gap | GovInfo | direct_fetch_ready | 102 | Use GovInfo to discover and register the first Appropriations Law artifact. |
| 6 | P0 | source_recovery | Air Force e-Publishing mirror recovery | Air Force e-Publishing | needs_probe | 101 | Capture official source files through browser/manual import fallback. |
| 7 | P0 | source_recovery | DoD Cyber Exchange mirror recovery | DoD Cyber Exchange | browser_shell_detected | 101 | Run browser-assisted source capture and store raw mirrors. |
| 8 | P0 | source_recovery | MyNavyHR mirror recovery | MyNavyHR | blocked_by_host | 101 | Capture official source files through browser/manual import fallback. |
| 9 | P0 | governance_gap | DFARS / Defense Acquisition Regulation coverage gap | Acquisition.gov | direct_fetch_ready | 100 | Use Acquisition.gov to discover and register the first DFARS / Defense Acquisition Regulation artifact. |
| 10 | P0 | governance_gap | OSTP / Executive Office Guidance coverage gap | OMB | direct_fetch_ready | 100 | Use OMB to discover and register the first OSTP / Executive Office Guidance artifact. |
| 11 | P0 | governance_gap | Presidential Memorandum coverage gap | Federal Register | direct_fetch_ready | 100 | Use Federal Register to discover and register the first Presidential Memorandum artifact. |
| 12 | P0 | governance_gap | DoW/DoD DTM coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD DTM artifact. |
| 13 | P0 | governance_gap | DoW/DoD Manual coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD Manual artifact. |
| 14 | P0 | source_recovery | U.S. Cyber Command mirror recovery | U.S. Cyber Command | needs_probe | 98 | Capture official source files through browser/manual import fallback. |
| 15 | P0 | governance_gap | DoD CIO Guidance coverage gap | DoD CIO | blocked_by_host | 96 | Use DoD CIO to discover and register the first DoD CIO Guidance artifact. |
| 16 | P0 | source_start | National Archives Executive Orders initial ingest | National Archives Executive Orders | direct_fetch_ready | 96 | Probe source discovery surface and seed the first official artifacts. |
| 17 | P0 | governance_gap | SECNAV Instruction coverage gap | Department of the Navy Issuances | blocked_by_host | 96 | Use Department of the Navy Issuances to discover and register the first SECNAV Instruction artifact. |
| 18 | P1 | source_start | GovInfo CFR Packages initial ingest | GovInfo CFR Packages | direct_fetch_ready | 95 | Configure API access or fallback search capture, then seed first source-known artifacts. |
| 19 | P1 | governance_gap | CISA Guidance / Model coverage gap | CISA | direct_fetch_ready | 94 | Use CISA to discover and register the first CISA Guidance / Model artifact. |
| 20 | P1 | source_start | Congress.gov initial ingest | Congress.gov | api_key_required | 93 | Configure API access or fallback search capture, then seed first source-known artifacts. |
| 21 | P1 | source_start | CISA initial ingest | CISA | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 22 | P1 | source_start | DAU Adaptive Acquisition Framework initial ingest | DAU Adaptive Acquisition Framework | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 23 | P1 | source_start | eCFR initial ingest | eCFR | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 24 | P1 | source_start | FedRAMP initial ingest | FedRAMP | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 25 | P1 | governance_gap | Joint Staff Instruction / Manual coverage gap | CJCS Directives Library | needs_probe | 92 | Use CJCS Directives Library to discover and register the first Joint Staff Instruction / Manual artifact. |
| 26 | P1 | source_start | NIST AI Risk Management Framework initial ingest | NIST AI Risk Management Framework | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 27 | P1 | source_start | NIST NCCoE initial ingest | NIST NCCoE | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 28 | P1 | governance_gap | ALNAV coverage gap | MyNavyHR | blocked_by_host | 90 | Use MyNavyHR to discover and register the first ALNAV artifact. |
| 29 | P1 | source_start | Defense Pricing, Contracting, and Acquisition Policy initial ingest | Defense Pricing, Contracting, and Acquisition Policy | needs_probe | 90 | Probe source discovery surface and seed the first official artifacts. |
| 30 | P1 | governance_gap | Program Office / Echelon 4 Guidance coverage gap | Chief Digital and Artificial Intelligence Office | needs_probe | 90 | Use Chief Digital and Artificial Intelligence Office to discover and register the first Program Office / Echelon 4 Guidance artifact. |
| 31 | P1 | coverage_completion | DoW/DoD Strategy completion | DoD CIO | blocked_by_host | 88 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 32 | P1 | source_start | GSA Policy and Regulations initial ingest | GSA Policy and Regulations | direct_fetch_ready | 88 | Probe source discovery surface and seed the first official artifacts. |
| 33 | P1 | source_start | Law Library of Congress initial ingest | Law Library of Congress | direct_fetch_ready | 88 | Probe source discovery surface and seed the first official artifacts. |
| 34 | P1 | source_start | OPM Policy initial ingest | OPM Policy | direct_fetch_ready | 88 | Probe source discovery surface and seed the first official artifacts. |
| 35 | P2 | source_start | Chief Digital and Artificial Intelligence Office initial ingest | Chief Digital and Artificial Intelligence Office | needs_probe | 86 | Probe source discovery surface and seed the first official artifacts. |
| 36 | P2 | source_start | CJCS Directives Library initial ingest | CJCS Directives Library | needs_probe | 86 | Probe source discovery surface and seed the first official artifacts. |
| 37 | P2 | source_start | Committee on National Security Systems initial ingest | Committee on National Security Systems | needs_probe | 86 | Probe source discovery surface and seed the first official artifacts. |
| 38 | P2 | governance_gap | Fleet / Type Command Guidance coverage gap | NAVAIR | needs_probe | 86 | Use NAVAIR to discover and register the first Fleet / Type Command Guidance artifact. |
| 39 | P2 | source_start | Joint Electronic Library initial ingest | Joint Electronic Library | needs_probe | 86 | Probe source discovery surface and seed the first official artifacts. |
| 40 | P2 | coverage_completion | OPNAV Instruction completion | Department of the Navy Issuances | blocked_by_host | 86 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 41 | P2 | coverage_completion | SECNAV Manual completion | Department of the Navy Issuances | blocked_by_host | 86 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 42 | P2 | source_start | USD(A&S) initial ingest | USD(A&S) | needs_probe | 86 | Probe source discovery surface and seed the first official artifacts. |
| 43 | P2 | coverage_completion | NAVADMIN completion | MyNavyHR | blocked_by_host | 84 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 44 | P2 | source_start | Army Doctrine Publications initial ingest | Army Doctrine Publications | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 45 | P2 | source_start | Army Publishing Directorate initial ingest | Army Publishing Directorate | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 46 | P2 | source_start | DAU ACQuipedia initial ingest | DAU ACQuipedia | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 47 | P2 | source_start | DISA initial ingest | DISA | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 48 | P2 | source_start | Joint Staff Directives initial ingest | Joint Staff Directives | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 49 | P2 | source_start | MARADMIN Messages initial ingest | MARADMIN Messages | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 50 | P2 | source_start | Marine Corps Publications Electronic Library initial ingest | Marine Corps Publications Electronic Library | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 51 | P2 | source_start | NAVAIR initial ingest | NAVAIR | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 52 | P2 | source_start | NAVSEA initial ingest | NAVSEA | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 53 | P2 | source_start | NAVWAR initial ingest | NAVWAR | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 54 | P2 | source_start | Navy Warfare Library initial ingest | Navy Warfare Library | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 55 | P2 | source_start | NSA Cybersecurity Guidance initial ingest | NSA Cybersecurity Guidance | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 56 | P2 | source_start | Space Force Doctrine initial ingest | Space Force Doctrine | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 57 | P2 | source_start | TRADOC Publications initial ingest | TRADOC Publications | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 58 | P2 | source_start | USD(R&E) initial ingest | USD(R&E) | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 59 | P2 | coverage_completion | DoW/DoD Directive completion | DoW/DoD Issuances | blocked_by_host | 80 | Regenerate missing sidecars until the item is analysis-ready. |
| 60 | P2 | coverage_completion | DoW/DoD Instruction completion | DoW/DoD Issuances | blocked_by_host | 80 | Regenerate missing sidecars until the item is analysis-ready. |
| 61 | P2 | source_start | Air Force Materiel Command initial ingest | Air Force Materiel Command | needs_probe | 78 | Probe source discovery surface and seed the first official artifacts. |
| 62 | P2 | source_start | Coast Guard Directives System initial ingest | Coast Guard Directives System | needs_probe | 78 | Probe source discovery surface and seed the first official artifacts. |
| 63 | P2 | source_start | NAVFAC initial ingest | NAVFAC | needs_probe | 78 | Probe source discovery surface and seed the first official artifacts. |
| 64 | P2 | source_start | PEO Digital initial ingest | PEO Digital | needs_probe | 78 | Probe source discovery surface and seed the first official artifacts. |
| 65 | P2 | source_start | U.S. Special Operations Command initial ingest | U.S. Special Operations Command | needs_probe | 78 | Probe source discovery surface and seed the first official artifacts. |
