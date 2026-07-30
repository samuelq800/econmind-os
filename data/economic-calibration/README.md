# EconMind OS 经济数据、公式与校准资料包

**版本：** `0.1.0`
**采集日期：** 2026-07-30
**适用范围：** 12 个完全虚构的开放经济体；教学、情境推演与回归测试。不是预测、投资建议或现实国家数据库。
**许可策略：** 本包仅保存公开可访问来源的链接、定义、少量公开基准和合成参数；不再分发受限原始数据或使用付费 API。

## 先读此文件

### 状态与证据规则

| 状态 | 含义 | 可否当作现实事实 | 处理要求 |
|---|---|---:|---|
| `observed` | 从所列公开来源直接读取的现实参考序列/事件 | 可以，但限于来源覆盖期和定义 | 保存来源、版本/发布日期、覆盖期、单位、频率 |
| `derived` | 由已列输入按明确公式转换 | 可以作为计算结果，不是独立观测 | 保存公式、输入 ID、换算和舍入 |
| `synthetic_calibration` | 为虚构世界设定的可解释起点或参数 | **不可以** | 标示范围依据、场景假设和不确定性 |
| `placeholder` | 当前没有足够可靠公开资料，预留接口 | **不可以** | 不填数值；列出替代来源与补采条件 |

所有数值记录都必须带有 `status` 和 `provenance_id`。`provenance_id` 在 [sources.md](sources.md) 中解析；`world_country_calibration.json` 的每个字段还继承其国家级 `field_provenance`。这种引用式结构避免把相同来源、日期和定义复制数百次，却仍能在一跳内审计每个值。

### 统一单位与时间约定

- 金额：`GCU`（虚构的 global currency unit）；金额水平用 `billions_GCU_current`，人均为 `GCU_per_person_current`。只有外部商品锚点使用 `USD`，且不可与 GCU 汇率直接等同。
- 比率：除非变量名为 `*_index`，百分比一律为 `percent`，以 0–100 表示，**不是小数**。
- 指数：`index_2026Q1_100`；100 是世界情境初始均值，而不是价格指数或现实基期。
- 时间：国家初始状态为 `2026-Q1`（静态快照）；流量在世界引擎中先按季清算、按年汇总。日/周政策通过 `days_per_quarter=91.3125` 和 `weeks_per_quarter=13.0446` 转为引擎步长。
- 不确定性：`confidence` 是资料适用性与校准稳健性的评级（`high` / `medium` / `low`），不是统计置信区间。

### 交付清单（24 个数据包映射）

| # | 数据包 | 主交付物 | 覆盖及限制 |
|---:|---|---|---|
| 1 | 变量字典 | [variable_dictionary.csv](variable_dictionary.csv) | 统一 ID、单位、范围、默认值、来源和状态 |
| 2–6 | 宏观、财政、外部、社会、产业资源 | [world_country_calibration.json](world_country_calibration.json) | 12 个虚构国家；所有值为合成校准 |
| 7–8 | 商品市场、贸易物流 | [market_baselines.json](market_baselines.json) | 公开基准锚点 + 合成市场参数 |
| 9、16–19 | FX、微观、宏观、国际、机制公式 | [model_formula_catalog.md](model_formula_catalog.md) | 公式、假设、范围、单位和数值测试 |
| 10–11 | 政策效果与类别 | [policy_effect_library.json](policy_effect_library.json) | 参数化脉冲响应；非因果承诺 |
| 12–13 | 项目、合同与结算 | [market_baselines.json](market_baselines.json) | 结构与合成建议，现实合同字段为占位 |
| 14 | 冲击与危机 | [shock_library.json](shock_library.json) | 教学型、条件化冲击，不是概率预测 |
| 15 | 稳定性与崩溃 | [stability_rules.md](stability_rules.md) | 明确为可校准规则，绝非现实阈值事实 |
| 20 | 计量与证据 | [model_formula_catalog.md](model_formula_catalog.md) | 最小可用公开教学示例与识别边界 |
| 21 | 案例与新闻 | [sources.md](sources.md) | 可复核事件锚点与模型映射 |
| 22 | Practice 数据 | [practice_question_bank.json](practice_question_bank.json) | 5 个公开模型 × 每个 6 题 |
| 23 | 校准与测试集 | [calibration_test_suite.json](calibration_test_suite.json) | 基准、边界、极端、回归数值 |
| 24 | 元数据与版本 | [package_metadata.json](package_metadata.json)、[sources.md](sources.md) | 许可、替代来源、废弃策略和版本 |

## 非映射声明与校准方法

十二国名称仅为 **Asterra、Bellune、Cyrenia、Damaris、Eryndor、Falcrest、Gavren、Helion、Iskara、Jorvia、Kordell、Lumeria**。它们不是、也不应被理解为任何现实国家的替身。每国由两到三种经济特征的组合构造，并通过以下守恒/一致性检查：

1. `gdp_per_capita = gdp_current / population`；差异仅来自显示舍入。
2. `overall_fiscal_balance = total_revenue - total_expenditure`；`primary_balance = overall_balance + interest_cost`。
3. `current_account = trade_balance + net_primary_secondary_income`。
4. `agriculture + manufacturing + services = 100`；`technology` 是上述部门的交叉子集，不参与加总。
5. 发电结构份额加总为 100；进口依赖、储备、汇率制度和资本管制共同决定 FX 脆弱性，不能单独解释。

参考范围取自 IMF、世界银行、ILO、FAO、IEA、BIS 和 UN Comtrade 的跨国公开系列（完整记录见 [sources.md](sources.md)），再由 `CAL-SYN-01` 合成。合成范围表达异质性而非对任何现实国家的估计；用户需在使用日志中保留该标签。

## 接入顺序

1. 载入 `variable_dictionary.csv`，拒绝未知单位、超范围值及没有 `status` 的记录。
2. 载入 `world_country_calibration.json`；先运行其 `integrity_checks`。
3. 用 `market_baselines.json` 的索引和弹性初始化市场，**不要**把归一化价格当作美元价格。
4. 用政策库的 `lag/ramp/peak/decay` 生成分期脉冲响应；影响必须叠加、封顶并记录触发条件。
5. 运行 `calibration_test_suite.json`；触发 `forbidden_outputs` 时阻止发布本轮结果。

## 已知空缺与不应伪造的字段

- 虚构国家的双边贸易矩阵、港口吞吐量、航运保险报价、矿产储量、银行资本充足率和现实合同对手方均为 `placeholder` 或情境值；不能以现实名义填入。
- OECD、IMF 和学术文献提供的乘数/传导证据跨情境差异很大，参数库只给宽范围和条件，未把范围写成“政策必然效果”。
- World Bank PIP 的基尼/贫困资料混合收入和消费调查；只作为现实范围与定义参考，不能跨国做强排序。BIS DSR 更适合比较同一经济体相对自身均值的时间变化。

详尽来源、许可、发布日期、覆盖期、替代来源和采集规则见 [sources.md](sources.md)。
