# World V2 schema release runner

Status: `PREPARED_NOT_EXECUTED`.

This is the only main-site entrypoint for the reviewed World V2 schema chain.
It is manually dispatched, requires the literal confirmation
`RELEASE_WORLD_V2`, accepts only the configured project reference
`vimksjrhaxdpnkvgsavz`, and is serialized with every other production Supabase
workflow.

## Immutable source and transaction boundary

The workflow checks out the World repository at
`02f59be5026cdf2131eaf6e7fd907d5b87e987b3` from its canonical origin URL. It
rejects a dirty checkout, then invokes that exact checkout's
`loadWorldV2ReleaseHandoff` loader. The loader rechecks the 17 manifest-listed
artifact hashes and their historical Git provenance before this repository can
render any SQL.

Supabase's management query endpoint cannot preserve a transaction across
multiple HTTP requests. The runner therefore creates one request containing
one `BEGIN`/`COMMIT` envelope from that verified loader output. It does not
accept a migration path, SQL text, serialized handoff, project-ref input, or
database connection string. Inside the database transaction it requires that
`world_v2` is absent, captures a protected `public`/`auth`/`storage` catalog
fingerprint, applies all 17 artifacts and matching `schema_release` rows,
checks the exact ledger and 21 base tables, and rejects any protected-catalog
change before commit. Any failure before the commit rolls back the whole
release.

After commit, the same request returns only non-secret schema evidence: the
reviewed source commit, 17-row release ledger, and 21-table count. The
workflow verifies that response against its loader-derived expectation and
uploads the normalized evidence artifact. It never logs or persists a token,
password, database URL, request payload, or remote response body.

## Credential boundary

The workflow uses the existing protected `SUPABASE_ACCESS_TOKEN` repository
secret solely for the one Management API request. It does not use
`SUPABASE_DB_PASSWORD`, `supabase link`, `supabase db push`, dashboard SQL,
migration repair, reset, seed, or an application service-role key. If the
repository secret is absent or lacks permission for the fixed project, the
minimum missing credential is a server-held Supabase Management API access
token authorized to execute database queries for that project; it must be
configured as a repository secret, never supplied in a workflow input or
tracked file.

Dispatching this workflow is a separate publication decision. This source
slice neither dispatches it nor executes remote DDL. It does not initialize a
World, alter legacy site data, change browser permissions, or advance Gate B.
