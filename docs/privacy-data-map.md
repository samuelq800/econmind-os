# EconMind OS privacy data map

This document is an implementation map for the public Privacy Notice. It describes the current application, not a future product plan.

## Service boundary

- Browser UI: Next.js application delivered from the public EconMind OS site.
- Authentication and persistent application data: Supabase Auth and PostgreSQL.
- Interactive model calculation: TypeScript in the browser. Slider changes do not write to the database unless a user deliberately saves a feature-specific result.
- Public deployment: GitHub Pages workflow and the configured custom domain.
- External AI: no paid external AI API is used for the current learning calculations or account workflow.

## Data categories and flow

| Category | Examples | Where it is handled | Visibility and access |
| --- | --- | --- | --- |
| Account identity | Auth email, password credential, authentication UUID, optional display name | Supabase Auth; `profiles` | Email and auth UUID are never part of public profile or directory queries. Auth UUID is used internally for access control. |
| Optional profile | Display name, graduation year, economics club name, role preference | `profiles` | The account holder can edit allowed fields. Platform roles and school association use privileged database workflows. |
| Personal learning work | Model runs, parameters/results JSON, favourites, learning progress, recent activity | `model_runs`, `favorites`, `learning_progress`, `recent_activity` | Row Level Security restricts ordinary users to their own records. |
| Case and experiment work | Case runs, experiment answers, submitted reasoning, teacher feedback, selected share tokens | case / experiment tables | Private to the relevant account, class, experiment, or deliberately shared report audience. |
| School and team participation | School affiliation, team membership, role, official attempts, League activity | school, team, League, and simulation tables | Public directories expose only released school/team information. Operational team and account records remain access-controlled. |
| Public Team contact cards | A named editorial team member's contact information | static Team-page data | Narrow exception: displayed only where the person expressly approved public directory contact details. It is not copied into ordinary profiles. |
| Support and rights requests | Category, subject, message, status, public response | `support_requests` | Requesters see only their own requests and final public responses. Platform administrators can process requests. |
| Moderation history | Administrative action, outcome, internal note, actor, time | `moderation_actions` | Platform-administrator only. Never shown to the requester or public directory. |
| Legal acknowledgement | Terms/Privacy version and acceptance time | `user_consents` | Account holder and platform administrator only. No IP or device fingerprint is stored by this layer. |
| Browser storage | Supabase session, theme preference, local drafts, invitation state | browser local/session storage | Stored in the user's browser to make the site work. Not used for marketing profiles. |

## Permission model

1. Supabase Auth establishes the signed-in account.
2. Row Level Security enforces ordinary ownership or defined membership boundaries in PostgreSQL.
3. Platform-administrator checks use `public.is_platform_admin(auth.uid())` inside database policies or secure RPCs.
4. The client uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No Supabase service-role key is exposed to browser code.
5. The frontend access gate improves the user experience, but database RLS and function checks remain the enforcement boundary.

## Requests and deletion workflow

- A signed-in account submits privacy, access, correction, deletion, report, appeal, or security requests through `/contact`.
- The request appears on `/profile` with status and any final response intended for the requester.
- Platform administrators process requests in `/admin/governance`; internal notes and moderation records are not exposed to the requester.
- Account deletion is a review workflow. Private account and personal workspace data are removed or anonymised as appropriate; shared League records may be retained in de-identified form where needed to preserve an activity's integrity.

## Change management

Current legal document versions are stored in `legal_document_versions` and mirrored by `lib/legal/legal-config.ts`. New registrations must acknowledge the current Terms and Privacy versions. Existing users are not interrupted while re-acknowledgement is disabled. A material revision can activate `require_reacceptance` and the corresponding frontend switch before it is relied upon.
