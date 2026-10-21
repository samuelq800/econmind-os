# Legal Center publication · 21 October 2026

## Scope and source mapping

This is a main-website content publication and front-end integration, not a
database, authentication, World runtime, rights-assignment or compliance rollout.
Publication and visual integration were requested by the project owner. The owner
separately confirmed that existing acknowledgement records must remain unchanged.

| Approved public source | Website route |
| --- | --- |
| 01_Terms_of_Use.md | /legal/terms/ |
| 02_Privacy_Notice.md | /legal/privacy/ |
| 03_Community_Guidelines.md | /legal/community-guidelines/ |
| 04_Academic_and_Research_Integrity.md | /legal/integrity/ |
| 05_Intellectual_Property_Policy.md | /legal/intellectual-property/ |
| 06_Legal_Homepage.md | /legal/ |
| 07_About_Alignment_Copy.md | /about/ — integrated into the existing page |
| EconMind_World_About.md | /legal/world/about/ |
| EconMind_World_Terms_of_Use.md | /legal/world/terms/ |
| EconMind_World_Privacy_Notice.md | /legal/world/privacy/ |
| New navigation index, no new Terms | /legal/world/ |

The ten source Markdown files are retained byte-for-byte under `content/legal`.
`source-manifest.json` records source name, hash, byte count, edition and route.
The allowlisted importer verifies the League package's supplied checksums and
does not copy archives, DOCX compilations, internal agreements or review materials.
The complete original packages and extracted internal materials remain outside
the Git checkout and static export. No internal document route is generated.

## Publication treatment

League public policies use website version 2.0, sourced from the R2 review.
World documents use their supplied source edition rather than an invented version
number. Local previews explicitly say they are not yet effective. The production
artifact displays the approved publication date, conditional on its actual
successful publication. Deployment success and the date must be checked before
reporting the policies as published. The review date alone is not evidence of
publication, user acceptance, legal enforceability or lawyer approval.

Only the review-status preamble and technical publication/link instructions are
adapted. Definitions, clauses, order, disclaimers, rights and qualifications remain
in the body. The source Markdown is not replaced with summaries. The English
source remains available in full; no automatic Chinese legal translation is added.

## UI integration

- Existing tokens, typography, dark/light themes, responsive breakpoints and shell
  are reused. Legal pages receive the existing low-distraction reading background.
- Main-platform policies and World documents are visibly separated. Cards,
  restrained scope highlights, section-anchor highlights and active TOC navigation
  support reading without rewriting legal emphasis.
- More → Community & Legal contains the new canonical links. No new first-level
  Legal destination or third-level hover menu is introduced. The existing compact
  navigation works at all desktop widths; dropdowns have bounded scrolling.
- More's hover/click race is removed. Other navigation destinations remain.
- Footer policy links are consolidated without removing social, support or partner
  links. About retains its existing major visual sections and adds the complete
  approved alignment statement.
- Registration/setup policies link to the new publication and disclose the legacy
  receipt boundary. Neither checkbox is preselected. Reading policies does not
  grant permissions or count as version-2.0 consent.
- Research submission links to Integrity, Intellectual Property and submission
  permissions; its existing permission/AI/publication logic is untouched.
- Season 1 entrance and workspace navigation link to World Terms and Privacy,
  clearly labelled as information rather than separate consent.

## Historic URLs and versions

`/terms/`, `/privacy/`, `/community-guidelines/` and `/integrity/` remain exported
compatibility pages, each with the new canonical metadata and noindex/follow.
JavaScript uses `location.replace`, preserving query strings and mapping old
section anchors. A no-JavaScript meta-refresh and a normal link remain available.
These are **HTTP 200 static compatibility redirects, not HTTP 301**. GitHub Pages
has no repository-native HTTP redirect facility. The inspected Cloudflare gateway
is scoped to `supabase.econmind.group`, not an existing main-domain redirect layer.
No unapproved infrastructure configuration is changed.

Prior published Terms v1.2 and Privacy v1.1 remain under `/legal/previous/terms/`
and `/legal/previous/privacy/`, labelled historical and excluded from indexing.
The sitemap uses new canonical policies rather than legacy redirect addresses.

## Checks and reproduction

Run the existing lint, typecheck, tests and static production build, then:

```sh
node scripts/verify-legal-static-build.mjs
```

The verifier checks exported routes, canonical metadata, internal links, anchors,
legacy compatibility and internal-source exclusion across the complete export.
The existing Pages build runs it after export. Unit tests compare every rendered
body's text with the approved Markdown, validate source hashes, unique headings,
tables, safe rendering, cross-file anchors, navigation and unchanged Auth versions.
Browser checks cover 1440, 1024, 768 and 390 pixels, both themes, mobile TOC and
table scrolling, old bookmarks, refresh, history navigation and World cross-links.

Use the existing frontend-only release path. Its two historical database-writing
steps must remain skipped. Do not activate consent versions or deploy Auth as part
of this change.

## Outstanding implementation and policy questions

1. Auth and the database's active acknowledgement pair remain Terms 1.2 / Privacy
   1.1. No existing receipt is upgraded, erased or fabricated. Version-2.0 receipt
   activation, appropriate update notice and any required renewed or separate
   consent remain a separately authorised implementation task.
2. League R2 Terms section 1 and Privacy section 2 exclude separately governed
   World/Season 1 services; World Terms section 2 and World Privacy section 1 say
   they supplement the main-platform documents within their scopes. Both supplied
   statements remain intact. Their precise intended relationship needs policy-owner
   confirmation; this publication does not invent a priority rule or amendment.
3. Actual responsible persons and processing roles, provider locations/transfer
   arrangements, retention/deletion capabilities, directory opt-in evidence, age
   safeguards and guardian verification are not established by publishing text.
   They require separate factual and product review. No operational assurance or
   claim of completed legal compliance is inferred from these pages.
4. Registering a role, hosting work, internal coordination, a public repository or
   this release does not establish ownership, a signed contributor agreement,
   general open-source licensing, institutional endorsement or legal-person status.

No production user data, permissions, deletion logic, World economic state,
simulation settlement, database schema or authentication contract is changed.
