# Source Acquisition Queue

Generated from `data/coverage-map.json`, `data/source-discovery-map.json`, and `sources/source-discovery-registry.json`.

## Summary

- Queue items: 36
- P0: 16
- P1: 7
- P2: 13
- Governance gaps: 16
- Source starts: 11
- Source recovery: 5
- Coverage completion: 4

## Top Queue

| Rank | Priority | Type | Item | Source | Automation | Score | Recommended Action |
| ---: | --- | --- | --- | --- | --- | ---: | --- |
| 1 | P0 | source_recovery | Department of the Navy Issuances mirror recovery | Department of the Navy Issuances | blocked_by_host | 107 | Capture official source files through browser/manual import fallback. |
| 2 | P0 | source_recovery | DoD CIO mirror recovery | DoD CIO | blocked_by_host | 105 | Capture official source files through browser/manual import fallback. |
| 3 | P0 | source_recovery | DoW/DoD Issuances mirror recovery | DoW/DoD Issuances | blocked_by_host | 104 | Capture official source files through browser/manual import fallback. |
| 4 | P0 | governance_gap | Appropriations Law coverage gap | GovInfo | direct_fetch_ready | 102 | Use GovInfo to discover and register the first Appropriations Law artifact. |
| 5 | P0 | source_recovery | DoD Cyber Exchange mirror recovery | DoD Cyber Exchange | browser_shell_detected | 101 | Run browser-assisted source capture and store raw mirrors. |
| 6 | P0 | source_recovery | MyNavyHR mirror recovery | MyNavyHR | blocked_by_host | 101 | Capture official source files through browser/manual import fallback. |
| 7 | P0 | governance_gap | DFARS / Defense Acquisition Regulation coverage gap | Acquisition.gov | direct_fetch_ready | 100 | Use Acquisition.gov to discover and register the first DFARS / Defense Acquisition Regulation artifact. |
| 8 | P0 | governance_gap | Executive Order coverage gap | Federal Register | direct_fetch_ready | 100 | Use Federal Register to discover and register the first Executive Order artifact. |
| 9 | P0 | governance_gap | OSTP / Executive Office Guidance coverage gap | OMB | direct_fetch_ready | 100 | Use OMB to discover and register the first OSTP / Executive Office Guidance artifact. |
| 10 | P0 | governance_gap | Presidential Memorandum coverage gap | Federal Register | direct_fetch_ready | 100 | Use Federal Register to discover and register the first Presidential Memorandum artifact. |
| 11 | P0 | governance_gap | DoW/DoD Directive coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD Directive artifact. |
| 12 | P0 | governance_gap | DoW/DoD DTM coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD DTM artifact. |
| 13 | P0 | governance_gap | DoW/DoD Instruction coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD Instruction artifact. |
| 14 | P0 | governance_gap | DoW/DoD Manual coverage gap | DoW/DoD Issuances | blocked_by_host | 98 | Use DoW/DoD Issuances to discover and register the first DoW/DoD Manual artifact. |
| 15 | P0 | governance_gap | DoD CIO Guidance coverage gap | DoD CIO | blocked_by_host | 96 | Use DoD CIO to discover and register the first DoD CIO Guidance artifact. |
| 16 | P0 | governance_gap | SECNAV Instruction coverage gap | Department of the Navy Issuances | blocked_by_host | 96 | Use Department of the Navy Issuances to discover and register the first SECNAV Instruction artifact. |
| 17 | P1 | governance_gap | CISA Guidance / Model coverage gap | CISA | direct_fetch_ready | 94 | Use CISA to discover and register the first CISA Guidance / Model artifact. |
| 18 | P1 | source_start | Congress.gov initial ingest | Congress.gov | api_key_required | 93 | Configure API access or fallback search capture, then seed first source-known artifacts. |
| 19 | P1 | source_start | CISA initial ingest | CISA | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 20 | P1 | source_start | eCFR initial ingest | eCFR | direct_fetch_ready | 92 | Probe source discovery surface and seed the first official artifacts. |
| 21 | P1 | governance_gap | ALNAV coverage gap | MyNavyHR | blocked_by_host | 90 | Use MyNavyHR to discover and register the first ALNAV artifact. |
| 22 | P1 | coverage_completion | DoW/DoD Strategy completion | DoD CIO | blocked_by_host | 88 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 23 | P1 | governance_gap | Joint Staff Instruction / Manual coverage gap | Joint Staff Directives | needs_probe | 88 | Use Joint Staff Directives to discover and register the first Joint Staff Instruction / Manual artifact. |
| 24 | P2 | governance_gap | Fleet / Type Command Guidance coverage gap | NAVAIR | needs_probe | 86 | Use NAVAIR to discover and register the first Fleet / Type Command Guidance artifact. |
| 25 | P2 | coverage_completion | OPNAV Instruction completion | Department of the Navy Issuances | blocked_by_host | 86 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 26 | P2 | governance_gap | Program Office / Echelon 4 Guidance coverage gap | NAVAIR | needs_probe | 86 | Use NAVAIR to discover and register the first Program Office / Echelon 4 Guidance artifact. |
| 27 | P2 | coverage_completion | SECNAV Manual completion | Department of the Navy Issuances | blocked_by_host | 86 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 28 | P2 | coverage_completion | NAVADMIN completion | MyNavyHR | blocked_by_host | 84 | Recover blocked raw source files, then regenerate extraction, claims, references, authority chain, and structured summary. |
| 29 | P2 | source_start | Air Force e-Publishing initial ingest | Air Force e-Publishing | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 30 | P2 | source_start | Army Publishing Directorate initial ingest | Army Publishing Directorate | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 31 | P2 | source_start | DISA initial ingest | DISA | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 32 | P2 | source_start | Joint Staff Directives initial ingest | Joint Staff Directives | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 33 | P2 | source_start | Marine Corps Publications Electronic Library initial ingest | Marine Corps Publications Electronic Library | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 34 | P2 | source_start | NAVAIR initial ingest | NAVAIR | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 35 | P2 | source_start | NAVSEA initial ingest | NAVSEA | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
| 36 | P2 | source_start | NAVWAR initial ingest | NAVWAR | needs_probe | 82 | Probe source discovery surface and seed the first official artifacts. |
