# EconMind Admin Mail Terminal V1 — implementation report

> 本文记录最初的 source-only 阶段。用户随后明确授权部署；当前部署状态见
> [ADMIN-MAIL-DEPLOYMENT.md](ADMIN-MAIL-DEPLOYMENT.md)，下文的 No/NOT RUN 是原阶段记录。

日期：2026-09-20。完成源码实现与本地验证；没有 push、提交、PR、生产配置或真实发信。
开始时 `git status --short` 为空，没有覆盖既有用户修改。

## A. Existing architecture reviewed

实际阅读的重要文件：

- `next.config.ts`、`package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、`.env.example`、`.gitignore`
- `tsconfig.json`、`eslint.config.mjs`、`vitest.config.ts`
- `app/admin/page.tsx`、`app/admin/viewer-invitations/page.tsx`
- `components/admin/viewer-invitation-manager.tsx`
- `components/layout/navbar.tsx`、`sidebar.tsx`、`application-shell.tsx`
- `components/auth/auth-provider.tsx`、`registered-app-gate.tsx`、`account-onboarding.tsx`
- `components/legal/legal-consent-gate.tsx`
- `lib/platform/access-control.ts`、`superme-platform-admin.ts`
- `lib/supabase/client.ts`、`data.ts`、`account-moderation.ts`、`account-onboarding.ts`
- `lib/league/types.ts`、`lib/legal/legal-config.ts`
- `supabase/config.toml`
- `supabase/functions/moderate-account-access/index.ts`
- `supabase/migrations/20260722000000_initial_schema.sql`
- `supabase/migrations/20260729000000_inter_school_economic_league.sql`
- `supabase/migrations/20260831010000_add_reversible_account_suspension.sql`
- `supabase/migrations/20260913000000_research_library.sql`
- `supabase/migrations/20260917000000_superme_platform_admins.sql`
- `docs/SUPABASE.md`、`.github/workflows/deploy-pages.yml`、`tests/account-moderation.test.ts`

确认结果：

- canonical 权限是 `profiles.platform_role = 'platform_admin'`，数据库现有
  `public.is_platform_admin` 查询这一字段。邮件功能没有使用受保护管理员 UUID 白名单。
- canonical Browser Client 是 `requireSupabaseBrowserClient`，不是另建 Supabase client。
- 服务器采用既有 service-role client + `auth.getUser(token)` + profiles 查询模式。
- 真实姓名字段是 `profiles.display_name`，数据库上限 80 字符；没有添加假设字段。
- UI 复用既有 Navbar、Button、Card、Badge、颜色变量及 RegisteredAppGate。
- GitHub Pages 构建使用 `GITHUB_PAGES=true` 启用 `output: 'export'`；该配置未变。

## B. Final architecture

```text
OUTBOUND
Platform Admin → GitHub Pages /admin/mail
  → send-admin-email → Brevo → one recipient

INBOUND
admin@econmind.group → Cloudflare Email Worker
  → each existing verified management destination (original email)
  → HMAC-authenticated additional copy → ingest-admin-email → Supabase → Inbox

DELIVERY EVENTS
Brevo → Bearer-authenticated brevo-mail-events
  → mail_delivery_events → mail_messages
