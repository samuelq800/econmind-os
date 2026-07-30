# 最终资料包：来源、许可与适用边界

**采集日：** 2026-07-30。只保留免费、公开可访问且可引用的资料。此表补充基础包的来源注册；基础包来源 ID 可通过 [`../economic-calibration/sources.md`](../economic-calibration/sources.md) 解析。

| ID | 公开来源 | 发布/覆盖/频率 | 用途与转换 | 访问与局限 |
|---|---|---|---|---|
| `FW-SRC-ATUS-WB-2021` | [BLS ATUS Well-Being Module microdata](https://www.bls.gov/tus/modules/wbdatafiles.htm) | 2021 模块，2021-03–12；此前 2010、2012、2013；个体/活动记录 | Flexible Work & Wellbeing 的可复现公开微数据入口；样本文件不复制受访者记录 | 免费下载 CSV；须使用权重并处理活动抽样误差/年份不连续 |
| `FW-SRC-ATUS-DOC` | [BLS ATUS 使用说明](https://www.bls.gov/tus/other-documentation/howto.htm) | 在线，2026-07 抓取；依文件 | 变量、权重、链接与非响应处理 | 公开；不能将单个合成样本解释为全国估计 |
| `FW-SRC-ONS-HOMEWORK` | [ONS Homeworking in the UK labour market](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/datasets/homeworkingintheuklabourmarket/current) | 发布 2021-05-17；公开下载表 | 远程工作普及的聚合交叉核验锚点 | Open Government 统计发布；非幸福感微观因果证据 |
| `FW-SRC-USDA-LAFA` | [USDA ERS Loss-Adjusted Food Availability](https://www.ers.usda.gov/data-products/food-availability-per-capita-data-system/loss-adjusted-food-availability-documentation) | 1970–最近可得年；年度；2025-01 更新文档 | 餐饮浪费、损耗定义及损耗假设的公开参考 | 数据为美国人均食品可得性/损耗，不是单个餐厅销售记录 |
| `FW-SRC-FAO-FLW` | [FAO Food Loss and Waste](https://www.fao.org/platform-food-loss-waste/en/) | 持续更新；指标依来源 | 食物损失/浪费术语与全球背景 | 公开；不提供餐厅级因果参数 |
| `FW-SRC-WB-PINK` | [World Bank Commodity Markets / Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) | 月度，1960–最近；2026-07 数据入口 | Oil Prices & Inflation 的原始油价锚点；以下载日快照 | 公开 XLS；价格单位/合约须随快照保存 |
| `FW-SRC-FRED-OIL` | [FRED Brent oil series](https://fred.stlouisfed.org/series/DCOILBRENTEU) | 日度，依序列更新 | 与 Pink Sheet 的原始油价交叉核验 | 免费访问；日均与月均不能直接混用 |
| `FW-SRC-FRED-CPI` | [FRED CPI series](https://fred.stlouisfed.org/series/CPIAUCSL) | 月度，依序列更新 | CPI 计算教学的可复现输入入口 | 免费访问；美国 CPI 不能代表全球/虚构经济 |
| `FW-SRC-ILO-MW` | [ILO minimum wage policy guide](https://www.ilo.org/global/topics/wages/minimum-wages/lang--en/index.htm) | 在线方法资料 | 最低工资/劳动市场政策的制度边界 | 公开；不提供单一普适就业弹性 |
| `FW-SRC-IMF-RESTRUCTURE` | [IMF Sovereign Debt Restructuring](https://www.imf.org/en/Topics/sovereign-debt) | 持续更新 | 政府贷款、债务重组、可持续性工作流锚点 | 公开；具体债务条款不能假定 |
| `FW-SRC-WB-PUBLIC-INVEST` | [World Bank infrastructure data and knowledge](https://www.worldbank.org/en/topic/infrastructure) | 在线；依资料 | 项目全周期、维护、韧性与公共投资说明锚点 | 公开背景；成本区间仍为合成校准 |
| `FW-SRC-CORE-MECH` | [CORE Econ: The Economy](https://www.core-econ.org/the-economy/) | 开放教材；持续版本 | 拍卖、公共品、博弈、市场、外部性、宏观教学公式 | 公开教材；参数并非真实结构估计 |
| `FW-SRC-ANGRIST` | [Mastering ’Metrics resources](https://www.mostlyharmlesseconometrics.com/) | 配套公开资源 | OLS、FE、DiD、IV、RDD、Logit 的识别与局限 | 方法资料；教学样本为合成或可复现抽样 |
| `FW-SRC-EWR` | [Econometrics with R](https://www.econometrics-with-r.org/) | 开放在线教材；持续版本 | OLS、多元回归、固定效应、Logit、置信区间的公式与教学边界 | 免费在线阅读；不替代研究设计 |
| `FW-SRC-MIXTAPE` | [Causal Inference: The Mixtape](https://mixtape.scunning.com/) | 开放在线教材；持续版本 | DiD、RDD、IV 的识别假设和诊断 | 免费在线阅读；案例不能机械外推 |

## 合成来源配置

| ID | 状态 | 组成与用途 | 可信度 |
|---|---|---|---|
| `FW-CAL-MAP-01` | `synthetic_calibration` | 完全虚构地理、路线、港口、资源和贸易亲和度；范围受基础包 WDI/FAO/IEA/UN Comtrade 定义启发，但无现实映射 | `medium`（内部一致性） |
| `FW-CAL-POL-01` | `synthetic_calibration` | 扩展政策的方向、范围和生命周期；使用基础政策库、ILO/IMF/CORE 的机制边界 | `low_to_medium` |
| `FW-CAL-CONTRACT-01` | `synthetic_calibration` | 合同、项目成本、延迟、违约和维护范围；只作教学执行状态机 | `low` |
| `FW-CAL-EVID-01` | `synthetic_calibration` | Evidence Lab 小样本；可复现公开数据路径或明确模拟，不作为外部发现 | `high`（算术）、`low`（外推） |

不得以来源名称暗示该机构认可虚构世界、政策系数或挑战答案。替换来源时新增 ID，并在版本说明中保留旧快照。
