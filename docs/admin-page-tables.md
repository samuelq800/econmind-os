# Complete page tables

Platform administrators can open **View complete tables**:

- `/team`: all appointments, Founding Team, Regional Leadership, Communications,
  Technology, and the regional index. Each appointment is a separate row; multiple
  departmental roles are not silently merged. Contacts are the existing public
  directory contacts, including secondary contacts.
- `/season1` → **Admin overview**: all current teams, every team member, and six
  summary metrics. The existing guarded admin RPC is the source; participant
  discovery cards, search results, or paginated subsets are never export sources.
  Dissolved teams are excluded, consistent with the overview. Free agents are
  counted separately, not represented as team members. No emails or private chats
  are added. User/team IDs and server snapshot times support reconciliation.

Search matches every column but affects only the displayed rows. **Download full
CSV** always exports all rows and every column of the selected table. UTF-8 BOM,
quoted fields and spreadsheet formula neutralization preserve Chinese, commas,
quotes, multiline descriptions, and safe phone-number imports. Dates in Season 1
CSV remain the raw server UTC timestamps. CSV files can be opened in Excel.

The tables reuse the overview's stable Realtime/refresh lifecycle, with no extra
subscriptions or RPCs. Open tables reflect new snapshots. Failed refreshes retain
the previous view with a warning and disable downloads until a successful fetch.
The auth wrapper hides/unmounts controls for signed-out, non-admin or unresolved
accounts, and resets state when the signed-in user changes. Confidential data
remains independently admin-authorized on the server. The directory itself
remains public; this does not prevent people copying its existing public content.

## One-time pending-application maintenance

`Maintenance · Approve inspected Season 1 applications` is manual, main-only,
protected-secret, and pinned to the existing EconMind production project.
`preview` logs only a pending count and UUID-list fingerprint. `approve` requires
that exact fingerprint, rechecks the batch under locks and attempts one atomic
write; it never automatically retries uncertain writes. Run it only for an
explicitly authorized batch, not as recurring background approval.

The operator SQL creates no persistent function/table/policy and never forges a
user session. It retains roster locks, capacity and unique membership rules.
Eligible applicants join and their pending application is accepted; existing
members of that same team have the stale pending record confirmed. Applicants in
another team, inactive accounts and locked/full teams remain pending with reason
counts. No competing applications are silently rejected. Successful joins remove
their free-agent listings just as normal joining does; no team, membership,
profile or message history is deleted. `reviewed_by` is NULL because this is an
operator action, not a human account acting through the UI; the workflow receipt
records operator identity/time. No applicant details are published in workflow
logs. Other seasons and requests created outside the inspected batch are untouched.

Tests cover table completeness beyond 1,000 members, export independence from
search, CSV escaping, administrator visibility, stale-export prevention, and
disposable PostgreSQL approval rollback/conflicts/scope. This is frontend-only
except for the explicitly requested one-time data operation; do not run unrelated
migrations or publishers as part of release.
