# World V2 0021 full reader publication evidence

Status: `EVIDENCED` for the narrow server-only 0021 database publication. The [release run 36672349466](https://github.com/samuelq800/econmind-os/actions/runs/36672349466) completed successfully after one authorized dispatch on 2026-09-30. This is not an API runtime activation, browser access grant, World opening-state adoption, worker dispatch, or Gate B decision.

## Bound identity

| Item                                     | Value                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| Supabase project ref                     | `vimksjrhaxdpnkvgsavz`                                             |
| Main commit executed                     | `4b58a28bfea93cdca33bd2e79782bf048376adfe`                         |
| Workflow                                 | `.github/workflows/release-world-v2-api-full-reader.yml`           |
| Workflow file SHA-256 at executed commit | `efbe762db371504fa67b96bef36ae801f7513afab1345f0e3fee843527b14377` |
| Frozen World source checkout             | `ede72d1adc97272c56ec0733227d72c2b8e89207`                         |
| Migration ID                             | `0021_world_v2_official_full_data_reader`                          |
| Migration SQL SHA-256                    | `e5c75c9f731283571680647d0447fd88924bf8a1476f67fe71b7c663ead1f670` |
| Migration artifact source commit         | `f2ceea4bce70e8d2a193c641f87af5ce8d2e47e3`                         |
| Run conclusion                           | `success`                                                          |
| Verifier status                          | `WORLD_V2_API_FULL_READER_RELEASE_VERIFIED`                        |
| Verified authority                       | `SERVER_ONLY_INACTIVE_CANDIDATE_FULL_DATA_READ`                    |

## Before and after

The workflow's read-only 0020 preflight and strict verifier both succeeded before the single atomic 0021 Management API write request. That write and the after-response verifier succeeded. The read-only diagnostic, `UNKNOWN`, and fail-closed branches were skipped. There was no retry.

Independent comparison of the downloaded workflow artifact against its frozen expectation found:

| Evidence                   | Before                                                             | After                                                                         |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Exact release ledger       | 20 entries, exact frozen baseline                                  | 21 entries; appended 0021 ID, SQL SHA-256, source commit, and order 21        |
| Candidate table policies   | 2 reviewed selected-source policies                                | The same 2 plus `country_candidate_artifact_selected_full_source_server_read` |
| Frozen JSON storage        | 142 exact rows: 23 roots plus 119 numbered parts                   | The same 142 exact rows                                                       |
| Reconstructed JSON sources | 34 exact SHA-256 and UTF-8 byte counts                             | The same 34 exact digests and byte counts                                     |
| Reader and login roles     | Both `NOLOGIN`, without bypass, superuser, or inherited privileges | Unchanged                                                                     |
| Reader memberships         | 2 exact memberships                                                | Unchanged                                                                     |
| Schema usage               | `public`, `world_v2`                                               | Unchanged                                                                     |
| Column `SELECT` privileges | 8 exact columns                                                    | Unchanged                                                                     |
| Table privileges           | 0                                                                  | 0                                                                             |
| Candidate bundle           | `IMPLEMENTED_UNVERIFIED_CANDIDATE`, `activation_allowed=false`     | Unchanged                                                                     |

Every storage row's recorded SHA-256 equaled the database-computed SHA-256. The 142 paths, stored hashes, computed hashes, UTF-8 byte lengths, and 34 path-ordered reconstruction digests matched the frozen source expectation before and after the write. The publication changed the reviewed policy and ledger; it did not import or rewrite source data.

## Evidence files

The [run's non-secret artifact](https://github.com/samuelq800/econmind-os/actions/runs/36672349466) contains these downloaded files. SHA-256 below refers to the downloaded file bytes:

| File                         | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| `before-response.json`       | `8095971d92751da64815a9859ab8f3d75d4faaecc03982e78cb09274700c6fa0` |
| `precondition-evidence.json` | `0cb4b73709f9ee8d7c2668d166600a0914e5800c6afdb3ca0fb232280098769a` |
| `after-response.json`        | `8d54332beb4fa1506f146383caab4c491e1f19ceb8d19256c12b124f8ec99be0` |
| `expectation.json`           | `a7b06263bddfd435968fb758b89777d8dd2fe6d5aac42d9c6bcaa73f22630941` |
| `evidence.json`              | `9378f985d40887fc93e910fc384399c8c9a4d9af31eb9588b070f4813ec15bd6` |

The earlier [fail-closed precheck report](WORLD_V2_0021_FULL_READER_PRECHECK_2026_09_30.md) records run 36668095506. Its atomic write step was skipped because the first publisher incorrectly expected 34 unchunked root paths. The reviewed chunk-aware repair was merged before this successful run.

No server login credential, API host deployment, application reader request, browser access, World opening-state adoption, or Gate B review was exercised by this workflow. Those remain separately `NOT_RUN` or `PENDING` as applicable.
