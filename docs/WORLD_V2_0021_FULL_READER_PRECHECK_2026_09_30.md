# World V2 0021 full reader: first production precheck

Run: [36668095506](https://github.com/samuelq800/econmind-os/actions/runs/36668095506), `workflow_dispatch` on main commit `2470c5062d97ed2fb12a9db0e21a8651f58880f5`.

Outcome: `WORLD_V2_RELEASE_UNKNOWN` / workflow failure. The read-only 0020 query succeeded, its strict verifier failed, the 0021 atomic write and after-write verifier were **skipped**, and the read-only diagnostic succeeded. This run did not apply 0021. There was no retry.

The before response matched the frozen 20-row ledger, both non-login roles, the two reader memberships, `public` and `world_v2` schema usage, eight column `SELECT` privileges, no table privileges, and the two existing policies. It returned 23 unchunked JSON root paths where the publisher expected 34. The 11 absent roots were `deposits`, `domestic-access`, `facilities`, `facility-map-links`, `geography`, `nodes`, `production-plans`, `regions`, `stocks`, `trade-plans`, and `transport-routes` under `data/*.json`. The frozen 0019 importer splits precisely those 11 UTF-8 files into numbered `.part` rows. Its frozen source produces 23 roots plus 119 numbered parts, or 142 storage rows for the 34 logical JSON sources. The publisher's 34-root assertion was therefore incorrect; this is an evidence-model mismatch, not evidence of missing source data.

The diagnostic response still contained the same 20 ledger rows, two policies, 23 roots, roles, memberships, and ACLs. Apart from its phase marker, it was identical to the before response. The workflow's `UNKNOWN` classification is retained because the full 0021 publication was not verified.

The workflow's [non-secret evidence artifact](https://github.com/samuelq800/econmind-os/actions/runs/36668095506) contains four JSON files. SHA-256 of the downloaded bytes:

| File                                 | SHA-256                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| `before-response.json`               | `a900dab3aaa4a9abdee6327c9f7662f4c80cfdd6b72738655d3d75d13c4ed4e2` |
| `expectation.json`                   | `c839fee9f1ee7c3f584eab5cdebe3c12a98d0b4edb53e1f2a8f75379df5062bb` |
| `read-only-diagnostic-response.json` | `aa8b19ca94c0a1cb839c916f2e9f768074f4247f5f93190b7acd0b6eef250e85` |
| `outcome-unknown.json`               | `595b857d99a4f504cebf601470599c5eb5adbee6cb6800424a915963c4e13927` |

Recovery requires a separately reviewed publisher that compares the exact root-or-part storage set, each stored hash and byte length, and each source reconstructed in path order. This report authorizes no production dispatch or database change.
