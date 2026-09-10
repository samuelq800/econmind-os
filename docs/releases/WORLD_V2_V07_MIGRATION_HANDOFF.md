# World V2 V07 production migration handoff

## Authority and immutable source

```text
Source repository: https://github.com/samuelq800/econmind-os-world-simulation
Approved package target: 079fa9d230d5109488a1e5ea82e97f81845c49eb
Owner acceptance commit: e7cdaf0aaeb83ebe63c62208c512fcb251158929
World V2 merge commit: 5fb526c40345a46db7e355e257057295ce0d670f
Publisher main baseline: 6cb2e275df294004745f507e252c03d36201e928
Owner authority: PROJECT_OWNER_ACCEPTANCE
Production publisher: main-site release chain
```

This branch is the ADR-16 publication handoff for the independently reviewed
V07 migrations. The SQL files in `supabase/migrations/` are exact-byte copies
of the source artifacts; no header, wrapper, transaction block or SQL semantic
change was added by the publisher.

## Ordered artifacts

| Order | World migration ID | Source commit | Historical source path | Publisher path | SHA-256 |
| ---: | --- | --- | --- | --- | --- |
| 2 | `0002_world_v2_command_event_ledger` | `b8c8555bac1f5e8d36d1f147732a691f248431f8` | `database/migrations/artifacts/0002_world_v2_command_event_ledger.sql` | `supabase/migrations/20260910000200_0002_world_v2_command_event_ledger.sql` | `92915905a159961ac0f8eb70f509501cf7697519471c1b84f832ef224cf87695` |
| 3 | `0003_world_v2_command_receipts_outbox` | `f589c8fba2e4e2a5686d8a1c4ded60a8688056fa` | `database/migrations/artifacts/0003_world_v2_command_receipts_outbox.sql` | `supabase/migrations/20260910000300_0003_world_v2_command_receipts_outbox.sql` | `fe8d6b6849b4ceb5a85789fff34bd2ed47cf7d07d662883dd0c345e88ad9255e` |
| 4 | `0004_world_v2_receipt_event_set_integrity` | `6f919d3a20835da39a042ee7863d849f140f4e0c` | `database/migrations/artifacts/0004_world_v2_receipt_event_set_integrity.sql` | `supabase/migrations/20260910000400_0004_world_v2_receipt_event_set_integrity.sql` | `28bb8ff195d9c09b0cafcab79eb4a28868a1bf0170c7065fc4913a428bc17943` |

Migration 0003 is the frozen historical artifact. Migration 0004 is a separate
forward migration and does not rewrite 0003.

## Required predecessor gate

Migration 0002 starts with `create table world_v2.world_head`; it does not
create the `world_v2` schema. The publisher's authoritative `main` tree does
not contain migration `0001_world_v2_namespace`, and the V07 owner release
authorization names only migrations 0002, 0003 and 0004. Therefore this handoff
must not be merged into publisher `main` or applied until one of these facts is
established through the canonical release record:

1. migration 0001 has already been published and the `world_v2` schema exists;
   or
2. the owner separately authorizes promotion/publication of the exact 0001
   artifact through this same publisher.

No manual schema creation, dashboard SQL, ad-hoc repair, or second publisher is
an acceptable substitute.

## Canonical publisher action

After the predecessor gate is satisfied, verify each file's SHA-256 above,
merge this history-preserving release branch into the main-site `main`, and
dispatch `.github/workflows/deploy-supabase.yml` with
`apply_migrations=true`, `deploy_workers=false`, and
`apply_auth_config=false`. Stop subsequent release work on any migration
failure; use only an authorized forward repair.