```

`/admin/mail` 提供 Inbox、Sent、Compose、conversation detail、Reply、分页及发送确认。
没有企业邮箱、备用官方地址、子域收件方案、群发、CC/BCC、富文本编辑器或历史删除功能。

## C. Files added

| 文件 | 用途 |
| --- | --- |
| `app/admin/mail/page.tsx` | 静态 Mail Terminal 路由 |
| `components/admin/mail-terminal.tsx` | 邮件列表、会话、回复、纯文本表单与确认对话框 |
| `lib/mail/admin-mail.ts` | 浏览器类型、校验、显示名称、回复主题和状态文案 |
| `lib/supabase/admin-mail.ts` | canonical client 查询与一次性 send invocation |
| `supabase/functions/_shared/admin-mail.ts` | 可测试的认证、校验、HMAC、发送和事件处理 |
| `supabase/functions/_shared/admin-mail-store.ts` | server-only privileged client adapter |
| `supabase/functions/send-admin-email/index.ts` | 管理员发送入口 |
| `supabase/functions/ingest-admin-email/index.ts` | 签名入站入口 |
| `supabase/functions/brevo-mail-events/index.ts` | 投递事件入口 |
| `supabase/migrations/20260920000200_admin_mail_terminal.sql` | additive mail schema/RLS/RPC 源码 |
| `tests/admin-mail-backend.test.ts` | 57 个后端认证、签名、失败及 transport mock tests |
| `tests/admin-mail-frontend.test.ts` | 13 个前端权限、请求、分页及内容边界 tests |
| `tests/admin-mail-schema.test.ts` | 5 个 migration source security contract checks |
| `infra/cloudflare/admin-mail-worker/src/index.ts` | 先转发、后解析和签名复制的 Worker |
| `infra/cloudflare/admin-mail-worker/test/worker.test.ts` | 28 个 MIME、转发隔离及真实 handler 签名兼容测试 |
| `infra/cloudflare/admin-mail-worker/package.json` | 局部依赖与检查命令 |
| `infra/cloudflare/admin-mail-worker/pnpm-lock.yaml` | 独立 dependency lock |
| `infra/cloudflare/admin-mail-worker/pnpm-workspace.yaml` | 隔离 workspace |
| `infra/cloudflare/admin-mail-worker/tsconfig.json` | Worker TypeScript 配置 |
| `infra/cloudflare/admin-mail-worker/vitest.config.ts` | Worker 独立测试配置 |
| `infra/cloudflare/admin-mail-worker/worker-configuration.d.ts` | Wrangler 生成的 binding 类型，无 secret values |
| `infra/cloudflare/admin-mail-worker/wrangler.jsonc` | 无生产 routes/地址的配置骨架 |
| `infra/cloudflare/admin-mail-worker/.gitignore` | 忽略本地配置和运行产物 |
| `infra/cloudflare/admin-mail-worker/README.md` | Worker 限制、局部验证和人工配置说明 |
| `docs/ADMIN-MAIL-TERMINAL.md` | 架构、安全边界、限制及 17 步部署清单 |
| `docs/ADMIN-MAIL-IMPLEMENTATION-REPORT.md` | 本报告 |

## D. Files modified

| 文件 | 用途 |
| --- | --- |
| `.gitignore` | 排除 Worker `.dev.vars`、本地 env 和 `.wrangler` 产物 |
| `components/layout/navbar.tsx` | 现有管理员菜单增加 Mail Terminal |
| `lib/platform/access-control.ts` | `/admin/mail` 仅 account + platform_admin |
| `supabase/config.toml` | 注册三个函数；send 保留 JWT gateway 检查，两个机器入口关闭 gateway JWT 并自行认证 |
| `tsconfig.json` | Next.js 类型程序排除独立 Worker workspace |
| `eslint.config.mjs` | 排除静态产物、Worker 依赖及生成类型；Worker 手写源码仍参与 lint |
| `vitest.config.ts` | 主仓库仅收集 `tests/**/*.test.ts`，避免安装主项目时依赖 Worker 局部包 |

主项目 `package.json`、`pnpm-lock.yaml`、Next.js/React/Supabase 依赖版本、
`.env.example`、`next.config.ts` 及生产部署 workflows 均未改动。

## E. Database

新表：`mail_threads`、`mail_messages`、`mail_delivery_events`。
最后一张是最小事件 ledger，用来处理重试和 webhook 先于 send response 落库的情况。

索引：Inbox 活动时间、thread chronology、Sent 时间、Internet Message-ID 查找、
inbound Message-ID 唯一、outbound provider ID 唯一、provider event reconciliation。
另有 `request_id`、`inbound_dedupe_key` 唯一约束及 `event_key` 主键。

约束覆盖 direction、status、固定邮箱、actor、长度、附件 metadata 数组及方向一致性。
Outbound 保存 actor UUID/name、sender、recipient、subject/body 的发送时 snapshot。
Actor UUID 不设置 cascading profile FK，避免账号删除连带破坏邮件审计记录。

新函数：

- `mail_begin_send`：事务创建 thread + pending message，锁定 request UUID 并拒绝 payload 冲突。
- `mail_complete_send`：保存确定的 provider 结果，处理早到事件。
- `mail_ingest_inbound`：事务去重和 header-based threading。
- `mail_apply_delivery_event`、`mail_reconcile_delivery`、`mail_delivery_rank`：事件幂等与保守状态排序。
- `mail_update_thread_summary`：仅在新增消息时更新列表摘要。
- `mail_preserve_message_history`：禁止历史内容修改和删除；允许 outbound 初次 provider ID 绑定及投递字段变更。

新函数全部使用 invoker rights，并撤销 PUBLIC/anon/authenticated EXECUTE；只授予 service_role。
RLS 和表权限见 M。没有修改既有角色、profiles 数据、业务表或 unrelated RLS。

**Existing production data modified? NO. Migration executed? NO.**

## F. Mail threading

ID 统一去除外层尖括号和首尾空白，保留大小写。
优先匹配 `In-Reply-To`，其次倒序检查 `References`，均查
`mail_messages.internet_message_id`；找不到则创建新 thread，不使用 subject fallback。

重复入站优先按 Message-ID 去重；缺少 ID 时使用 raw MIME SHA-256。
数据库 unique constraints + transaction advisory lock 防止并发重复新增或孤立 thread。
新回复内部始终使用既有 `thread_id`。Brevo 不使用未经支持的标准回复 header hack；
收件方客户端可能把该回复显示为独立邮件，但后续回复可用其已保存 Message-ID 重新关联。

## G. Sender identity

```text
From Email: admin@econmind.group
Reply-To:   admin@econmind.group
From Name:  canonical profiles.display_name + " · EconMind"
Fallback:   EconMind Admin · EconMind
```

服务端读取 profile，trim、限制长度、拒绝控制字符。客户端只提交
`to / subject / message / optional threadId`，额外身份、actor、headers、HTML、CC/BCC
字段被后端 allow-list 拒绝。逻辑 request UUID 放在专用 HTTP header，不影响发件身份。

## H. Inbox security

Cloudflare 使用 `INBOUND_MAIL_WEBHOOK_SECRET` 对 `timestamp.body` 做 HMAC-SHA256。
Supabase 通过 Web Crypto 验证签名，并检查 ±300 秒时效、payload 和流式大小上限。
无签名、错签名、篡改、明显过期或超前的请求不能访问写入 RPC。
时效窗口内合法重投是无写入副作用的 duplicate acknowledgement。

Cloudflare 不持有 Supabase service-role：它只负责签名提交，privileged writes
发生在 Supabase Edge Function。UI 不请求 `body_html`，只显示 React 转义后的 text。
HTML-only 内容在 Worker 中转换为 plaintext；转换失败使用明确 fallback。
附件只保存 filename/type/size/count；不建 public bucket、不执行或自动打开附件。

## I. Management forwarding

Worker 从 `MANAGEMENT_FORWARD_TO_JSON` 私密数组读取目的地，无实际地址硬编码。
先对所有有效、已验证目的地调用 `message.forward()`，逐个独立等待结果，然后才访问 raw。
一个目的地失败不阻止其他转发尝试；全部失败时抛出脱敏 forwarding error。
至少一个成功后，通过 `waitUntil` 执行 Inbox copy，所有 copy errors 被隔离。

没有在转发前读、tee 或消费 raw。之后只读一次，检查声明大小与实际字节数一致。
Supabase、解析器、HTML 转换或 ingest 故障不会跳过已完成的管理层转发尝试。

边界：解析副本上限 2 MiB、100 个附件；正文上限各 100,000 字符并提示截断。
超限、raw 不可用或复制失败时，原件仍优先转发，Inbox 可能没有副本。V1 无 durable queue。
Cloudflare/目的地自身的转发失败不能由应用保证恢复；日志记录计数供人工处理。
切换前必须远程验证每个现有目的地，不能把 mock 结果当作真实投递证明。

## J. Brevo delivery tracking

一次 logical send 对应一个 durable request UUID，只有新建 pending 的调用能访问 Brevo。
按官方专门幂等指南使用 JSON `headers.idempotencyKey`；该指南与 endpoint reference
的示例拼写存在差异，代码没有猜测 HTTP `Idempotency-Key`，并以永久 DB guard 为主要保证。
文档链接与差异说明位于 deployment guide。

成功返回的 Message-ID 同时保存为 provider ID 和 Internet ID。201/accepted 仅表示
Brevo 接受。确定拒绝记录 failed + 脱敏 code；网络/5xx/无法解析成功响应/发送后 DB 更新失败
保留 pending，并要求人工核查；没有第二次自动 send。

Webhook 独立验证 Bearer token。request/sent、delivered、deferred、soft/hard bounce、
blocked、invalid、error、spam 有对应状态，open/click 等事件被忽略。
事件 key 对 provider ID、规范化状态、时间取 hash，不错误地把 webhook ID 当 event ID。
ledger unique + provider advisory locks 处理重投及早到事件。保守 precedence 避免 delivered
退回 accepted/deferred，软失败可被 delivered 替换，永久失败/投诉保持可见。
生产 webhook 未配置。

## K. Secrets

以后由用户私下配置，Codex 不需要也没有获取真实值：

| Supabase | Cloudflare |
| --- | --- |
| `BREVO_API_KEY` | `INBOUND_MAIL_WEBHOOK_SECRET` |
| `INBOUND_MAIL_WEBHOOK_SECRET` | `MANAGEMENT_FORWARD_TO_JSON` |
| `BREVO_WEBHOOK_TOKEN` | `INBOUND_MAIL_INGEST_URL`（URL 本身非敏感，骨架按 secret binding 保存） |
| runtime `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 不配置 service role |

