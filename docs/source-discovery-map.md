# Source Discovery Map

Generated from `sources/source-discovery-registry.json`, `manifest.json`, and `taxonomies/source-locations.json`.

## Summary

- Official sources tracked: 23
- Sources with artifacts in repo: 12
- Sources not started: 11
- Direct-fetch ready sources: 9
- Blocked/browser-needed sources: 5
- Sources needing probe: 8
- API-key-required sources: 2
- API-capable sources: 4
- Feed-capable sources: 4
- Sitemap-capable sources: 10

## Source Coverage

| Priority | Source | Owner | Status | Automation | Capture Strategies | Artifacts | Mirrored | Blocked | Text | Analytics | Analysis | Structured | Versioned |
| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| critical | Acquisition.gov | General Services Administration | mirrored | direct_fetch_ready | direct_fetch<br>html_parse | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 |
| critical | Congress.gov | Library of Congress | not_started | api_key_required | api<br>direct_fetch | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| critical | Department of the Navy Issuances | Department of the Navy | source_known_blocked | blocked_by_host | browser_fetch<br>manual_import<br>source_known_registration | 3 | 0 | 3 | 0 | 3 | 3 | 0 | 3 |
| critical | DoD CIO | DoD Chief Information Officer | source_known_blocked | blocked_by_host | browser_fetch<br>manual_import<br>source_known_registration | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 |
| critical | DoW/DoD Issuances | Washington Headquarters Services / Executive Services Directorate | source_known_blocked | blocked_by_host | browser_fetch<br>manual_import<br>source_known_registration | 3 | 0 | 3 | 0 | 3 | 3 | 0 | 3 |
| critical | Federal Register | Office of the Federal Register / National Archives and Records Administration | mirrored | direct_fetch_ready | api<br>direct_fetch<br>rss | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 |
| critical | GovInfo | U.S. Government Publishing Office | mirrored | direct_fetch_ready | api<br>direct_fetch<br>content_package_fetch | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 |
| critical | NIST CSRC | National Institute of Standards and Technology | mirrored | direct_fetch_ready | direct_fetch<br>html_parse<br>pdf_fetch | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 |
| critical | OMB | Office of Management and Budget | mirrored | direct_fetch_ready | direct_fetch<br>sitemap_crawl | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 |
| critical | U.S. Code | Office of the Law Revision Counsel | mirrored | direct_fetch_ready | direct_fetch<br>html_parse | 1 | 1 | 0 | 1 | 1 | 1 | 1 | 1 |
| critical | White House | Executive Office of the President | mirrored | direct_fetch_ready | direct_fetch<br>rss<br>sitemap_crawl | 2 | 2 | 0 | 2 | 2 | 2 | 2 | 2 |
| high | CISA | Cybersecurity and Infrastructure Security Agency | not_started | direct_fetch_ready | direct_fetch<br>sitemap_crawl<br>rss | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| high | DoD Cyber Exchange | DoD Cyber Exchange | source_known_blocked | browser_shell_detected | browser_fetch<br>manual_import<br>source_known_registration | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 |
| high | eCFR | Office of the Federal Register / National Archives and Records Administration | not_started | direct_fetch_ready | api<br>direct_fetch | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| high | MyNavyHR | Navy Personnel Command | source_known_blocked | blocked_by_host | browser_fetch<br>manual_import<br>source_known_registration | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 |
| medium | Air Force e-Publishing | Department of the Air Force | not_started | needs_probe | direct_fetch<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | Army Publishing Directorate | Department of the Army | not_started | needs_probe | direct_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | DISA | Defense Information Systems Agency | not_started | needs_probe | direct_fetch<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | Joint Staff Directives | Joint Staff | not_started | needs_probe | direct_fetch<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | Marine Corps Publications Electronic Library | United States Marine Corps | not_started | needs_probe | direct_fetch<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | NAVAIR | Naval Air Systems Command | not_started | needs_probe | source_discovery<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | NAVSEA | Naval Sea Systems Command | not_started | needs_probe | source_discovery<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| medium | NAVWAR | Naval Information Warfare Systems Command | not_started | needs_probe | source_discovery<br>browser_fetch<br>manual_import | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Discovery Surfaces

