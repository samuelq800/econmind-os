# EconMind OS 最终世界经济与教学场景资料包

**版本：** `0.1.0`  
**发布日期：** 2026-07-30  
**依赖：** `../economic-calibration/` 的 12 国初始校准、市场基线、政策、冲击、公式、Practice 与来源注册。  
**范围：** 新增世界地图/网络、完整治理、合同项目、连续引擎、EconBench、Mechanism Arena、Evidence Lab 与模型扩展；不覆盖或复制基础包。

## 数据状态与不能做的事

每个记录或其 `record_defaults` 都带下列状态之一：

| 状态 | 含义 | 规则 |
|---|---|---|
| `observed` | 公开现实事件、元数据或公开序列的原样小样 | 保存原链接、发布日期/覆盖期、单位、频率与许可证 |
| `derived` | 由明确输入/公式计算 | 保存输入 ID、公式和舍入方式 |
| `synthetic_calibration` | 虚构世界的参数、地图、贸易、合同或教学值 | 不可说成现实国家、机构、路线或人群事实 |
| `placeholder` | 尚无可可靠填入的值/对手方/报价 | 不可结算或发布为事实；必须列出补采来源 |

世界网络中的 12 国仅为 Asterra、Bellune、Cyrenia、Damaris、Eryndor、Falcrest、Gavren、Helion、Iskara、Jorvia、Kordell、Lumeria。地理、贸易连结、港口、航路与机构均为合成设计，**没有也不应推断现实映射**。

## 文件清单

| 领域 | 新文件 |
|---|---|
| 地图与贸易 | `fictional_world_map_spec.json`、`territory_network.json`、`trade_route_graph.json`、`bilateral_trade_matrix.json`、`map_and_trade_validation.json` |
| 七角色治理 | `extended_policy_effect_library.json`、`governance_approval_rules.json`、`policy_interactions.json`、`policy_regression_tests.json` |
| 合同与项目 | `contract_templates.json`、`settlement_and_default_rules.json`、`project_calibration_library.json`、`contract_project_test_suite.json` |
| 连续引擎 | `continuous_world_scenarios.json`、`stability_collapse_test_suite.json`、`idempotency_and_replay_tests.json` |
| 预设挑战 | `econbench_scenario_library.json` |
| 机制实验 | `mechanism_arena_scenarios.json`、`mechanism_result_metrics.json`、`mechanism_regression_tests.json` |
| Evidence Lab | `evidence_lab_projects.json`、`evidence_samples/`、`evidence_method_notes.md` |
| 扩展模型 | `extended_model_formula_catalog.md`、`extended_practice_question_bank.json`、`extended_model_test_suite.json` |
| 可追溯性 | `sources.md` |

## 统一执行约定

- 金额为虚构 `GCU`；外部 USD 资料只能作为 `observed` 锚点，不创建 GCU/USD 汇率事实。
- 比率默认 0–100 百分数；凡公式要求小数，加载器必须除以 100，输出再乘以 100。
- 持续时间以日计。`days_per_quarter=91.3125`；每个效果事件需有 UUID、`effective_at`、`policy_version` 与幂等键。
- 所有市场贸易流保存为 `trade_units_index`（非物理吨数）；结算时 `sum(exports)=sum(imports)+allowed_transport_loss`。库存、路线与合同的损失必须显式记账。
- 成本、概率、延迟和结果范围是教学型合成校准。模拟要抽取范围时，记录 `random_seed`、抽样分位数、输入快照哈希和模型版本。

## 验证入口

1. 解析所有 JSON，拒绝未知状态/来源 ID/货币单位。
2. 运行 `map_and_trade_validation.json`：路线引用、邻接对称、贸易矩阵行列/全球守恒。
3. 运行政策、合同项目、连续引擎、机制和扩展模型的各测试文件。
4. 回放时只按事件 UUID 应用一次；当前世界状态必须可以从基准快照加事件日志重建。

公开来源、使用范围和许可证见 [sources.md](sources.md)。基础宏观、贸易、能源、金融与商品来源继续以 [基础包 sources.md](../economic-calibration/sources.md) 为准。