## L. Secret exposure review

新增源码只含环境变量名，测试 key/token/邮箱均为明确 synthetic fixtures。
没有读取本地 secret 文件；检查到根目录不存在 `.env`、`.env.local`、`.env.production`
或 `.env.production.local` 后，用 `example.invalid` 和非凭证占位值构建。

指定 key-prefix/赋值/NEXT_PUBLIC-secret 扫描未发现真实 secret。
浏览器 `out/_next/static` 未发现 Brevo endpoint、secret 名称、service-role 标识或管理层配置。
`api.brevo.com` 的实际请求仅存在于 server-side shared Edge handler；测试另有禁止浏览器直连的断言。
没有 active reply subdomain。GitHub Pages 的静态产物不包含 Worker、Edge runtime 或私密配置。

## M. RLS

| 身份 | SELECT threads/messages | INSERT / UPDATE / DELETE history | Mail RPC EXECUTE |
| --- | --- | --- | --- |
| 当前 platform_admin | 允许，经 canonical helper | 拒绝 | 拒绝 |
| 普通 authenticated | RLS 拒绝 | 拒绝 | 拒绝 |
| Anonymous | 无 table grant | 拒绝 | 拒绝 |
| Supabase service_role | 后端需要的访问 | 受 snapshot trigger 约束的后端操作 | 允许 |