| Source | Landing | API | Feeds | Search | Sitemaps | Robots | Location Types | Artifacts |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Acquisition.gov | 1 | 0 | 0 | 1 | 1 | yes | acquisition_gov_html | far-part-39-acquisition-of-it |
| Congress.gov | 1 | 1 | 0 | 1 | 1 | yes | congress_gov_api<br>congress_gov_html | none |
| Department of the Navy Issuances | 1 | 0 | 0 | 1 | 0 | yes | don_issuances_pdf | secnav-m-5210-1-records-management<br>secnav-m-5239-3-don-cybersecurity<br>opnavinst-5239-1e-navy-cybersecurity |
| DoD CIO | 1 | 0 | 0 | 1 | 0 | yes | dod_cio_pdf<br>dod_cio_html | dod-zero-trust-strategy |
| DoW/DoD Issuances | 1 | 0 | 0 | 1 | 0 | yes | dod_issuances_pdf | dodd-5000-01-defense-acquisition-system<br>dodi-5000-87-software-acquisition-pathway<br>dodi-8510-01-risk-management-framework |
| Federal Register | 1 | 1 | 1 | 1 | 1 | yes | federal_register_html<br>federal_register_api | eo-14028-cybersecurity<br>eo-14110-ai |
| GovInfo | 1 | 2 | 0 | 1 | 1 | yes | govinfo_public_law_pdf | pl-118-159-fy2025-ndaa<br>pl-118-31-fy2024-ndaa |
| NIST CSRC | 1 | 0 | 1 | 1 | 1 | yes | nist_csrc_html<br>nist_nvlpubs_pdf | nist-sp-800-207-zero-trust-architecture<br>nist-sp-800-53-r5-security-privacy-controls |
| OMB | 1 | 0 | 0 | 1 | 1 | yes | white_house_pdf<br>white_house_html | omb-m-21-31-cyber-logging<br>omb-m-24-10-ai-governance |
| U.S. Code | 1 | 0 | 0 | 1 | 0 | yes | us_code_html<br>us_code_xml | usc-title-10-section-2222 |
| White House | 1 | 0 | 1 | 1 | 1 | yes | white_house_pdf<br>white_house_html | omb-m-21-31-cyber-logging<br>omb-m-24-10-ai-governance |
| CISA | 1 | 0 | 1 | 1 | 1 | yes | cisa_html<br>cisa_pdf | none |
| DoD Cyber Exchange | 1 | 0 | 0 | 1 | 1 | yes | cyber_mil_html | cyber-mil-cyber-awareness-challenge |
| eCFR | 1 | 1 | 0 | 1 | 1 | yes | ecfr_api<br>ecfr_html | none |
| MyNavyHR | 1 | 0 | 0 | 1 | 0 | yes | mynavyhr_navadmin_txt<br>mynavyhr_alnav_txt | navadmin-214-24-fy2025-cybersecurity-awareness |
| Air Force e-Publishing | 1 | 0 | 0 | 1 | 0 | yes | air_force_epubs_pdf<br>air_force_epubs_html | none |
| Army Publishing Directorate | 1 | 0 | 0 | 1 | 0 | yes | army_pubs_pdf<br>army_pubs_html | none |
| DISA | 1 | 0 | 0 | 1 | 0 | yes | disa_html<br>disa_pdf | none |
| Joint Staff Directives | 1 | 0 | 0 | 1 | 0 | yes | joint_staff_pdf | none |
| Marine Corps Publications Electronic Library | 1 | 0 | 0 | 1 | 0 | yes | marine_corps_pubs_pdf<br>marine_corps_pubs_html | none |
| NAVAIR | 1 | 0 | 0 | 1 | 0 | yes | fleet_command_pdf<br>fleet_command_html<br>program_office_pdf<br>program_office_html | none |
| NAVSEA | 1 | 0 | 0 | 1 | 0 | yes | fleet_command_pdf<br>fleet_command_html<br>program_office_pdf<br>program_office_html | none |
| NAVWAR | 1 | 0 | 0 | 1 | 0 | yes | fleet_command_pdf<br>fleet_command_html<br>program_office_pdf<br>program_office_html | none |

## Capture Strategy Counts

| Capture Strategy | Sources |
| --- | ---: |
| api | 4 |
| browser_fetch | 12 |
| content_package_fetch | 1 |
| direct_fetch | 15 |
| html_parse | 3 |
| manual_import | 13 |
| pdf_fetch | 1 |
| rss | 3 |
| sitemap_crawl | 3 |
| source_discovery | 3 |
| source_known_registration | 5 |

## Automation Status Counts

| Automation Status | Sources |
| --- | ---: |
| api_key_required | 1 |
| blocked_by_host | 4 |
| browser_shell_detected | 1 |
| direct_fetch_ready | 9 |
| needs_probe | 8 |