浏览器不能读取事件 ledger。没有 browser-write policy，也没有对现有 helper 另建角色逻辑。

## N. Validation

| 项目 | 结果 | 证据或限制 |
| --- | --- | --- |
| 初始 worktree | PASS | 开始时 clean；未 reset/clean/restore 用户文件 |
| `pnpm lint` | PASS | 0 errors；7 个既有 warning 位于未修改的 auction-workspace.tsx |
| 改动文件 lint | PASS | 邮件 UI/adapter/Edge/Worker/tests 无错误 |
| `pnpm typecheck` | PASS | 主项目 TypeScript |
| `pnpm test` | PASS | 77 files，519 tests；邮件 75 tests 随最后 shared-handler 修改重跑通过 |
| GitHub Pages `pnpm build` | PASS | GITHUB_PAGES=true，461 static pages，含 `/admin/mail`；只用占位 public env |
| 三个 Edge Function `deno check` | PASS | runtime entrypoints + shared handlers/store |
| Worker `pnpm typecheck` | PASS | 独立 workspace |
| Worker `pnpm test` | PASS | 28 tests，含真实 MIME parser 与真实 ingest handler 的签名/JSON 兼容性 |
| Worker bundle check | PASS | `wrangler deploy --dry-run`，433.85 KiB；明确未上传/部署 |
| Secret / frontend bundle scan | PASS | 无真实 key、server secrets、management binding 或 Brevo 请求进入静态 JS |
| SQL 外层语法解析 | PASS | PostgreSQL parser 解析 32 statements，执行 0 statements；不等于 PL/pgSQL runtime 验证 |
| RLS/source integrity review | PASS | 5 source checks + 人工 grants/RLS/RPC/trigger review |
| 实际 PostgreSQL RLS enforcement | NOT RUN | 按要求未执行 migration；需要以后在 disposable DB 验证 |
| Inbound duplicate handler contract | PASS | 重复签名请求传入同一 RPC 身份并返回 duplicate，不另建 send |
| 实际 DB 并发去重 / In-Reply-To / References / 无匹配建 thread | NOT RUN | SQL 分支和锁已审查；没有假称 mock 证明数据库执行结果 |
| Delivery webhook auth / event mapping / stable identity | PASS | token 缺失或错误拒绝、事件规范化、重复 key、早到事件 handler response |
| 实际 DB event ordering / locking / reconciliation | NOT RUN | SQL 状态 rank 与锁已 source 检查；未执行 migration |
| Send rejection / success then DB failure | PASS | mock 验证 failed 或 pending，Brevo 调用始终一次 |
| Forwarding failure isolation | PASS | 所有 forwards 先完成；partial/total failures、ingest HTTP/network/parse faults mocks |
| MIME / HTML / attachments / charset | PASS | UTF-8、windows-1252、未知 charset、multipart、HTML-only、恶意 HTML、附件元数据、大小限制 |
| 本地浏览器交互与视觉检查 | PASS | Edge headless，1440px / 390px，纯假数据；确认/取消、双击、reply defaults、未知结果锁定、普通角色拒绝、无横向溢出 |
| 真实管理层转发 / Brevo send / production webhook | NOT RUN | 用户明确禁止本轮生产操作；真实发信 0 |
| `git diff --check` | PASS | 无 whitespace errors |

浏览器验证的两个函数请求均在本地被 Playwright intercept：一个模拟 accepted，一个模拟
网络失败。外部请求只允许 mock endpoint，其他外网请求被中止。没有使用真实登录或邮箱。

## O. git diff --stat

以下为原样 stdout。新文件保持 untracked，因此原生 `git diff --stat` 不包含 C 节的新文件；
没有为了美化统计而 stage 或 commit。

```text
 .gitignore                     |  7 ++++++-
 components/layout/navbar.tsx   |  3 ++-
 eslint.config.mjs              |  2 +-
 lib/platform/access-control.ts |  1 +
 supabase/config.toml           | 13 +++++++++++++
 tsconfig.json                  |  2 +-
 vitest.config.ts               |  2 ++
 7 files changed, 26 insertions(+), 4 deletions(-)
```

## P. Production actions

```text
Production DB modified:       No
Existing production data:     Unchanged
Migration executed:           No
Supabase Functions deployed:  No
Cloudflare Worker deployed:   No (local --dry-run only)
Cloudflare routing modified:  No
Cloudflare DNS/MX changed:     No
Management destinations changed: No
Brevo webhook configured:     No
Real email sent:              No
Production secrets changed:   No
Git pushed:                   No
Merge / PR created:           No
GitHub Pages deployed:        No
```

## Q. Manual production setup

完整可执行顺序及 rollback 见 [ADMIN-MAIL-TERMINAL.md](ADMIN-MAIL-TERMINAL.md#manual-production-checklist--not-performed-by-codex)。
必须由用户以后执行，顺序是：

1. Review code、migration、RLS；先在 disposable DB 完成报告中未运行的真实 SQL 测试。
2. Review migration history 后应用 mail migration，不重置生产数据库。
3. 私下生成安全 `INBOUND_MAIL_WEBHOOK_SECRET`。
4. 私下生成独立 `BREVO_WEBHOOK_TOKEN`。
5. 配置三个 Supabase secrets，保留 service-role 仅在 Supabase runtime。
6. 部署三个 Edge Functions，按 config 使用各自认证。
7. 私下配置 Worker 的 HMAC secret、exact existing management destination JSON 和 ingest URL。
8. 部署 Email Worker。
9. 保持官方地址原路由，先远程验证所有现有 verified management destinations 的实际收件及附件。
10. 只有 forwarding 验证成功后，才把 `admin@econmind.group` 的 action 切换到 Worker。
11. 受控 inbound test 同时验证 management 收件和 Inbox，且验证 ingest 故障隔离。
12. 人工创建指向 `brevo-mail-events` 的 Bearer-authenticated transactional webhook。
13. 启用有关投递事件；不为本功能启用 open/click tracking。
14. 确认 Brevo 中现有官方 sender/domain 仍有效。
15. 部署 GitHub Pages 静态前端。
16. 管理员明确确认后发送一封受控测试邮件。
17. 验证 Sent、recipient receipt、From/Reply-To、reply 到管理层与 Inbox、thread association、delivery status。

Inbox 出问题时恢复原 management forwarding action；保留审计历史，不自动重放 outbound。
